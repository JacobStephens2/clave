import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const cards = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "content", "src", "data", "cards.json"), "utf8"),
);
const expectedIds = cards.cards.map((card) => card.id).sort();

const fail = (message) => {
  throw new Error(`[art] ${message}`);
};

const verifyDirectory = (directory, extension) => {
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(extension))
    .map((name) => path.basename(name, extension))
    .sort();
  const missing = expectedIds.filter((id) => !names.includes(id));
  const extra = names.filter((id) => !expectedIds.includes(id));
  if (missing.length > 0) fail(`${directory} is missing ${missing.join(", ")}.`);
  if (extra.length > 0) fail(`${directory} contains unknown cards ${extra.join(", ")}.`);
  for (const id of expectedIds) {
    const file = path.join(directory, `${id}${extension}`);
    if (fs.statSync(file).size < 20_000) fail(`${file} is unexpectedly small.`);
  }
};

const webRoot = path.join(root, "packages", "client", "public", "card-art");
verifyDirectory(webRoot, ".webp");

for (const id of expectedIds) {
  const webp = fs.readFileSync(path.join(webRoot, `${id}.webp`));
  if (webp.subarray(0, 4).toString("ascii") !== "RIFF") fail(`${id}.webp has no RIFF header.`);
  if (webp.subarray(8, 12).toString("ascii") !== "WEBP") fail(`${id}.webp is not WebP.`);
}

process.stdout.write(`[art] Verified ${expectedIds.length} web card illustrations.\n`);
