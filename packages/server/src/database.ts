import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ResumeEnvelope, Role } from "@clave/engine";

export type GameEventType = "game_started" | "completed" | "lost" | "abandoned" | "unresumable";

export interface RoomRecord {
  code: string;
  envelope: ResumeEnvelope;
  leadToken: string | null;
  followToken: string | null;
  createdAt: string;
  lastActiveAt: string;
  started: boolean;
  terminalEvent: GameEventType | null;
  test: boolean;
}

interface RawRoom {
  code: string;
  envelope_json: string;
  lead_token: string | null;
  follow_token: string | null;
  created_at: string;
  last_active_at: string;
  started: number;
  terminal_event: GameEventType | null;
  test: number;
}

export class RoomDatabase {
  readonly db: Database.Database;

  constructor(path = process.env.CLAVE_DB_PATH ?? "./data/clave.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    let version = this.db.pragma("user_version", { simple: true }) as number;
    if (version === 0) {
      this.db.exec(`
        CREATE TABLE rooms (
          code TEXT PRIMARY KEY,
          envelope_json TEXT NOT NULL,
          lead_token TEXT,
          follow_token TEXT,
          created_at TEXT NOT NULL,
          last_active_at TEXT NOT NULL,
          started INTEGER NOT NULL DEFAULT 0,
          terminal_event TEXT,
          test INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE game_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_code TEXT NOT NULL,
          type TEXT NOT NULL,
          mode TEXT NOT NULL CHECK(mode IN ('online', 'hotseat')),
          occurred_at TEXT NOT NULL,
          test INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY(room_code) REFERENCES rooms(code) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX game_events_online_once ON game_events(room_code, type) WHERE mode = 'online';
        CREATE INDEX rooms_last_active ON rooms(last_active_at);
        CREATE INDEX game_events_type_time ON game_events(type, occurred_at);
        PRAGMA user_version = 1;
      `);
      version = 1;
    }
    if (version === 1) {
      this.db.exec(`
        DROP INDEX IF EXISTS game_events_online_once;
        DELETE FROM game_events
          WHERE id NOT IN (SELECT MIN(id) FROM game_events GROUP BY room_code, type, mode);
        CREATE UNIQUE INDEX game_events_once ON game_events(room_code, type, mode);
        CREATE UNIQUE INDEX game_terminal_once ON game_events(room_code)
          WHERE type IN ('completed', 'lost', 'abandoned', 'unresumable');
        PRAGMA user_version = 2;
      `);
      version = 2;
    }
    if (version > 2)
      throw new Error(`Database schema ${version} is newer than this server supports.`);
  }

  createRoom(record: RoomRecord): void {
    this.db
      .prepare(
        `INSERT INTO rooms
          (code, envelope_json, lead_token, follow_token, created_at, last_active_at, started, terminal_event, test)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.code,
        JSON.stringify(record.envelope),
        record.leadToken,
        record.followToken,
        record.createdAt,
        record.lastActiveAt,
        Number(record.started),
        record.terminalEvent,
        Number(record.test),
      );
  }

  getRoom(code: string): RoomRecord | null {
    const row = this.db.prepare("SELECT * FROM rooms WHERE code = ?").get(code) as
      RawRoom | undefined;
    return row ? this.mapRoom(row) : null;
  }

  countActiveRooms(): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE terminal_event IS NULL").get() as {
        n: number;
      }
    ).n;
  }

  listActiveRooms(): RoomRecord[] {
    return (
      this.db.prepare("SELECT * FROM rooms WHERE terminal_event IS NULL").all() as RawRoom[]
    ).map((row) => this.mapRoom(row));
  }

  claimSeat(code: string, role: Role, token: string, now: string): boolean {
    const column = role === "lead" ? "lead_token" : "follow_token";
    const result = this.db
      .prepare(
        `UPDATE rooms SET ${column} = ?, last_active_at = ? WHERE code = ? AND ${column} IS NULL`,
      )
      .run(token, now, code);
    return result.changes === 1;
  }

  commitEnvelope(
    code: string,
    envelope: ResumeEnvelope,
    now: string,
    events: GameEventType[],
    started: boolean,
    terminalEvent: GameEventType | null,
    test: boolean,
  ): void {
    this.db.transaction(() => {
      const update = this.db
        .prepare(
          `UPDATE rooms
             SET envelope_json = ?, last_active_at = ?, started = ?, terminal_event = ?
           WHERE code = ?`,
        )
        .run(JSON.stringify(envelope), now, Number(started), terminalEvent, code);
      if (update.changes !== 1) throw new Error("Room disappeared during commit.");
      const insert = this.db.prepare(
        "INSERT OR IGNORE INTO game_events (room_code, type, mode, occurred_at, test) VALUES (?, ?, 'online', ?, ?)",
      );
      for (const event of events) insert.run(code, event, now, Number(test));
    })();
  }

  recordHotseatEvent(gameId: string, type: "completed" | "lost", now: string): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO rooms
           (code, envelope_json, created_at, last_active_at, started, terminal_event, test)
           VALUES (?, '{}', ?, ?, 1, ?, 0)`,
        )
        .run(gameId, now, now, type);
      this.db
        .prepare(
          "INSERT OR IGNORE INTO game_events (room_code, type, mode, occurred_at, test) VALUES (?, ?, 'hotseat', ?, 0)",
        )
        .run(gameId, type, now);
    })();
  }

  markAbandoned(before: string, now: string): number {
    const rooms = this.db
      .prepare("SELECT code, test FROM rooms WHERE terminal_event IS NULL AND last_active_at < ?")
      .all(before) as { code: string; test: number }[];
    this.db.transaction(() => {
      for (const room of rooms) {
        this.db
          .prepare("UPDATE rooms SET terminal_event = 'abandoned' WHERE code = ?")
          .run(room.code);
        this.db
          .prepare(
            "INSERT OR IGNORE INTO game_events (room_code, type, mode, occurred_at, test) VALUES (?, 'abandoned', 'online', ?, ?)",
          )
          .run(room.code, now, room.test);
      }
    })();
    return rooms.length;
  }

  deleteExpired(before: string): number {
    return this.db.prepare("DELETE FROM rooms WHERE last_active_at < ?").run(before).changes;
  }

  close(): void {
    this.db.close();
  }

  private mapRoom(row: RawRoom): RoomRecord {
    return {
      code: row.code,
      envelope: JSON.parse(row.envelope_json) as ResumeEnvelope,
      leadToken: row.lead_token,
      followToken: row.follow_token,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      started: Boolean(row.started),
      terminalEvent: row.terminal_event,
      test: Boolean(row.test),
    };
  }
}
