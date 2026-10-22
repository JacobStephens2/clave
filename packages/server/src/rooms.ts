import { randomBytes } from "node:crypto";
import {
  applyEnvelopeAction,
  createEnvelope,
  envelopeSnapshot,
  rehydrateEnvelope,
  type GameAction,
  type PlayerSnapshot,
  type Role,
} from "@clave/engine";
import type { GameEventType, RoomDatabase, RoomRecord, StoredRoom } from "./database.js";

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
    for (const stored of database.listActiveRooms())
      this.rooms.set(stored.code, this.rehydrate(stored));
  }

  create(role: Role, test = false): SeatCredentials {
    // Only unfinished rooms hold a place; finished or abandoned ones never come back.
    if (this.database.countActiveRooms() >= 50)
      throw new Error("The dance floor is full. Try again later.");
    let code = roomCode();
    while (this.database.getRoom(code)) code = roomCode();
    const seatToken = token();
    const timestamp = now();
    const record: RoomRecord = {
      code,
      envelope: createEnvelope({ seed: seed(), gameId: code }),
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
    this.refreshTerminal(record);
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
    return envelopeSnapshot(room.envelope, role);
  }

  action(
    code: string,
    role: Role,
    seatToken: string,
    expectedSequence: number,
    action: GameAction,
  ): { snapshot: PlayerSnapshot; duplicate: boolean } {
    const room = this.authenticate(code, role, seatToken);
    this.refreshTerminal(room);
    const abandoned = room.terminalEvent === "abandoned";
    if (abandoned) throw new Error("That dance has already ended.");
    if (expectedSequence < room.envelope.state.sequence) {
      return { snapshot: this.snapshot(code, role, seatToken), duplicate: true };
    }
    if (expectedSequence > room.envelope.state.sequence)
      throw new Error("Your game state is ahead of the server. Reload the room.");
    if (action.role !== role)
      throw new Error("An action cannot be submitted for your partner's seat.");
    const result = applyEnvelopeAction(room.envelope, action);
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
    return { snapshot: envelopeSnapshot(room.envelope, role), duplicate: false };
  }

  snapshotsForRoom(code: string): Partial<Record<Role, PlayerSnapshot>> {
    const room = this.get(code);
    return {
      ...(room.leadToken ? { lead: envelopeSnapshot(room.envelope, "lead") } : {}),
      ...(room.followToken ? { follow: envelopeSnapshot(room.envelope, "follow") } : {}),
    };
  }

  /** Copy a terminal event from the row onto the cached room, if the sweep wrote one. */
  private refreshTerminal(room: RoomRecord): void {
    const stored = this.database.getRoom(room.code);
    if (stored?.terminalEvent) room.terminalEvent = stored.terminalEvent;
  }

  private get(code: string): RoomRecord {
    const loaded = this.rooms.get(code);
    if (loaded) return loaded;
    const stored = this.database.getRoom(code);
    if (!stored) throw new Error("Room not found.");
    const room = this.rehydrate(stored);
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Every room loaded from the database comes through here. A rehydration that changed the
   * envelope is committed before the room serves anything, keeping its last-active time and any
   * terminal event it already has.
   */
  private rehydrate(stored: StoredRoom): RoomRecord {
    const { kind, envelope, detail } = rehydrateEnvelope(stored.envelope);
    const room: RoomRecord = { ...stored, envelope };
    if (kind === "resumed") return room;
    console.error(`[clave] ${kind} in room ${room.code}: ${detail}`);
    const events: GameEventType[] = [];
    if (kind === "unresumable" && !room.terminalEvent) {
      room.terminalEvent = "unresumable";
      events.push("unresumable");
    }
    this.database.commitEnvelope(
      room.code,
      envelope,
      room.lastActiveAt,
      events,
      room.started,
      room.terminalEvent,
      room.test,
    );
    return room;
  }
}
