import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import {
  ENGINE_VERSION,
  type GameAction,
  type GameState,
  type ResumeEnvelope,
} from "@clave/engine";
import { RoomDatabase } from "../src/database.js";
import { RoomManager, type SeatCredentials } from "../src/rooms.js";

const LONG_AGO = "2026-10-01T12:00:00.000Z";

// A room whose two seats played basic turns until the song ended.
function finishedRoom(rooms: RoomManager): Record<"lead" | "follow", SeatCredentials> {
  const lead = rooms.create("lead", true);
  const seats = { lead, follow: rooms.join(lead.code, "follow") };
  let view = rooms.snapshot(lead.code, "lead", lead.seatToken);
  while (view.status === "setup" || view.status === "playing") {
    const role = view.status === "setup" ? view.setupRole : view.activeRole;
    const action: GameAction =
      view.status === "setup"
        ? { type: "CONFIRM_HAND", role }
        : view.phase === "dance"
          ? { type: "END_DANCE", role }
          : { type: "END_LESSON", role };
    view = rooms.action(lead.code, role, seats[role].seatToken, view.sequence, action).snapshot;
  }
  return seats;
}

// Rewrites a room's stored envelope, as last played long ago.
function rewriteStoredEnvelope(
  database: RoomDatabase,
  code: string,
  edit: (envelope: ResumeEnvelope) => void,
): void {
  const room = database.getRoom(code)!;
  const envelope = room.envelope as ResumeEnvelope;
  edit(envelope);
  database.commitEnvelope(
    code,
    envelope,
    LONG_AGO,
    [],
    room.started,
    room.terminalEvent,
    room.test,
  );
}

// Engine 3 games: stored before this release's engine version.
function storedByEngineThree(envelope: ResumeEnvelope): void {
  envelope.engineVersion = 3;
  envelope.state.engineVersion = 3;
}

function tamperedContent(envelope: ResumeEnvelope): void {
  envelope.contentBytes = envelope.contentBytes.replace(
    '"initialConnection":4',
    '"initialConnection":9',
  );
}

describe("authoritative room persistence", () => {
  // Rehydration logs every room it changes; keep that off the test output.
  let log: MockInstance<typeof console.error>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

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
    const storedEnvelope = stored.envelope as ResumeEnvelope;
    expect(storedEnvelope.state.sequence).toBe(1);
    expect(stored.started).toBe(true);

    const restarted = new RoomManager(database);
    const leadView = restarted.snapshot(lead.code, "lead", lead.seatToken);
    const followView = restarted.snapshot(follow.code, "follow", follow.seatToken);
    expect(leadView.sequence).toBe(1);
    expect(followView.setupRole).toBe("follow");
    expect(JSON.stringify(leadView)).not.toContain(
      storedEnvelope.state.players.follow.hand[0]!.instanceId,
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
        record.envelope as ResumeEnvelope,
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
      record.envelope as ResumeEnvelope,
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
    const envelope = record.envelope as ResumeEnvelope;
    envelope.engineVersion = 99;
    envelope.state.engineVersion = 99;
    database.commitEnvelope(
      record.code,
      envelope,
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

  it("shows a finished room stored by an older release after a restart", () => {
    const database = new RoomDatabase(":memory:");
    const { lead } = finishedRoom(new RoomManager(database));
    rewriteStoredEnvelope(database, lead.code, (envelope) => {
      storedByEngineThree(envelope);
      // Engine 4 added the dance history.
      delete (envelope.state as Partial<GameState>).danceHistory;
    });
    const restarted = new RoomManager(database);
    expect(restarted.snapshot(lead.code, "lead", lead.seatToken)).toMatchObject({
      status: "completed",
      danceHistory: [],
    });
    database.close();
  });

  it("keeps a room's last-active time through the restart that upgrades it", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    rooms.action(lead.code, "lead", lead.seatToken, 0, { type: "CONFIRM_HAND", role: "lead" });
    rewriteStoredEnvelope(database, lead.code, storedByEngineThree);
    new RoomManager(database);
    expect(database.getRoom(lead.code)!.lastActiveAt).toBe(LONG_AGO);
    database.close();
  });

  it("logs an upgraded room once and nothing on the next plain restart", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    rooms.action(lead.code, "lead", lead.seatToken, 0, { type: "CONFIRM_HAND", role: "lead" });
    rewriteStoredEnvelope(database, lead.code, (envelope) => {
      storedByEngineThree(envelope);
      // Engine 3 scored this game differently, so its log does not replay under engine 4.
      envelope.state.shared.style += 1;
    });
    new RoomManager(database);
    expect(log.mock.calls).toEqual([[expect.stringMatching(`upgraded in room ${lead.code}: `)]]);
    log.mockClear();
    new RoomManager(database);
    expect(log).not.toHaveBeenCalled();
    database.close();
  });

  it("shows a room whose content fails its hash as unresumable, with that reason", () => {
    const database = new RoomDatabase(":memory:");
    const rooms = new RoomManager(database);
    const lead = rooms.create("lead", true);
    rooms.join(lead.code, "follow");
    rewriteStoredEnvelope(database, lead.code, tamperedContent);
    const restarted = new RoomManager(database);
    expect(restarted.snapshot(lead.code, "lead", lead.seatToken)).toMatchObject({
      status: "unresumable",
      terminalReason: "Stored content does not match its hash.",
    });
    expect(database.getRoom(lead.code)!.terminalEvent).toBe("unresumable");
    database.close();
  });

  it("keeps the terminal event of a room that ended before it turned out unresumable", () => {
    const database = new RoomDatabase(":memory:");
    const { lead } = finishedRoom(new RoomManager(database));
    rewriteStoredEnvelope(database, lead.code, tamperedContent);
    const restarted = new RoomManager(database);
    expect(restarted.snapshot(lead.code, "lead", lead.seatToken).status).toBe("unresumable");
    expect(database.getRoom(lead.code)!.terminalEvent).toBe("completed");
    database.close();
  });
});
