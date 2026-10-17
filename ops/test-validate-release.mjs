import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const fixture = mkdtempSync(join(tmpdir(), "clave-release-validation-"));
const commit = "a".repeat(40);
const client = join(fixture, "packages/client/dist");
const metadata = join(client, "release.json");
const sentinel = join(fixture, "executed");
const validate = () =>
  spawnSync(process.execPath, [
    fileURLToPath(new URL("./validate-release.mjs", import.meta.url)),
    fixture,
    commit,
  ]);

try {
  mkdirSync(client, { recursive: true });
  mkdirSync(join(fixture, "packages/server/dist"), { recursive: true });
  writeFileSync(join(fixture, "packages/server/dist/index.js"), "// built server\n");
  writeFileSync(metadata, JSON.stringify({ commit }));
  assert.equal(validate().status, 0, "accepts the packaged release");

  writeFileSync(metadata, JSON.stringify({ commit: "b".repeat(40) }));
  assert.notEqual(validate().status, 0, "rejects a mismatched commit");
  writeFileSync(metadata, "{invalid json");
  assert.notEqual(validate().status, 0, "rejects malformed metadata");

  const payload = join(fixture, "payload.cjs");
  writeFileSync(
    payload,
    `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed'); module.exports = ${JSON.stringify({ commit })};`,
  );
  rmSync(metadata);
  symlinkSync(payload, metadata);
  assert.notEqual(validate().status, 0, "rejects symlink metadata instead of loading a module");
  assert.equal(existsSync(sentinel), false, "never executes the uploaded JavaScript");

  rmSync(metadata);
  mkdirSync(metadata);
  writeFileSync(join(metadata, "package.json"), JSON.stringify({ main: payload }));
  assert.notEqual(validate().status, 0, "rejects a directory with a module entry point");
  assert.equal(existsSync(sentinel), false, "never resolves the uploaded module directory");

  rmSync(client, { recursive: true });
  const other = join(fixture, "other");
  mkdirSync(other);
  writeFileSync(join(other, "release.json"), JSON.stringify({ commit }));
  symlinkSync(other, client);
  assert.notEqual(validate().status, 0, "rejects a symlink in the metadata's parent path");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
process.stdout.write("Release validation checks passed.\n");
