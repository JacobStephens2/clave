import { randomBytes } from "node:crypto";
import { contentBytes, verifyContentHash } from "@clave/content";
import {
  ENGINE_VERSION,
  GameStateSchema,
  ResumeEnvelopeSchema,
  applyEnvelopeAction,
  createEnvelope,
  createGame,
  replayActions,
  snapshotFor,
  type GameAction,
  type PlayerSnapshot,
  type Role,
} from "@clave/engine";
import { canonicalStringify } from "@clave/content";
import type { GameEventType, RoomDatabase, RoomRecord } from "./database.js";

const now = (): string => new Date().toISOString();
const token = (): string => randomBytes(16).toString("base64url");
const seed = (): number => randomBytes(4).readUInt32LE(0);
const roomCode = (): string => token().toUpperCase();

export interface SeatCredentials {
  code: string;
  role: Role;
  seatToken: string;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomRecord>();

  constructor(readonly database: RoomDatabase) {
    for (const record of database.listActiveRooms())
      this.rooms.set(record.code, this.rehydrate(record));
  }

  create(role: Role, test = false): SeatCredentials {
    if (this.rooms.size >= 50) throw new Error("The dance floor is full. Try again later.");
    let code = roomCode();
    while (this.database.getRoom(code)) code = roomCode();
    const seatToken = token();
    const gameSeed = seed();
    const game = createGame({ seed: gameSeed, gameId: code });
    const timestamp = now();
    const record: RoomRecord = {
      code,
      envelope: createEnvelope(game, contentBytes),
      leadToken: role === "lead" ? seatToken : null,
      followToken: role === "follow" ? seatToken : null,
      createdAt: timestamp,
      lastActiveAt: timestamp,
      started: false,
      terminalEvent: null,
      test,
    };
    this.database.createRoom(record);
    this.rooms.set(code, record);
    return { code, role, seatToken };
  }

  join(codeInput: string, role: Role): SeatCredentials {
    const code = codeInput.trim().toUpperCase();
    const record = this.get(code);
    if (record.terminalEvent) throw new Error("That dance has already ended.");
    const occupied = role === "lead" ? record.leadToken : record.followToken;
    if (occupied)
      throw new Error(`The ${role === "lead" ? "Lead" : "Follow"} seat is already claimed.`);
    const seatToken = token();
    if (!this.database.claimSeat(code, role, seatToken, now()))
      throw new Error("That seat was just claimed.");
    if (role === "lead") record.leadToken = seatToken;
    else record.followToken = seatToken;
    record.lastActiveAt = now();
    return { code, role, seatToken };
  }

  availableRole(codeInput: string): Role | null {
    const room = this.get(codeInput.trim().toUpperCase());
    if (!room.leadToken) return "lead";
    if (!room.followToken) return "follow";
    return null;
  }

  authenticate(codeInput: string, role: Role, seatToken: string): RoomRecord {
    const room = this.get(codeInput.trim().toUpperCase());
    const expected = role === "lead" ? room.leadToken : room.followToken;
    if (!expected || expected !== seatToken) throw new Error("This device does not own that seat.");
    return room;
  }

  snapshot(code: string, role: Role, seatToken: string): PlayerSnapshot {
    const room = this.authenticate(code, role, seatToken);
    const content = verifyContentHash(room.envelope.contentBytes, room.envelope.contentHash);
    return snapshotFor(room.envelope.state, role, content);
  }

  action(
    code: string,
    role: Role,
    seatToken: string,
    expectedSequence: number,
    action: GameAction,
  ): { snapshot: PlayerSnapshot; duplicate: boolean } {
    const room = this.authenticate(code, role, seatToken);
    if (expectedSequence < room.envelope.state.sequence) {
      return { snapshot: this.snapshot(code, role, seatToken), duplicate: true };
    }
    if (expectedSequence > room.envelope.state.sequence)
      throw new Error("Your game state is ahead of the server. Reload the room.");
    if (action.role !== role)
      throw new Error("An action cannot be submitted for your partner's seat.");
    const content = verifyContentHash(room.envelope.contentBytes, room.envelope.contentHash);
    const result = applyEnvelopeAction(room.envelope, action, content);
    if (!result.ok) throw new Error(result.error.message);

    const events: GameEventType[] = [];
    const bothClaimed = Boolean(room.leadToken && room.followToken);
    if (!room.started && bothClaimed) {
      room.started = true;
      events.push("game_started");
    }
    let terminalEvent = room.terminalEvent;
    if (
      !terminalEvent &&
      ["completed", "lost", "unresumable"].includes(result.envelope.state.status)
    ) {
      terminalEvent = result.envelope.state.status as GameEventType;
      events.push(terminalEvent);
    }

    const timestamp = now();
    this.database.commitEnvelope(
      code,
      result.envelope,
      timestamp,
      events,
      room.started,
      terminalEvent,
      room.test,
    );
    room.envelope = result.envelope;
    room.lastActiveAt = timestamp;
    room.terminalEvent = terminalEvent;
    return { snapshot: snapshotFor(room.envelope.state, role, content), duplicate: false };
  }

  snapshotsForRoom(code: string): Partial<Record<Role, PlayerSnapshot>> {
    const room = this.get(code);
    const content = verifyContentHash(room.envelope.contentBytes, room.envelope.contentHash);
    return {
      ...(room.leadToken ? { lead: snapshotFor(room.envelope.state, "lead", content) } : {}),
      ...(room.followToken ? { follow: snapshotFor(room.envelope.state, "follow", content) } : {}),
    };
  }

  private get(code: string): RoomRecord {
    const room = this.rooms.get(code) ?? this.database.getRoom(code);
    if (!room) throw new Error("Room not found.");
    this.rooms.set(code, room);
    return room;
  }

  private rehydrate(record: RoomRecord): RoomRecord {
    const parsedEnvelope = ResumeEnvelopeSchema.safeParse(record.envelope);
    if (!parsedEnvelope.success)
      return this.unresumable(record, "Stored resume envelope is invalid.");
    const envelope = parsedEnvelope.data;
    let content;
    try {
      content = verifyContentHash(envelope.contentBytes, envelope.contentHash);
    } catch {
      return this.unresumable(record, "Stored content does not match its hash.");
    }
    if (envelope.engineVersion === ENGINE_VERSION) {
      const replay = replayActions(
        { seed: envelope.seed, gameId: record.code, content, contentHash: envelope.contentHash },
        envelope.actions,
      );
      if (replay.ok && canonicalStringify(replay.state) !== canonicalStringify(envelope.state)) {
        console.error(`[clave] replay mismatch in room ${record.code}; preserving stored snapshot`);
      }
      return record;
    }
    const state = GameStateSchema.safeParse(envelope.state);
    if (!state.success)
      return this.unresumable(record, "Stored state cannot be read by this release.");
    state.data.engineVersion = ENGINE_VERSION;
    record.envelope = { ...envelope, engineVersion: ENGINE_VERSION, state: state.data };
    this.database.commitEnvelope(
      record.code,
      record.envelope,
      now(),
      [],
      record.started,
      record.terminalEvent,
      record.test,
    );
    return record;
  }

  private unresumable(record: RoomRecord, reason: string): RoomRecord {
    const state = GameStateSchema.safeParse(record.envelope.state);
    if (state.success) {
      state.data.status = "unresumable";
      state.data.phase = "terminal";
      state.data.terminalReason = reason;
      record.envelope = { ...record.envelope, state: state.data };
    } else {
      const fallback = createGame({ seed: record.envelope.seed ?? 0, gameId: record.code });
      fallback.status = "unresumable";
      fallback.phase = "terminal";
      fallback.terminalReason = reason;
      record.envelope = createEnvelope(fallback, contentBytes);
    }
    record.terminalEvent = "unresumable";
    this.database.commitEnvelope(
      record.code,
      record.envelope,
      now(),
      ["unresumable"],
      record.started,
      "unresumable",
      record.test,
    );
    return record;
  }
}
