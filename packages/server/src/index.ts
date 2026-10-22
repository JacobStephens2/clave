import { serve } from "@hono/node-server";
import { GameActionSchema, ENGINE_VERSION, RoleSchema, type Role } from "@clave/engine";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { createApp } from "./app.js";
import { RoomDatabase } from "./database.js";
import { RoomCreateLimiter } from "./room-create-limit.js";
import { RoomManager } from "./rooms.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const hostname = process.env.HOST ?? "0.0.0.0";
const database = new RoomDatabase();
const rooms = new RoomManager(database);
const app = createApp({ rooms, database, limiter: new RoomCreateLimiter() });

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
