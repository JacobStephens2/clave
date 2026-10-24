import { describe, expect, it } from "vitest";
import { applyOk, playBasicGame, readyGame } from "./helpers.js";

describe("turn loop · rulebook §5", () => {
  it("alternates Lead-first through all sixteen counts and scores both phrase ends", () => {
    const { state, actions } = playBasicGame(101);
    expect(state.status).toBe("completed");
    expect(state.songIndex).toBe(15);
    expect(actions.filter((action) => action.type === "END_LESSON")).toHaveLength(16);
    expect(state.danceHistory).toHaveLength(16);
    expect(state.danceHistory.filter((entry) => entry.phrase === 1)).toHaveLength(8);
    expect(state.danceHistory.filter((entry) => entry.phrase === 2)).toHaveLength(8);
    expect(state.danceHistory.map((entry) => entry.songIndex)).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
    expect(state.shared.style).toBeGreaterThanOrEqual(6);
    expect(state.finalScore).toBe(state.shared.style + state.shared.connection);
    expect(state.table.position).toBeNull();
  });

  it("discards the entire remaining hand before drawing four replacements", () => {
    let state = readyGame(202);
    const role = state.activeRole;
    const handBeforeCleanup = [...state.players[role].hand];
    const replacements = ["mov_001", "mov_002", "pos_001", "pos_002"].map((cardId, index) => ({
      instanceId: `replacement-${index}`,
      cardId,
      owner: role,
    }));
    state = applyOk(state, { type: "END_DANCE", role, callId: null });
    state.players[role].drawPile = replacements;
    state.players[role].discardPile = [];
    state = applyOk(state, { type: "END_LESSON", role });
    expect(state.players[role].hand).toEqual(replacements);
    expect(state.players[role].discardPile).toEqual(handBeforeCleanup);
    expect(state.activeRole).not.toBe(role);
    expect(state.phase).toBe("dance");
  });

  it("deterministically reshuffles the discarded hand when the draw pile is empty", () => {
    let state = readyGame(203);
    const role = state.activeRole;
    const handBeforeCleanup = [...state.players[role].hand];
    state = applyOk(state, { type: "END_DANCE", role, callId: null });
    state.players[role].drawPile = [];
    state = applyOk(state, { type: "END_LESSON", role });
    expect(state.players[role].hand).toHaveLength(4);
    expect(new Set(state.players[role].hand.map((card) => card.instanceId))).toEqual(
      new Set(handBeforeCleanup.map((card) => card.instanceId)),
    );
  });
});
