import Database from "better-sqlite3";
import { resolve } from "node:path";

const forced = process.argv.includes("--force");
const databasePath = resolve(process.env.CLAVE_DB_PATH ?? "./data/clave.sqlite");
const database = new Database(databasePath, { readonly: true, fileMustExist: true });
const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const active = database
  .prepare(
    "SELECT code, last_active_at FROM rooms WHERE terminal_event IS NULL AND last_active_at >= ? ORDER BY last_active_at DESC",
  )
  .all(cutoff) as { code: string; last_active_at: string }[];
database.close();

if (active.length > 0 && !forced) {
  console.error(`Deploy blocked: ${active.length} active room(s) have moved in the last 48 hours.`);
  process.exit(2);
}

if (active.length > 0) console.warn(`Deploy guard overridden for ${active.length} active room(s).`);
else console.log("Deploy guard passed: no recently active rooms.");
