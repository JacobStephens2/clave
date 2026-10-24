import { afterEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { RoomDatabase } from "../src/database.js";
import { RoomCreateLimiter } from "../src/room-create-limit.js";
import { RoomManager } from "../src/rooms.js";

describe("hot-seat completion beacon", () => {
  let database: RoomDatabase | undefined;

  afterEach(() => {
    database?.close();
    database = undefined;
  });

  function harness(): { application: Hono; rooms: RoomManager } {
    database?.close();
    database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    return {
      application: createApp({ rooms, database, limiter: new RoomCreateLimiter() }),
      rooms,
    };
  }

  function app(): Hono {
    return harness().application;
  }

  async function postBeacon(
    application: Hono,
    peer: string,
    gameId: string,
    forwardedFor?: string,
    type: "completed" | "lost" = "completed",
  ): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (forwardedFor !== undefined) headers["x-forwarded-for"] = forwardedFor;
    return application.request(
      "http://127.0.0.1/api/events/hotseat",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ gameId, type }),
      },
      { incoming: { socket: { remoteAddress: peer } } },
    );
  }

  async function createRoom(
    application: Hono,
    peer: string,
    forwardedFor?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (forwardedFor !== undefined) headers["x-forwarded-for"] = forwardedFor;
    return application.request(
      "http://127.0.0.1/api/rooms",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ role: "lead", test: true }),
      },
      { incoming: { socket: { remoteAddress: peer } } },
    );
  }

  it("refuses the 11th hot-seat beacon in a minute and does not store it", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postBeacon(application, "203.0.113.9", `game-${attempt}`);
      expect(response.status).toBe(204);
    }
    const blocked = await postBeacon(application, "203.0.113.9", "game-blocked");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: "Too many requests. Try again in a minute.",
    });
    expect(database!.getRoom("hotseat:game-blocked")).toBeNull();
    expect(database!.getRoom("hotseat:game-0")).not.toBeNull();
    expect(
      database!.db
        .prepare("SELECT type, mode, test FROM game_events WHERE room_code = ?")
        .get("hotseat:game-0"),
    ).toEqual({ type: "completed", mode: "hotseat", test: 0 });
  });

  it("counts a hot-seat beacon against the socket peer, not a client X-Forwarded-For", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postBeacon(
        application,
        "203.0.113.9",
        `game-${attempt}`,
        `198.51.100.${attempt}`,
      );
      expect(response.status).toBe(204);
    }
    const blocked = await postBeacon(application, "203.0.113.9", "game-blocked", "198.51.100.99");
    expect(blocked.status).toBe(429);
    expect(database!.getRoom("hotseat:game-blocked")).toBeNull();
    const otherPeer = await postBeacon(application, "203.0.113.10", "game-other", "198.51.100.0");
    expect(otherPeer.status).toBe(204);
  });

  it("counts a loopback proxy's hot-seat beacon against only the address that proxy appended", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postBeacon(
        application,
        "127.0.0.1",
        `game-${attempt}`,
        `198.51.100.${attempt}, 203.0.113.50`,
      );
      expect(response.status).toBe(204);
    }
    const blocked = await postBeacon(
      application,
      "127.0.0.1",
      "game-blocked",
      "198.51.100.99, 203.0.113.50",
    );
    expect(blocked.status).toBe(429);
    expect(database!.getRoom("hotseat:game-blocked")).toBeNull();
    const otherCaller = await postBeacon(
      application,
      "127.0.0.1",
      "game-other",
      "203.0.113.50, 203.0.113.51",
    );
    expect(otherCaller.status).toBe(204);
  });

  it("spends the same per-caller allowance on room creation and hot-seat beacons", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await createRoom(application, "203.0.113.9");
      expect(response.status).toBe(201);
    }
    const blockedBeacon = await postBeacon(application, "203.0.113.9", "game-over-limit");
    expect(blockedBeacon.status).toBe(429);
    expect(database!.getRoom("hotseat:game-over-limit")).toBeNull();

    const fresh = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postBeacon(fresh, "203.0.113.9", `game-${attempt}`);
      expect(response.status).toBe(204);
    }
    const blockedRoom = await createRoom(fresh, "203.0.113.9");
    expect(blockedRoom.status).toBe(429);
  });

  it("refuses a new hot-seat beacon once fifty hot-seat rows are stored", async () => {
    const { application, rooms } = harness();
    const lost = await postBeacon(application, "203.0.113.0", "game-0", undefined, "lost");
    expect(lost.status).toBe(204);
    for (let n = 1; n < 50; n += 1) {
      const response = await postBeacon(application, `203.0.113.${n}`, `game-${n}`);
      expect(response.status).toBe(204);
    }
    expect(database!.countActiveRooms()).toBe(0);
    expect(database!.getRoom("hotseat:game-0")?.terminalEvent).toBe("lost");

    const blocked = await postBeacon(application, "198.51.100.1", "game-51");
    expect(blocked.status).toBe(400);
    expect(await blocked.json()).toEqual({ error: "Hot-seat storage is full." });
    expect(database!.getRoom("hotseat:game-51")).toBeNull();
    expect(database!.countHotseatRows()).toBe(50);

    expect(() => rooms.create("lead", true)).not.toThrow();
    expect(database!.countActiveRooms()).toBe(1);
  });

  it("accepts a repeat beacon for a hot-seat game already stored at the cap", async () => {
    const { application } = harness();
    for (let n = 0; n < 50; n += 1) {
      const response = await postBeacon(application, `203.0.113.${n}`, `game-${n}`);
      expect(response.status).toBe(204);
    }
    const repeat = await postBeacon(application, "203.0.113.0", "game-0");
    expect(repeat.status).toBe(204);
    expect(database!.countHotseatRows()).toBe(50);
    expect(database!.getRoom("hotseat:game-0")).not.toBeNull();
  });

  it("stores a hot-seat beacon while fifty unfinished rooms fill the floor", async () => {
    const { application, rooms } = harness();
    for (let n = 0; n < 50; n += 1) rooms.create("lead", true);
    expect(database!.countActiveRooms()).toBe(50);

    const response = await postBeacon(application, "203.0.113.9", "couch-game");
    expect(response.status).toBe(204);
    expect(database!.getRoom("hotseat:couch-game")).not.toBeNull();
    expect(database!.countHotseatRows()).toBe(1);
    expect(database!.countActiveRooms()).toBe(50);
    expect(() => rooms.create("lead", true)).toThrow(/full/);
  });
});
