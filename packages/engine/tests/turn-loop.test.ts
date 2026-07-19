import { describe, expect, it } from "vitest";
import { applyOk, playBasicGame, readyGame } from "./helpers.js";

describe("turn loop · rulebook §5", () => {
  it("alternates Lead-first through all sixteen counts and scores both phrase ends", () => {
    const { state, actions } = playBasicGame(101);
    expect(state.status).toBe("completed");
    expect(state.songIndex).toBe(15);
    expect(actions.filter((action) => action.type === "FRESHEN")).toHaveLength(16);
    expect(state.shared.style).toBeGreaterThanOrEqual(6);
    expect(state.finalScore).toBe(state.shared.style + state.shared.connection);
    expect(state.table.position).toBeNull();
  });

  it("discards freely and deterministically reshuffles when the draw pile empties", () => {
    let state = readyGame(202);
    const role = state.activeRole;
    state = applyOk(state, { type: "END_DANCE", role });
    state = applyOk(state, { type: "END_LESSON", role });
    state.players[role].drawPile = [];
    state.players[role].discardPile.push(...state.players[role].hand.slice(0, 2));
    state.players[role].hand = state.players[role].hand.slice(2);
    state = applyOk(state, { type: "FRESHEN", role, discardInstanceIds: [] });
    expect(state.players[role].hand).toHaveLength(4);
  });
});
