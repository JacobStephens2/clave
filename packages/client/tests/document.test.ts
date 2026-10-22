import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const documentPath = join(dirname(fileURLToPath(import.meta.url)), "../index.html");

describe("game document", () => {
  it("does not load classic scripts from analytics.stephens.page", () => {
    const html = readFileSync(documentPath, "utf8");
    expect(html).not.toContain("https://analytics.stephens.page/script.js");
    expect(html).not.toContain("https://analytics.stephens.page/recorder.js");

    const sources = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/gi)].map((match) => match[1]);
    expect(sources).toEqual(["/src/main.tsx"]);
  });
});
