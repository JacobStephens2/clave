import { hashCanonical, parseContentBytes, sha256Hex } from "@clave/content";
import { describe, expect, it } from "vitest";
import fixtures from "../fixtures/golden-replays.json" with { type: "json" };
import { ENGINE_VERSION, GameActionSchema, replayActions } from "../src/index.js";

describe("golden replay determinism · NFR-4", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} replays byte-identically`, () => {
      expect(fixture.engineVersion).toBe(ENGINE_VERSION);
      expect(sha256Hex(fixture.contentBytes)).toBe(fixture.contentHash);
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
      expect(first.ok).toBe(true);
      expect(second).toEqual(first);
      if (!first.ok) return;
      expect(first.state.status).toBe(fixture.ending);
      expect(hashCanonical(first.state)).toBe(fixture.expectedStateHash);
    });
  }
});
