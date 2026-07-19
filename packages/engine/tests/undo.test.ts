import { content, hashCanonical } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyOk, readyGame, setHand } from "./helpers.js";

describe("undo · FR-13", () => {
  it("restores the active player's turn checkpoint, including score, hand, table, market, and RNG", () => {
    let state = readyGame();
    setHand(state, "lead", ["pos_001", "mov_005", "pos_002", "flo_001"]);
    state.checkpoint = {
      ...state.checkpoint!,
      players: structuredClone(state.players),
      table: structuredClone(state.table),
      shared: structuredClone(state.shared),
      market: structuredClone(state.market),
      phrase: structuredClone(state.phrase),
      moveHistory: structuredClone(state.moveHistory),
      turnDance: structuredClone(state.turnDance),
    };
    const checkpointHash = hashCanonical(state.checkpoint);
    const [position, move] = state.players.lead.hand;
    state = applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: position!.instanceId,
      moveInstanceId: move!.instanceId,
    });
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state.players.lead.money = 5;
    state = applyOk(state, {
      type: "BUY_LESSON",
      role: "lead",
      source: "intermediate",
      cardId: state.market.intermediateDisplay[0]!,
    });
    state = applyOk(state, { type: "UNDO_TURN", role: "lead" });
    expect(
      hashCanonical({
        players: state.players,
        table: state.table,
        shared: state.shared,
        market: state.market,
        phrase: state.phrase,
        moveHistory: state.moveHistory,
        rngState: state.rngState,
        nextInstance: state.nextInstance,
        turnDance: state.turnDance,
        signal: state.signal,
      }),
    ).toBe(checkpointHash);
    expect(state.phase).toBe("dance");
    expect(state.contentHash).toBeTruthy();
    expect(content.rules.lessonCosts.intermediate).toBe(2);
  });
});
