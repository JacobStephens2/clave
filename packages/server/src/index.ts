import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { RoomDatabase } from "./database.js";
import { RoomCreateLimiter } from "./room-create-limit.js";
import { RoomManager } from "./rooms.js";
import { attachGameSockets } from "./sockets.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const hostname = process.env.HOST ?? "0.0.0.0";
const database = new RoomDatabase();
const rooms = new RoomManager(database);
const app = createApp({ rooms, database, limiter: new RoomCreateLimiter() });

const server = serve({ fetch: app.fetch, port, hostname });
// `serve` is typed as HTTP/1 or HTTP/2. This process listens with HTTP/1.1.
const sockets = attachGameSockets(server as Server, rooms);

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
