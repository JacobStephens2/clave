import { content } from "@clave/content";
import { applyAction, createGame, snapshotFor, type GameAction, type GameState } from "@clave/engine";
import { describe, expect, it } from "vitest";
import { NO_INTENT, draggableCardIds } from "../src/turn-intent.js";

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** The Lead's first dance step with an empty floor and a hand of known cards. */
function openingState(): GameState {
  let state = createGame({ seed: 42, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
  state.players.lead.discardPile.push(state.table.position!);
  state.table.position = null;
  state.players.lead.hand = ["pos_002", "mov_013", "pos_001", "mov_002", "rec_001"].map(
    (cardId) => ({ instanceId: cardId, cardId, owner: "lead" as const }),
  );
  return state;
}

describe("opening with no staged Position", () => {
  it("lets only Positions that open a legal pair be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(draggableCardIds(view, NO_INTENT)).toEqual(new Set(["pos_002", "pos_001"]));
  });
});
