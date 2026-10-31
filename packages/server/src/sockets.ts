import type { Server } from "node:http";
import { ENGINE_VERSION, GameActionSchema, RoleSchema, type Role } from "@clave/engine";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import type { RoomManager } from "./rooms.js";

// Compact JSON for one action. PLAY_OPEN is the longest: two engine instance
// ids (`follow-` plus a safe integer) and a safe-integer sequence. `ws` closes
// a larger frame with 1009 before it emits `message`.
const largestInstanceId = `follow-${Number.MAX_SAFE_INTEGER}`;
export const ACTION_FRAME_MAX_BYTES = Buffer.byteLength(
  JSON.stringify({
    type: "action",
    sequence: Number.MAX_SAFE_INTEGER,
    action: {
      type: "PLAY_OPEN",
      role: "follow",
      positionInstanceId: largestInstanceId,
      moveInstanceId: largestInstanceId,
    },
  }),
);

export function attachGameSockets(server: Server, rooms: RoomManager): WebSocketServer {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: ACTION_FRAME_MAX_BYTES });
  const clients = new Map<WebSocket, { code: string; role: Role; seatToken: string }>();

  function send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function broadcast(code: string): void {
    const snapshots = rooms.snapshotsForRoom(code);
    for (const [socket, client] of clients) {
      if (client.code === code)
        send(socket, { type: "snapshot", snapshot: snapshots[client.role] });
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
    // `ws` emits `error` and closes with 1009 when a frame exceeds maxPayload.
    // Leaving that error unhandled would take down the process.
    socket.on("error", (error: Error) => {
      if ("code" in error && error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") return;
      throw error;
    });
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

  return sockets;
}
