import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index.js";
import { applyOk, readyGame } from "./helpers.js";

describe("lessons · rulebook §8", () => {
  it("buys one Beginner card into the discard pile", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state = applyOk(state, {
      type: "BUY_LESSON",
      role: "lead",
      source: "beginner",
      cardId: "mov_005",
    });
    expect(state.players.lead.money).toBe(0);
    expect(state.players.lead.discardPile.some((entry) => entry.cardId === "mov_005")).toBe(true);
    const second = applyAction(
      state,
      { type: "BUY_LESSON", role: "lead", source: "beginner", cardId: "pos_001" },
      content,
    );
    expect(second.ok).toBe(false);
  });

  it("refills a private market and locks the teacher for the round", () => {
    let state = readyGame();
    state.players.lead.money = 3;
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    const chosen = state.market.intermediateDisplay[0]!;
    state = applyOk(state, {
      type: "BUY_LESSON",
      role: "lead",
      source: "intermediate",
      cardId: chosen,
    });
    expect(state.market.intermediateDisplay).toHaveLength(3);
    expect(state.phrase.privateLessonTakenThisRound).toBe(true);
  });

  it("learns for free from a partner once per phrase", () => {
    let state = readyGame();
    state.songIndex = 3;
    state.phase = "lesson";
    state.activeRole = "lead";
    state.moveHistory.push({
      cardId: "mov_007",
      role: "follow",
      phrase: 1,
      songIndex: 1,
      fromPosition: "Open",
    });
    state = applyOk(state, { type: "LEARN_FROM_PARTNER", role: "lead", cardId: "mov_007" });
    expect(state.players.lead.discardPile.some((entry) => entry.cardId === "mov_007")).toBe(true);
    expect(state.phrase.learnedBy.lead).toBe(true);
  });
});
