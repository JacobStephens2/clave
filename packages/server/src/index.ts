import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { GameActionSchema, ENGINE_VERSION, RoleSchema, type Role } from "@clave/engine";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { RoomDatabase } from "./database.js";
import { RoomManager } from "./rooms.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const hostname = process.env.HOST ?? "0.0.0.0";
const database = new RoomDatabase();
const rooms = new RoomManager(database);
const app = new Hono();
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));

const createRequests = new Map<string, number[]>();

app.use(
  "/api/*",
  cors({
    origin: (origin) =>
      !origin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")
        ? origin
        : "https://clave.dance",
    allowHeaders: ["Content-Type", "X-Seat-Token"],
  }),
);

app.get("/healthz", (context) =>
  context.json({ ok: true, engineVersion: ENGINE_VERSION, service: "clave" }),
);

app.post("/api/rooms", async (context) => {
  const ip = context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const recent = (createRequests.get(ip) ?? []).filter(
    (timestamp) => Date.now() - timestamp < 60_000,
  );
  if (recent.length >= 10)
    return context.json({ error: "Too many rooms created. Try again in a minute." }, 429);
  recent.push(Date.now());
  createRequests.set(ip, recent);
  const body = z
    .object({ role: RoleSchema, test: z.boolean().optional().default(false) })
    .safeParse(await context.req.json().catch(() => ({})));
  if (!body.success) return context.json({ error: "Choose Lead or Follow." }, 400);
  try {
    return context.json(rooms.create(body.data.role, body.data.test), 201);
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : "Could not create the room." },
      400,
    );
  }
});

app.get("/api/rooms/:code", (context) => {
  try {
    return context.json({ availableRole: rooms.availableRole(context.req.param("code")) });
  } catch (error) {
    return context.json({ error: error instanceof Error ? error.message : "Room not found." }, 404);
  }
});

app.post("/api/rooms/:code/join", async (context) => {
  const body = z.object({ role: RoleSchema }).safeParse(await context.req.json().catch(() => ({})));
  if (!body.success) return context.json({ error: "Choose Lead or Follow." }, 400);
  try {
    return context.json(rooms.join(context.req.param("code"), body.data.role));
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : "Could not join the room." },
      400,
    );
  }
});

app.get("/api/rooms/:code/resume", (context) => {
  const role = RoleSchema.safeParse(context.req.query("role"));
  const seatToken = context.req.header("x-seat-token");
  if (!role.success || !seatToken)
    return context.json({ error: "Seat credentials are required." }, 401);
  try {
    return context.json({
      snapshot: rooms.snapshot(context.req.param("code"), role.data, seatToken),
    });
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : "Could not resume the room." },
      401,
    );
  }
});

app.post("/api/events/hotseat", async (context) => {
  const body = z
    .object({ gameId: z.string().min(1).max(120), type: z.enum(["completed", "lost"]) })
    .safeParse(await context.req.json().catch(() => ({})));
  if (!body.success) return context.json({ error: "Invalid completion event." }, 400);
  database.recordHotseatEvent(
    `hotseat:${body.data.gameId}`,
    body.data.type,
    new Date().toISOString(),
  );
  return context.body(null, 204);
});

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

app.get("*", async (context) => {
  if (!existsSync(clientDist)) {
    return context.json({ service: "clave", message: "Client assets have not been built yet." });
  }
  const requested = context.req.path === "/" ? "index.html" : context.req.path.slice(1);
  const safePath = requested.includes("..") ? "index.html" : requested;
  const candidate = join(clientDist, safePath);
  const path = existsSync(candidate) ? candidate : join(clientDist, "index.html");
  const body = await readFile(path);
  return context.body(body, 200, {
    "Content-Type": mimeTypes[extname(path)] ?? "application/octet-stream",
  });
});

const server = serve({ fetch: app.fetch, port, hostname });
const sockets = new WebSocketServer({ noServer: true });
const clients = new Map<WebSocket, { code: string; role: Role; seatToken: string }>();

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(code: string): void {
  const snapshots = rooms.snapshotsForRoom(code);
  for (const [socket, client] of clients) {
    if (client.code === code) send(socket, { type: "snapshot", snapshot: snapshots[client.role] });
  }
}

/** Whether a seat's partner has yet to claim their seat, is connected now, or has dropped away. */
function partnerPresence(code: string, role: Role): "absent" | "connected" | "away" {
  const partner: Role = role === "lead" ? "follow" : "lead";
  for (const client of clients.values())
    if (client.code === code && client.role === partner) return "connected";
  try {
    return rooms.availableRole(code) === partner ? "absent" : "away";
  } catch {
    return "absent";
  }
}

function broadcastPresence(code: string): void {
  for (const [socket, client] of clients) {
    if (client.code === code)
      send(socket, { type: "presence", partner: partnerPresence(code, client.role) });
  }
}

server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const code = url.searchParams.get("code")?.toUpperCase() ?? "";
    const role = RoleSchema.parse(url.searchParams.get("role"));
    const seatToken = url.searchParams.get("token") ?? "";
    const clientVersion = Number.parseInt(url.searchParams.get("engineVersion") ?? "0", 10);
    if (clientVersion !== ENGINE_VERSION)
      throw new Error("This game has updated. Reload before reconnecting.");
    rooms.authenticate(code, role, seatToken);
    sockets.handleUpgrade(request, socket, head, (websocket) => {
      clients.set(websocket, { code, role, seatToken });
      sockets.emit("connection", websocket, request);
    });
  } catch (error) {
    socket.write(
      `HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n${error instanceof Error ? error.message : "Unauthorized"}`,
    );
    socket.destroy();
  }
});

sockets.on("connection", (socket) => {
  const client = clients.get(socket);
  if (!client) return socket.close(4401, "Seat credentials missing");
  send(socket, {
    type: "snapshot",
    snapshot: rooms.snapshot(client.code, client.role, client.seatToken),
  });
  broadcastPresence(client.code);

  socket.on("message", (raw) => {
    try {
      const message = z
        .object({
          type: z.literal("action"),
          sequence: z.number().int().nonnegative(),
          action: GameActionSchema,
        })
        .parse(JSON.parse(raw.toString()));
      rooms.action(client.code, client.role, client.seatToken, message.sequence, message.action);
      broadcast(client.code);
    } catch (error) {
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Action rejected.",
      });
    }
  });
  socket.on("close", () => {
    clients.delete(socket);
    broadcastPresence(client.code);
  });
});

const maintenance = setInterval(
  () => {
    const current = Date.now();
    database.markAbandoned(
      new Date(current - 72 * 60 * 60 * 1000).toISOString(),
      new Date(current).toISOString(),
    );
    database.deleteExpired(new Date(current - 30 * 24 * 60 * 60 * 1000).toISOString());
  },
  60 * 60 * 1000,
);
maintenance.unref();

console.log(`[clave] listening on http://${hostname}:${port}`);

function shutdown(): void {
  clearInterval(maintenance);
  sockets.close();
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
