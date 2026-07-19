import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assetsDirectory = new URL("../packages/client/dist/assets/", import.meta.url);
const javascript = readdirSync(assetsDirectory)
  .filter((file) => file.endsWith(".js"))
  .map((file) => readFileSync(join(assetsDirectory.pathname, file)));
const bytes = javascript.reduce((total, file) => total + gzipSync(file).byteLength, 0);
const limit = 500 * 1024;

if (bytes >= limit) {
  throw new Error(`Initial JavaScript is ${Math.round(bytes / 1024)} KB gzipped (limit: 500 KB).`);
}

console.log(`Initial JavaScript: ${Math.round(bytes / 1024)} KB gzipped (limit: 500 KB).`);
