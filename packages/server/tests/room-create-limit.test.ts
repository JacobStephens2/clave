import { afterEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { RoomDatabase } from "../src/database.js";
import { RoomCreateLimiter, roomCreateCaller } from "../src/room-create-limit.js";
import { RoomManager } from "../src/rooms.js";

describe("room creation rate limit", () => {
  let database: RoomDatabase | undefined;

  afterEach(() => {
    database?.close();
    database = undefined;
  });

  function app(): Hono {
    database = new RoomDatabase(":memory:");
    return createApp({
      rooms: new RoomManager(database),
      database,
      limiter: new RoomCreateLimiter(),
    });
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

  it("counts room creation against the socket peer, not a client X-Forwarded-For", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await createRoom(application, "203.0.113.9", `198.51.100.${attempt}`);
      expect(response.status).toBe(201);
    }
    const blocked = await createRoom(application, "203.0.113.9", "198.51.100.99");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: "Too many rooms created. Try again in a minute.",
    });
    const otherPeer = await createRoom(application, "203.0.113.10", "198.51.100.0");
    expect(otherPeer.status).toBe(201);
  });

  it("counts a loopback proxy's room creation against only the address that proxy appended", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await createRoom(
        application,
        "127.0.0.1",
        `198.51.100.${attempt}, 203.0.113.50`,
      );
      expect(response.status).toBe(201);
    }
    const blocked = await createRoom(application, "127.0.0.1", "198.51.100.99, 203.0.113.50");
    expect(blocked.status).toBe(429);

    const otherCaller = await createRoom(application, "127.0.0.1", "203.0.113.50, 203.0.113.51");
    expect(otherCaller.status).toBe(201);
  });
});

describe("room-create caller", () => {
  it("ignores X-Forwarded-For unless the socket peer is a loopback proxy", () => {
    expect(roomCreateCaller("203.0.113.9", "198.51.100.1, 198.51.100.2")).toBe("203.0.113.9");
    expect(roomCreateCaller("::ffff:203.0.113.9", "198.51.100.2")).toBe("203.0.113.9");
    expect(roomCreateCaller(undefined, "198.51.100.2")).toBe("unknown");
    expect(roomCreateCaller("   ", "198.51.100.2")).toBe("unknown");
  });

  it("uses only the address a loopback proxy appended", () => {
    expect(roomCreateCaller("127.0.0.1", "198.51.100.1, 203.0.113.50")).toBe("203.0.113.50");
    expect(roomCreateCaller("::1", "198.51.100.1, 203.0.113.50")).toBe("203.0.113.50");
    expect(roomCreateCaller("::ffff:127.0.0.1", "198.51.100.1, ::ffff:203.0.113.50")).toBe(
      "203.0.113.50",
    );
    expect(roomCreateCaller("127.0.0.1", undefined)).toBe("127.0.0.1");
    expect(roomCreateCaller("127.0.0.1", " , ")).toBe("127.0.0.1");
  });
});

describe("room-create limiter", () => {
  it("drops caller keys whose timestamps have all aged out", () => {
    const limiter = new RoomCreateLimiter();
    expect(limiter.allow("203.0.113.4", 1_000)).toBe(true);
    expect(limiter.allow("203.0.113.5", 1_000)).toBe(true);
    expect(limiter.allow("198.51.100.8", 61_000)).toBe(true);
    expect(limiter.callers()).toEqual(["198.51.100.8"]);
  });

  it("counts only room creates still inside the minute", () => {
    const limiter = new RoomCreateLimiter();
    expect(limiter.allow("203.0.113.4", 0)).toBe(true);
    for (let attempt = 0; attempt < 9; attempt += 1)
      expect(limiter.allow("203.0.113.4", 30_000)).toBe(true);
    expect(limiter.allow("203.0.113.4", 30_000)).toBe(false);
    expect(limiter.allow("203.0.113.4", 60_000)).toBe(true);
    expect(limiter.callers()).toEqual(["203.0.113.4"]);
  });

  it("does not let a refused room create fill the next minute", () => {
    const limiter = new RoomCreateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect(limiter.allow("203.0.113.4", 0)).toBe(true);
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect(limiter.allow("203.0.113.4", 30_000)).toBe(false);
    expect(limiter.allow("203.0.113.4", 60_000)).toBe(true);
  });
});
