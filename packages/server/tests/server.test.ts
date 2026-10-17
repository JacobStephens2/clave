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
