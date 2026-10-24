import type { Rung } from "@clave/engine";

/**
 * The resolution ladder: the rung every 8-count ends on (docs/rules/game-rules.md §6.5).
 * One table, so the phrase strip, the handoff and the end-of-song recap all say the
 * rulebook's words — Perfect, Clean, Awkward, Recovered, Break — and say them the same.
 */
export const LADDER_RUNGS = ["perfect", "clean", "awkward", "recovered", "break"] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

export interface RungCopy {
  /** A mark to scan a row of 8-counts by. */
  readonly glyph: string;
  /** The rulebook's name for the rung, in one word. */
  readonly word: string;
  /** What landing there means, in a phrase. */
  readonly meaning: string;
  /** The rung and its reason, as a screen reader hears it. */
  readonly said: string;
}

export const RUNGS: Record<Rung, RungCopy> = {
  pending: {
    glyph: "·",
    word: "Dancing",
    meaning: "still on the floor",
    said: "Still dancing",
  },
  perfect: {
    glyph: "★",
    word: "Perfect",
    meaning: "a call answered with a Move",
    said: "Perfect: the call answered",
  },
  clean: {
    glyph: "●",
    word: "Clean",
    meaning: "a Move danced, nothing called",
    said: "Clean: a Move, no call standing",
  },
  awkward: {
    glyph: "∼",
    word: "Awkward",
    meaning: "the basic or a hold alone, or a dropped call",
    said: "Awkward: no Move, or the call dropped",
  },
  recovered: {
    glyph: "↺",
    word: "Recovered",
    meaning: "a call covered with a Recovery",
    said: "Recovered: the call covered",
  },
  break: {
    glyph: "×",
    word: "Break",
    meaning: "a stumble, then back to the basic",
    said: "Break: a stumble",
  },
};

/** The rung in one word, for a recap line or a handoff. */
export function rungLabel(rung: Rung): string {
  return RUNGS[rung].word;
}

/** Recorded 8-counts always ended somewhere; "pending" is the rung of one still being danced. */
export const isLadderRung = (rung: Rung): rung is LadderRung => rung !== "pending";
