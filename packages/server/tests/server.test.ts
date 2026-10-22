import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, type GameAction } from "@clave/engine";
import { RoomDatabase } from "../src/database.js";
import { RoomManager } from "../src/rooms.js";

describe("authoritative room persistence", () => {
  it("claims private seats, persists accepted actions, and resumes after a manager restart", () => {
    const database = new RoomDatabase(":memory:");
    const first = new RoomManager(database);
    const lead = first.create("lead", true);
    const follow = first.join(lead.code, "follow");
    const before = first.snapshot(lead.code, "lead", lead.seatToken);
    first.action(lead.code, "lead", lead.seatToken, before.sequence, {
      type: "CONFIRM_HAND",
      role: "lead",
    });
    const stored = database.getRoom(lead.code)!;
    expect(stored.envelope.state.sequence).toBe(1);
    expect(stored.started).toBe(true);

    const restarted = new RoomManager(database);
    const leadView = restarted.snapshot(lead.code, "lead", lead.seatToken);
    const followView = restarted.snapshot(follow.code, "follow", follow.seatToken);
    expect(leadView.sequence).toBe(1);
    expect(followView.setupRole).toBe("follow");
    expect(JSON.stringify(leadView)).not.toContain(
      stored.envelope.state.players.follow.hand[0]!.instanceId,
    );
    database.close();
  });

  it("rejects stale-ahead sequences and treats repeated committed submissions idempotently", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    const committed = rooms.action(lead.code, "lead", lead.seatToken, 0, {
      type: "CONFIRM_HAND",
      role: "lead",
    });
    expect(committed.duplicate).toBe(false);
    const duplicate = rooms.action(lead.code, "lead", lead.seatToken, 0, {
      type: "CONFIRM_HAND",
      role: "lead",
    });
    expect(duplicate.duplicate).toBe(true);
    expect(() =>
      rooms.action(lead.code, "lead", lead.seatToken, 9, { type: "CONFIRM_HAND", role: "lead" }),
    ).toThrow(/ahead/);
    database.close();
  });

  it("frees a finished room's place on the floor", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const seats = Array.from({ length: 50 }, () => rooms.create("lead", true));
    expect(() => rooms.create("lead", true)).toThrow(/full/);

    const lead = seats[0]!;
    const follow = rooms.join(lead.code, "follow");
    const play = (role: "lead" | "follow", token: string, action: GameAction) =>
      rooms.action(lead.code, role, token, rooms.snapshot(lead.code, role, token).sequence, action);
    play("lead", lead.seatToken, { type: "CONFIRM_HAND", role: "lead" });
    play("follow", follow.seatToken, { type: "CONFIRM_HAND", role: "follow" });
    play("lead", lead.seatToken, { type: "STUMBLE", role: "lead", recoveryInstanceId: null });
    play("lead", lead.seatToken, { type: "END_LESSON", role: "lead" });
    play("follow", follow.seatToken, { type: "STUMBLE", role: "follow", recoveryInstanceId: null });
    expect(rooms.snapshot(lead.code, "lead", lead.seatToken).status).toBe("lost");

    expect(() => rooms.create("lead", true)).not.toThrow();
    database.close();
  });

  it("abandons an idle room that never started and frees its place on the floor", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const seats = Array.from({ length: 50 }, () => rooms.create("lead", true));
    expect(() => rooms.create("lead", true)).toThrow(/full/);

    const stillWaiting = seats[0]!;
    const idle = seats.slice(1);
    const backdate = (code: string, lastActiveAt: string) => {
      const record = database.getRoom(code)!;
      expect(record.started).toBe(false);
      database.commitEnvelope(
        record.code,
        record.envelope,
        lastActiveAt,
        [],
        record.started,
        record.terminalEvent,
        record.test,
      );
    };
    // Sweep at 2026-10-22T00:00:00.000Z keeps the 72-hour cutoff of 2026-10-19T00:00:00.000Z.
    backdate(stillWaiting.code, "2026-10-21T00:00:00.000Z");
    for (const seat of idle) backdate(seat.code, "2026-10-18T00:00:00.000Z");

    expect(database.markAbandoned("2026-10-19T00:00:00.000Z", "2026-10-22T00:00:00.000Z")).toBe(49);
    expect(database.getRoom(stillWaiting.code)).toMatchObject({
      started: false,
      terminalEvent: null,
    });
    for (const seat of idle) {
      expect(database.getRoom(seat.code)).toMatchObject({
        started: false,
        terminalEvent: "abandoned",
      });
    }
    expect(() => rooms.create("lead", true)).not.toThrow();
    database.close();
  });

  it("does not let a swept never-started room keep playing off the floor cap", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const held = rooms.create("lead", true);
    const record = database.getRoom(held.code)!;
    expect(record.started).toBe(false);
    database.commitEnvelope(
      record.code,
      record.envelope,
      "2000-01-01T00:00:00.000Z",
      [],
      record.started,
      record.terminalEvent,
      record.test,
    );

    // Same cutoff shape as the hourly sweep: abandon only rows idle before `before`.
    database.markAbandoned("2001-01-01T00:00:00.000Z", "2001-01-02T00:00:00.000Z");
    while (database.countActiveRooms() < 50) rooms.create("lead", true);
    expect(database.countActiveRooms()).toBe(50);

    let joined = false;
    try {
      rooms.join(held.code, "follow");
      joined = true;
    } catch (error) {
      expect(error instanceof Error ? error.message : "").toMatch(/ended/);
    }
    if ((database.getRoom(held.code)?.terminalEvent ?? null) === "abandoned")
      expect(joined).toBe(false);

    let played = false;
    try {
      rooms.action(held.code, "lead", held.seatToken, 0, {
        type: "CONFIRM_HAND",
        role: "lead",
      });
      played = true;
    } catch (error) {
      expect(error instanceof Error ? error.message : "").toMatch(/ended/);
    }

    expect(database.countActiveRooms()).toBeLessThanOrEqual(50);
    const terminal = database.getRoom(held.code)?.terminalEvent ?? null;
    if (terminal === "abandoned") {
      expect(played).toBe(false);
      expect(database.countActiveRooms()).toBe(50);
    } else {
      expect(terminal).toBeNull();
      expect(played).toBe(true);
      expect(database.countActiveRooms()).toBe(50);
    }

    const restarted = new RoomManager(database);
    let playedAfterRestart = false;
    try {
      restarted.action(held.code, "lead", held.seatToken, 0, {
        type: "CONFIRM_HAND",
        role: "lead",
      });
      playedAfterRestart = true;
    } catch (error) {
      expect(error instanceof Error ? error.message : "").toMatch(/ended/);
    }
    const finalTerminal = database.getRoom(held.code)?.terminalEvent ?? null;
    expect(database.countActiveRooms()).toBeLessThanOrEqual(50);
    if (finalTerminal === "abandoned") expect(playedAfterRestart).toBe(false);
    else expect(playedAfterRestart).toBe(true);

    database.close();
  });

  it("resumes a version-mismatched active room from its stored snapshot", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    const record = database.getRoom(lead.code)!;
    record.envelope.engineVersion = 99;
    record.envelope.state.engineVersion = 99;
    database.commitEnvelope(
      record.code,
      record.envelope,
      record.lastActiveAt,
      [],
      record.started,
      record.terminalEvent,
      record.test,
    );
    const restarted = new RoomManager(database);
    expect(restarted.snapshot(lead.code, "lead", lead.seatToken).engineVersion).toBe(
      ENGINE_VERSION,
    );
    database.close();
  });
});
