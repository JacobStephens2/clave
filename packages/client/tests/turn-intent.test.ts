import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  snapshotFor,
  type GameAction,
  type GameState,
} from "@clave/engine";
import { describe, expect, it } from "vitest";
import {
  NO_INTENT,
  draggableCardIds,
  reconcileIntent,
  resolveDrop,
  stagedPosition,
  type TurnIntent,
} from "../src/turn-intent.js";

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

const staged = (positionInstanceId: string): TurnIntent => ({
  stagedPositionId: positionInstanceId,
});

describe("opening with no staged Position", () => {
  it("lets only Positions that open a legal pair be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(draggableCardIds(view, NO_INTENT)).toEqual(new Set(["pos_002", "pos_001"]));
  });

  it("stages a dropped Position without dispatching", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, "pos_002")).toEqual({
      kind: "stage",
      intent: staged("pos_002"),
    });
  });

  it("ignores a dropped Move before a Position is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, "mov_013")).toEqual({ kind: "ignore" });
  });

  it("has no staged Position card", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(stagedPosition(view, NO_INTENT)).toBeNull();
  });
});

describe("opening with a staged Position", () => {
  it("lets only the Moves paired with the staged Position be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(draggableCardIds(view, staged("pos_002"))).toEqual(new Set(["mov_013"]));
    expect(draggableCardIds(view, staged("pos_001"))).toEqual(new Set(["mov_002"]));
  });

  it("exposes the staged Position card from the hand", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(stagedPosition(view, staged("pos_002"))?.cardId).toBe("pos_002");
  });

  it("dispatches the opening pair and clears the intent when its Move is dropped", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, staged("pos_002"), "mov_013")).toEqual({
      kind: "dispatch",
      action: {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: "pos_002",
        moveInstanceId: "mov_013",
      },
      intent: NO_INTENT,
    });
  });

  it("ignores a Move that does not pair with the staged Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, staged("pos_002"), "mov_002")).toEqual({ kind: "ignore" });
  });
});

describe("with a Position on the table", () => {
  function tableState(): GameState {
    const state = openingState();
    return applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: "pos_002",
      moveInstanceId: "mov_013",
    });
  }

  it("lets cards with a legal floor action be dragged", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(draggableCardIds(view, NO_INTENT)).toEqual(new Set(["pos_001"]));
  });

  it("dispatches the card's floor action on drop", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, "pos_001")).toEqual({
      kind: "dispatch",
      action: { type: "TRANSITION", role: "lead", positionInstanceId: "pos_001" },
      intent: NO_INTENT,
    });
  });

  it("ignores a card with no floor action", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, "mov_002")).toEqual({ kind: "ignore" });
  });
});

describe("when it is not the viewer's dance step", () => {
  it("lets nothing be dragged by the waiting partner", () => {
    const view = snapshotFor(openingState(), "follow", content);
    expect(draggableCardIds(view, NO_INTENT).size).toBe(0);
  });

  it("lets nothing be dragged outside the dance phase", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(draggableCardIds(view, NO_INTENT).size).toBe(0);
  });
});

describe("reconcileIntent", () => {
  it("keeps a staged Position that can still open", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const intent = staged("pos_002");
    expect(reconcileIntent(view, intent)).toBe(intent);
  });

  it("keeps the staged Position across an unrelated action", () => {
    const state = applyOk(openingState(), {
      type: "SIGNAL_CARD",
      role: "lead",
      instanceId: "mov_002",
    });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged("pos_002"))).toEqual(staged("pos_002"));
  });

  it("clears a staged Position that left the hand", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== "pos_002",
    );
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged("pos_002"))).toEqual(NO_INTENT);
  });

  it("clears the staged Position once a Position reaches the table", () => {
    const state = applyOk(openingState(), {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: "pos_001",
      moveInstanceId: "mov_002",
    });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged("pos_002"))).toEqual(NO_INTENT);
  });

  it("clears the staged Position when the phase moves on", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged("pos_002"))).toEqual(NO_INTENT);
  });

  it("clears the staged Position for a viewer whose step it is not", () => {
    const view = snapshotFor(openingState(), "follow", content);
    expect(reconcileIntent(view, staged("pos_002"))).toEqual(NO_INTENT);
  });

  it("clears a staged card that does not open a legal pair", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(reconcileIntent(view, staged("mov_013"))).toEqual(NO_INTENT);
  });

  it("leaves no intent untouched", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(reconcileIntent(view, NO_INTENT)).toBe(NO_INTENT);
  });
});
