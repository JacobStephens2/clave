import { fileURLToPath } from "node:url";
import { getConnInfo } from "@hono/node-server/conninfo";
import { ENGINE_VERSION, RoleSchema } from "@clave/engine";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { serveClientAssets } from "./client-assets.js";
import type { RoomDatabase } from "./database.js";
import { roomCreateCaller, type RoomCreateLimiter } from "./room-create-limit.js";
import type { RoomManager } from "./rooms.js";

const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createApp(options: {
  rooms: RoomManager;
  database: RoomDatabase;
  limiter: RoomCreateLimiter;
}): Hono {
  const { rooms, database, limiter } = options;
  const app = new Hono();

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
    const caller = roomCreateCaller(
      getConnInfo(context).remote.address,
      context.req.header("x-forwarded-for"),
    );
    if (!limiter.allow(caller, Date.now()))
      return context.json({ error: "Too many rooms created. Try again in a minute." }, 429);
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
      return context.json(
        { error: error instanceof Error ? error.message : "Room not found." },
        404,
      );
    }
  });

  app.post("/api/rooms/:code/join", async (context) => {
    const body = z
      .object({ role: RoleSchema })
      .safeParse(await context.req.json().catch(() => ({})));
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

  app.get("*", serveClientAssets(clientDist));
  return app;
}
