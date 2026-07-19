import { mkdirSync, renameSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

const databasePath = resolve(process.env.CLAVE_DB_PATH ?? "./data/clave.sqlite");
const backupDirectory = resolve(process.env.CLAVE_BACKUP_DIR ?? "./backups");
const retentionDays = Number.parseInt(process.env.CLAVE_BACKUP_RETENTION_DAYS ?? "14", 10);
mkdirSync(backupDirectory, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-");
const temporary = join(backupDirectory, `.clave-${stamp}.sqlite.tmp`);
const final = join(backupDirectory, `clave-${stamp}.sqlite`);
const escaped = temporary.replaceAll("'", "''");

const source = new Database(databasePath, { readonly: true });
source.exec(`VACUUM INTO '${escaped}'`);
source.close();

const backup = new Database(temporary, { readonly: true });
const integrity = backup.pragma("integrity_check", { simple: true });
backup.close();
if (integrity !== "ok") throw new Error(`Backup integrity check failed: ${String(integrity)}`);
renameSync(temporary, final);

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
for (const entry of readdirSync(backupDirectory)) {
  const path = join(backupDirectory, entry);
  if (entry.startsWith("clave-") && entry.endsWith(".sqlite") && statSync(path).mtimeMs < cutoff)
    unlinkSync(path);
}

console.log(`Verified backup created: ${basename(final)} in ${dirname(final)}`);
