import { describe, expect, it } from "vitest";
import { cardsById, content, contentBytes, contentHash, parseContentBytes } from "../src/index.js";

const count = (entries: readonly { count: number }[]) =>
  entries.reduce((sum, entry) => sum + entry.count, 0);

describe("v1 content", () => {
  it("matches the card-list counts", () => {
    expect(count(content.decks.starter)).toBe(8);
    expect(count(content.decks.intermediate)).toBe(22);
    expect(count(content.decks.advanced)).toBe(6);
    expect(count(content.decks.full.lead)).toBe(16);
    expect(count(content.decks.full.follow)).toBe(16);
    expect(content.song.cards).toHaveLength(16);
  });

  it("references defined cards and preserves the exact bytes/hash pair", () => {
    const ids = [
      ...content.decks.starter,
      ...content.decks.intermediate,
      ...content.decks.advanced,
      ...content.decks.full.lead,
      ...content.decks.full.follow,
    ].map((entry) => entry.cardId);
    expect(ids.every((id) => cardsById[id])).toBe(true);
    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parseContentBytes(contentBytes)).toEqual(content);
  });
});
