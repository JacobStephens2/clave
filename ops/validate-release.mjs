import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const [root, commit] = process.argv.slice(2);
if (!root || !/^[0-9a-f]{40}$/.test(commit ?? "")) {
  throw new Error("Usage: validate-release.mjs RELEASE_DIRECTORY COMMIT");
}

for (const directory of [
  "packages",
  "packages/client",
  "packages/client/dist",
  "packages/server",
  "packages/server/dist",
]) {
  if (!lstatSync(join(root, directory)).isDirectory()) {
    throw new Error(`Expected a real release directory: ${directory}`);
  }
}
for (const file of ["packages/client/dist/release.json", "packages/server/dist/index.js"]) {
  if (!lstatSync(join(root, file)).isFile()) {
    throw new Error(`Expected a regular release file: ${file}`);
  }
}
const metadata = JSON.parse(readFileSync(join(root, "packages/client/dist/release.json"), "utf8"));
if (metadata.commit !== commit)
  throw new Error("Release metadata does not match the requested commit.");
