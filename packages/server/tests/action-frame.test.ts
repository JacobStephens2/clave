import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@clave/engine";
import { WebSocket, type RawData } from "ws";
import { RoomDatabase } from "../src/database.js";
import { RoomManager } from "../src/rooms.js";
import { ACTION_FRAME_MAX_BYTES, attachGameSockets } from "../src/sockets.js";

describe("seat socket action frames", () => {
  let database: RoomDatabase | undefined;
  let httpServer: Server | undefined;
  const openSockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of openSockets) socket.terminate();
    openSockets.length = 0;
    if (httpServer) {
      const closing = httpServer;
      httpServer = undefined;
      await new Promise<void>((resolve, reject) => {
        closing.close((error) => (error ? reject(error) : resolve()));
      });
    }
    database?.close();
    database = undefined;
  });

  async function seatedLead(): Promise<{
    rooms: RoomManager;
    socket: WebSocket;
    incoming: ReturnType<typeof messageQueue>;
    code: string;
    seatToken: string;
  }> {
    database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    httpServer = createServer();
    attachGameSockets(httpServer, rooms);
    await new Promise<void>((resolve) => {
      httpServer!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = httpServer.address();
    if (address === null || typeof address === "string") throw new Error("expected a TCP port");
    const query = new URLSearchParams({
      code: lead.code,
      role: "lead",
      token: lead.seatToken,
      engineVersion: String(ENGINE_VERSION),
    });
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?${query}`);
    openSockets.push(socket);
    const incoming = messageQueue(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", (error) => reject(error));
    });
    return { rooms, socket, incoming, code: lead.code, seatToken: lead.seatToken };
  }

  function messageQueue(socket: WebSocket): {
    nextMessage: () => Promise<unknown>;
    pending: () => unknown[];
  } {
    const queue: unknown[] = [];
    const waiters: Array<(message: unknown) => void> = [];
    socket.on("message", (data) => {
      const parsed: unknown = JSON.parse(text(data));
      const waiter = waiters.shift();
      if (waiter) waiter(parsed);
      else queue.push(parsed);
    });
    return {
      nextMessage() {
        const queued = queue.shift();
        if (queued !== undefined) return Promise.resolve(queued);
        return new Promise((resolve) => waiters.push(resolve));
      },
      pending: () => queue,
    };
  }

  function text(data: RawData): string {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString();
    if (Array.isArray(data)) return Buffer.concat(data).toString();
    return Buffer.from(data).toString();
  }

  const legalAction = JSON.stringify({
    type: "action",
    sequence: 0,
    action: { type: "CONFIRM_HAND", role: "lead" },
  });

  it("applies a legal action from the seated player", async () => {
    const { rooms, socket, incoming, code, seatToken } = await seatedLead();
    expect(await incoming.nextMessage()).toMatchObject({
      type: "snapshot",
      snapshot: { sequence: 0 },
    });
    expect(await incoming.nextMessage()).toMatchObject({ type: "presence", partner: "away" });

    socket.send(legalAction);
    expect(await incoming.nextMessage()).toMatchObject({
      type: "snapshot",
      snapshot: { sequence: 1, setupRole: "follow" },
    });
    expect(rooms.snapshot(code, "lead", seatToken).sequence).toBe(1);
  });

  it("closes a larger frame before that action can apply", async () => {
    const { rooms, socket, incoming, code, seatToken } = await seatedLead();
    await incoming.nextMessage();
    await incoming.nextMessage();

    const overflow = ACTION_FRAME_MAX_BYTES + 1 - Buffer.byteLength(legalAction);
    expect(overflow).toBeGreaterThan(0);
    const oversized = legalAction + " ".repeat(overflow);
    expect(Buffer.byteLength(oversized)).toBe(ACTION_FRAME_MAX_BYTES + 1);

    const closed = new Promise<number>((resolve, reject) => {
      socket.once("close", (code) => resolve(code));
      socket.once("error", (error) => reject(error));
    });
    socket.send(oversized);

    expect(await closed).toBe(1009);
    expect(incoming.pending()).toEqual([]);
    expect(rooms.snapshot(code, "lead", seatToken).sequence).toBe(0);
  });
});
