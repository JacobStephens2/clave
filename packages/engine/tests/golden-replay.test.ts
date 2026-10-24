import { hashCanonical, parseContentBytes, sha256Hex } from "@clave/content";
import { describe, expect, it } from "vitest";
import fixtures from "../fixtures/golden-replays.json" with { type: "json" };
import { ENGINE_VERSION, GameActionSchema, replayActions } from "../src/index.js";

// Regenerating the fixtures is one command, so every failure below names it.
const REGENERATE = "Run `npm run golden:write` to regenerate the golden replays.";

describe("golden replay determinism · NFR-4", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} replays byte-identically`, () => {
      expect(fixture.engineVersion, REGENERATE).toBe(ENGINE_VERSION);
      expect(sha256Hex(fixture.contentBytes), REGENERATE).toBe(fixture.contentHash);
      const content = parseContentBytes(fixture.contentBytes);
      const actions = GameActionSchema.array().parse(fixture.actions);
      const first = replayActions(
        { seed: fixture.seed, content, contentHash: fixture.contentHash },
        actions,
      );
      const second = replayActions(
        { seed: fixture.seed, content, contentHash: fixture.contentHash },
        actions,
      );
      expect(first.ok, REGENERATE).toBe(true);
      expect(second, REGENERATE).toEqual(first);
      if (!first.ok) return;
      expect(first.state.status, REGENERATE).toBe(fixture.ending);
      expect(hashCanonical(first.state), REGENERATE).toBe(fixture.expectedStateHash);
    });
  }
});
