import { describe, expect, it } from "vitest";
import {
  BonusConditionSchema,
  IMPLEMENTED_OPS,
  cardsById,
  canonicalStringify,
  content,
  contentBytes,
  contentHash,
  parseContentBytes,
  sha256Hex,
  verifyContentHash,
  type BonusCondition,
  type FlourishCard,
  type MoveCard,
  type Position,
} from "../src/index.js";

const count = (entries: readonly { count: number }[]) =>
  entries.reduce((sum, entry) => sum + entry.count, 0);

describe("v1 content", () => {
  it("matches the card-list counts", () => {
    expect(count(content.decks.starter)).toBe(8);
    expect(count(content.decks.intermediate)).toBe(20);
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

  it("resumes legacy embedded content without adding a preset Position to new games", () => {
    const legacyContent = {
      ...content,
      rules: { ...content.rules, startingPosition: "Open" },
    };
    const legacyBytes = canonicalStringify(legacyContent);
    expect(verifyContentHash(legacyBytes, sha256Hex(legacyBytes))).toEqual(legacyContent);
    expect(content.rules).not.toHaveProperty("startingPosition");
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

  it("gives the starter two real ways to dance from Closed and a Flourish to answer with", () => {
    expect(content.decks.starter).toEqual([
      { cardId: "pos_001", count: 2 },
      { cardId: "pos_002", count: 1 },
      { cardId: "mov_001", count: 1 },
      { cardId: "mov_002", count: 1 },
      { cardId: "mov_003", count: 1 },
      { cardId: "mov_013", count: 1 },
      { cardId: "flo_003", count: 1 },
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
    let hands = 0;
    let matchingHands = 0;
    let handsWithClosed = 0;
    let handsWithClosedMatch = 0;
    let handsWithoutPosition = 0;
    let handsWithFlourish = 0;
    for (let first = 0; first < instances.length; first += 1)
      for (let second = first + 1; second < instances.length; second += 1)
        for (let third = second + 1; third < instances.length; third += 1)
          for (let fourth = third + 1; fourth < instances.length; fourth += 1) {
            const hand = [first, second, third, fourth].map(
              (index) => cardsById[instances[index]!.split(":")[0]!]!,
            );
            const positions = hand.filter((card) => card.type === "position");
            const moves = hand.filter((card): card is MoveCard => card.type === "move");
            hands += 1;
            if (
              positions.some((position) =>
                moves.some((move) => move.positions.includes(position.position)),
              )
            )
              matchingHands += 1;
            if (positions.length === 0) handsWithoutPosition += 1;
            if (hand.some((card) => card.type === "flourish")) handsWithFlourish += 1;
            if (positions.some((position) => position.position === "Closed")) {
              handsWithClosed += 1;
              if (moves.some((move) => move.positions.includes("Closed")))
                handsWithClosedMatch += 1;
            }
          }
    expect({
      hands,
      matchingHands,
      handsWithClosed,
      handsWithClosedMatch,
      handsWithoutPosition,
      handsWithFlourish,
    }).toEqual({
      hands: 70,
      matchingHands: 62,
      handsWithClosed: 35,
      handsWithClosedMatch: 25,
      handsWithoutPosition: 5,
      handsWithFlourish: 35,
    });
  });

  it("keeps Ponche a phrase-ending accent rather than a Style card", () => {
    const ponche = cardsById["flo_005"];
    expect(ponche).toMatchObject({
      id: "flo_005",
      name: "Ponche",
      tier: "B",
      type: "flourish",
      positions: "any",
      style: 0,
      pose: true,
    });
    expect(content.decks.beginnerSupply).toContain("flo_005");
    const handTwist = cardsById["flo_003"] as FlourishCard;
    expect((ponche as FlourishCard).style).toBeLessThan(handTwist.style);
  });

  it("sends private lessons to the top of the draw pile and group classes to the discard", () => {
    expect(content.rules.lessonToDrawTop).toEqual({
      beginner: false,
      intermediate: true,
      advanced: true,
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

const callRules = () => {
  const rules = content.rules.call;
  if (!rules) throw new Error("The v1 content defines the calls.");
  return rules;
};

/** Could a pair holding only starter cards satisfy `condition`? */
function answerableFromStarter(condition: BonusCondition): boolean {
  const starter = content.decks.starter.map((entry) => cardsById[entry.cardId]!);
  const moves = starter.filter((card): card is MoveCard => card.type === "move");
  const positions = starter.filter((card) => card.type === "position");
  switch (condition.op) {
    case "moveStyleAtLeast":
      return moves.some((move) => move.style >= condition.value);
    case "moveFrom":
      return moves.some((move) =>
        move.positions.some((position) => condition.positions.includes(position)),
      );
    case "flourishPlayed":
      return starter.some((card) => card.type === "flourish");
    case "positionChanged":
      return new Set(positions.map((card) => card.type === "position" && card.position)).size > 1;
    case "partnerPlayedMovePhrase":
      // Both players deal from the same starter, so any Move the caller danced can be echoed.
      return moves.length > 0;
    default:
      return false;
  }
}

describe("the call · rulebook §7.1", () => {
  it("prints the seven calls with their asks and Style", () => {
    expect(
      callRules().options.map(({ id, name, style, condition }) => ({ id, name, style, condition })),
    ).toEqual([
      {
        id: "call_001",
        name: "Stay with me",
        style: 0,
        condition: { op: "moveStyleAtLeast", value: 0 },
      },
      {
        id: "call_002",
        name: "Open it up",
        style: 1,
        condition: { op: "moveFrom", positions: ["Open", "Half-Open"] },
      },
      { id: "call_003", name: "Change the room", style: 3, condition: { op: "positionChanged" } },
      { id: "call_004", name: "Echo me", style: 2, condition: { op: "partnerPlayedMovePhrase" } },
      {
        id: "call_005",
        name: "Stay close",
        style: 4,
        condition: { op: "moveFrom", positions: ["Closed", "Half-Closed"] },
      },
      { id: "call_006", name: "Style it", style: 4, condition: { op: "flourishPlayed" } },
      {
        id: "call_007",
        name: "Show me something",
        style: 8,
        condition: { op: "moveStyleAtLeast", value: 3 },
      },
    ]);
    for (const option of callRules().options) expect(option.ask.length).toBeGreaterThan(0);
  });

  it("sets the afinque table, the in-the-pocket Style, and the dropped-call cost", () => {
    expect(callRules()).toMatchObject({
      missConnectionCost: 1,
      inPocketStyle: 1,
      afinqueBonus: [0, 0, 1, 1, 2],
      resetAfinqueAtPhraseEnd: true,
    });
  });

  it("prints a favoured call on every 8-count a call can be made on", () => {
    expect(content.song.cards.map((song) => song.favouredCall ?? null)).toEqual([
      "call_001",
      "call_002",
      "call_003",
      "call_002",
      "call_005",
      "call_004",
      "call_006",
      null,
      "call_003",
      "call_004",
      "call_007",
      "call_006",
      "call_004",
      "call_006",
      "call_006",
      null,
    ]);
    const ids = new Set(callRules().options.map((option) => option.id));
    for (const song of content.song.cards)
      if (song.favouredCall) expect(ids.has(song.favouredCall)).toBe(true);
  });

  it("only favours a call the starter deck can answer before the montuno", () => {
    const options = new Map(callRules().options.map((option) => [option.id, option]));
    for (const song of content.song.cards.slice(0, 8)) {
      if (!song.favouredCall) continue;
      const option = options.get(song.favouredCall)!;
      expect({
        song: song.id,
        call: option.id,
        answerable: answerableFromStarter(option.condition),
      }).toEqual({ song: song.id, call: option.id, answerable: true });
    }
    expect(content.song.cards.slice(0, 8).map((song) => song.favouredCall)).not.toContain(
      "call_007",
    );
  });

  it("implements every condition the content asks for", () => {
    const used: BonusCondition["op"][] = [
      ...content.song.cards.flatMap((song) => song.bonuses.map((bonus) => bonus.condition.op)),
      ...callRules().options.map((option) => option.condition.op),
    ];
    for (const op of used) expect(IMPLEMENTED_OPS).toContain(op);
    // The list is the engine's side of the bargain, so it has to name the whole union: an op
    // the schema accepts and the list omits would pass the loop above by never being used.
    expect([...IMPLEMENTED_OPS].sort()).toEqual(
      BonusConditionSchema.options.map((option) => option.shape.op.value).sort(),
    );
  });

  it("describes every song card with the numbers it actually awards", () => {
    for (const song of content.song.cards)
      for (const { effect } of song.bonuses) {
        if (effect.style > 0) expect(song.description).toContain(`+${effect.style} Style`);
        if (effect.connection > 0)
          expect(song.description).toContain(`+${effect.connection} Connection`);
      }
  });

  it("builds the montuno's crescendo out of the song card Style", () => {
    const styleOf = (index: number) => content.song.cards[index]!.bonuses[0]!.effect.style;
    const cuerpo = content.song.cards
      .slice(0, 8)
      .reduce((sum, _, index) => sum + styleOf(index), 0);
    const montuno = content.song.cards
      .slice(8)
      .reduce((sum, _, index) => sum + styleOf(index + 8), 0);
    expect(montuno).toBeGreaterThan(cuerpo * 2);
    expect(styleOf(15)).toBe(7);
  });

  it("still parses and verifies content stored before the call existed", () => {
    const legacyRules = { ...content.rules };
    delete legacyRules.call;
    delete legacyRules.lessonToDrawTop;
    const legacy = {
      ...content,
      rules: legacyRules,
      cards: content.cards.filter((card) => card.id !== "flo_005"),
      song: {
        ...content.song,
        cards: content.song.cards.map((song) => {
          const stored = { ...song };
          delete stored.favouredCall;
          return stored;
        }),
      },
    };
    const legacyBytes = canonicalStringify(legacy);
    const resumed = verifyContentHash(legacyBytes, sha256Hex(legacyBytes));
    expect(resumed.rules.call).toBeUndefined();
    expect(resumed.rules.lessonToDrawTop).toBeUndefined();
    expect(resumed.song.cards[0]!.favouredCall).toBeUndefined();
  });
});
