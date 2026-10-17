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
