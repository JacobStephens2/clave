import { describe, expect, it } from "vitest";
import {
  cardsById,
  content,
  contentBytes,
  contentHash,
  parseContentBytes,
  type MoveCard,
  type Position,
} from "../src/index.js";

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
    expect(content.rules.startingPosition).toBe("Open");
    expect(
      content.decks.starter.some(
        (entry) =>
          cardsById[entry.cardId]?.type === "position" &&
          cardsById[entry.cardId].position === content.rules.startingPosition,
      ),
    ).toBe(true);
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

  it("keeps every represented position playable in each fixed deck", () => {
    const positionsById = Object.fromEntries(
      content.cards
        .filter((card) => card.type === "position")
        .map((card) => [card.id, card.position]),
    );
    const movesById = Object.fromEntries(
      content.cards.filter((card) => card.type === "move").map((card) => [card.id, card]),
    );

    for (const deck of [
      content.decks.starter,
      content.decks.full.lead,
      content.decks.full.follow,
    ]) {
      const positions = deck
        .map((entry) => positionsById[entry.cardId])
        .filter((position): position is Position => position !== undefined);
      const moves = deck
        .map((entry) => movesById[entry.cardId])
        .filter((move): move is MoveCard => move !== undefined);
      for (const position of positions)
        expect(moves.some((move) => move.positions.includes(position))).toBe(true);
    }
  });

  it("gives the starter two real ways to dance from Closed", () => {
    expect(content.decks.starter).toEqual([
      { cardId: "pos_001", count: 2 },
      { cardId: "pos_002", count: 1 },
      { cardId: "mov_001", count: 1 },
      { cardId: "mov_002", count: 1 },
      { cardId: "mov_003", count: 1 },
      { cardId: "mov_004", count: 1 },
      { cardId: "mov_013", count: 1 },
    ]);

    const starterIds = new Set(content.decks.starter.map((entry) => entry.cardId));
    const closedMoves = content.cards
      .filter(
        (card): card is MoveCard =>
          card.type === "move" && starterIds.has(card.id) && card.positions.includes("Closed"),
      )
      .map((card) => card.id);
    expect(closedMoves).toEqual(["mov_001", "mov_013"]);

    const instances = content.decks.starter.flatMap((entry) =>
      Array.from({ length: entry.count }, (_, copy) => `${entry.cardId}:${copy}`),
    );
    let matchingHands = 0;
    let handsWithClosed = 0;
    let handsWithClosedMatch = 0;
    for (let first = 0; first < instances.length; first += 1)
      for (let second = first + 1; second < instances.length; second += 1)
        for (let third = second + 1; third < instances.length; third += 1)
          for (let fourth = third + 1; fourth < instances.length; fourth += 1) {
            const hand = [first, second, third, fourth].map(
              (index) => cardsById[instances[index]!.split(":")[0]!]!,
            );
            const positions = hand.filter((card) => card.type === "position");
            const moves = hand.filter((card): card is MoveCard => card.type === "move");
            if (
              positions.some((position) =>
                moves.some((move) => move.positions.includes(position.position)),
              )
            )
              matchingHands += 1;
            if (positions.some((position) => position.position === "Closed")) {
              handsWithClosed += 1;
              if (moves.some((move) => move.positions.includes("Closed")))
                handsWithClosedMatch += 1;
            }
          }
    expect({ matchingHands, handsWithClosed, handsWithClosedMatch }).toEqual({
      matchingHands: 64,
      handsWithClosed: 35,
      handsWithClosedMatch: 25,
    });
  });

  it("records the audited entry compatibility for all Moves", () => {
    const expected: Record<string, Position[]> = {
      mov_001: ["Open", "Closed", "Half-Open"],
      mov_002: ["Open", "Half-Open"],
      mov_003: ["Open", "Half-Open"],
      mov_004: ["Open", "Half-Open"],
      mov_005: ["Open", "Half-Open"],
      mov_013: ["Closed", "Half-Closed"],
      mov_006: ["Open", "Closed", "Half-Open", "Half-Closed"],
      mov_007: ["Open", "Closed", "Half-Open", "Half-Closed"],
      mov_008: ["Open", "Closed", "Half-Open", "Half-Closed"],
      mov_009: ["Open", "Half-Open"],
      mov_010: ["Open", "Half-Open"],
      mov_011: ["Open", "Half-Open"],
      mov_012: ["Open", "Half-Open"],
    };

    for (const [id, positions] of Object.entries(expected)) {
      const card = cardsById[id];
      expect(card?.type).toBe("move");
      if (card?.type === "move") expect(card.positions).toEqual(positions);
    }
  });
});
