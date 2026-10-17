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
  floorDraggableIds,
  reconcileIntent,
  resolveDrop,
  stagedPosition,
  unavailableReason,
  type TurnIntent,
} from "../src/turn-intent.js";

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** Instance IDs deliberately differ from card IDs so the two cannot be confused. */
const id = (cardId: string) => `lead-hand-${cardId}`;

/** The Lead's first dance step on the starting Open Position, with a hand of known cards. */
function establishedState(): GameState {
  let state = createGame({ seed: 42, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
  state.players.lead.hand = ["pos_002", "mov_013", "pos_001", "mov_002", "rec_001"].map(
    (cardId) => ({ instanceId: id(cardId), cardId, owner: "lead" as const }),
  );
  return state;
}

/** The Lead's first dance step with an empty floor and a hand of known cards. */
function openingState(): GameState {
  const state = establishedState();
  state.players.lead.discardPile.push(state.table.position!);
  state.table.position = null;
  return state;
}

const staged = (positionInstanceId: string): TurnIntent => ({
  stagedPositionId: positionInstanceId,
});

describe("opening with no staged Position", () => {
  it("lets only Positions that open a legal pair be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(floorDraggableIds(view, NO_INTENT)).toEqual(new Set([id("pos_002"), id("pos_001")]));
  });

  it("stages a dropped Position without dispatching", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, id("pos_002"))).toEqual({
      kind: "stage",
      intent: staged(id("pos_002")),
    });
  });

  it("ignores a dropped Move before a Position is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, id("mov_013"))).toEqual({ kind: "ignore" });
  });

  it("has no staged Position card", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(stagedPosition(view, NO_INTENT)).toBeNull();
  });
});

describe("opening with a staged Position", () => {
  it("lets only the Moves paired with the staged Position be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(floorDraggableIds(view, staged(id("pos_002")))).toEqual(new Set([id("mov_013")]));
    expect(floorDraggableIds(view, staged(id("pos_001")))).toEqual(new Set([id("mov_002")]));
  });

  it("exposes the staged Position card from the hand", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(stagedPosition(view, staged(id("pos_002")))?.cardId).toBe("pos_002");
  });

  it("dispatches the opening pair and clears the intent when its Move is dropped", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, staged(id("pos_002")), id("mov_013"))).toEqual({
      kind: "dispatch",
      action: {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: id("pos_002"),
        moveInstanceId: id("mov_013"),
      },
      intent: NO_INTENT,
    });
  });

  it("ignores a Move that does not pair with the staged Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(resolveDrop(view, staged(id("pos_002")), id("mov_002"))).toEqual({ kind: "ignore" });
  });
});

describe("with a Position on the table", () => {
  function tableState(): GameState {
    const state = openingState();
    return applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: id("pos_002"),
      moveInstanceId: id("mov_013"),
    });
  }

  it("lets cards with a legal floor action be dragged", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(floorDraggableIds(view, NO_INTENT)).toEqual(new Set([id("pos_001")]));
  });

  it("dispatches the card's floor action on drop", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, id("pos_001"))).toEqual({
      kind: "dispatch",
      action: { type: "TRANSITION", role: "lead", positionInstanceId: id("pos_001") },
      intent: NO_INTENT,
    });
  });

  it("ignores a card with no floor action", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expect(resolveDrop(view, NO_INTENT, id("mov_002"))).toEqual({ kind: "ignore" });
  });
});

describe("when it is not the viewer's dance step", () => {
  it("lets nothing be dragged by the waiting partner", () => {
    const view = snapshotFor(openingState(), "follow", content);
    expect(floorDraggableIds(view, NO_INTENT).size).toBe(0);
  });

  it("lets nothing be dragged outside the dance phase", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(floorDraggableIds(view, NO_INTENT).size).toBe(0);
  });
});

describe("reconcileIntent", () => {
  it("keeps a staged Position that can still open", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const intent = staged(id("pos_002"));
    expect(reconcileIntent(view, intent)).toBe(intent);
  });

  it("keeps the staged Position across an unrelated action", () => {
    const state = applyOk(openingState(), {
      type: "SIGNAL_CARD",
      role: "lead",
      instanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged(id("pos_002")))).toEqual(staged(id("pos_002")));
  });

  it("clears a staged Position that left the hand", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("pos_002"),
    );
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged(id("pos_002")))).toEqual(NO_INTENT);
  });

  it("clears the staged Position once a Position reaches the table", () => {
    const state = applyOk(openingState(), {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: id("pos_001"),
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged(id("pos_002")))).toEqual(NO_INTENT);
  });

  it("clears the staged Position when the phase moves on", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(reconcileIntent(view, staged(id("pos_002")))).toEqual(NO_INTENT);
  });

  it("clears the staged Position for a viewer whose step it is not", () => {
    const view = snapshotFor(openingState(), "follow", content);
    expect(reconcileIntent(view, staged(id("pos_002")))).toEqual(NO_INTENT);
  });

  it("clears a staged card that does not open a legal pair", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(reconcileIntent(view, staged(id("mov_013")))).toEqual(NO_INTENT);
  });

  it("leaves no intent untouched", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(reconcileIntent(view, NO_INTENT)).toBe(NO_INTENT);
  });
});

describe("unavailableReason on an established floor", () => {
  it("names the Positions a mismatched Move needs and the floor Position", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("mov_013"))).toBe(
      "Needs Closed or Half-Closed · Floor is Open",
    );
  });

  it("asks for the Move before a Position", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("pos_002"))).toBe("Play a Move first");
  });

  it("points a Recovery card at Stumble", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("rec_001"))).toBe("Use with Stumble");
  });

  it("asks for the Move before a Flourish", () => {
    const state = establishedState();
    state.players.lead.hand.push({ instanceId: id("flo_001"), cardId: "flo_001", owner: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("flo_001"))).toBe("Play a Move first");
  });
});

describe("unavailableReason on an empty floor", () => {
  it("asks for a staged Position before a Move", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("mov_013"))).toBe("Stage a Position first");
  });

  it("explains a Position that no Move in hand can dance from", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("mov_002"),
    );
    const view = snapshotFor(state, "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("pos_001"))).toBe(
      "No Move in hand dances from Open",
    );
  });

  it("holds other Positions back while one is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(unavailableReason(view, staged(id("pos_002")), id("pos_001"))).toBe(
      "A Position is already staged",
    );
  });

  it("names what a Move needs when it does not pair with the staged Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(unavailableReason(view, staged(id("pos_001")), id("mov_013"))).toBe(
      "Needs Closed or Half-Closed · Open is staged",
    );
  });

  it("points a Recovery card at Stumble", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("rec_001"))).toBe("Use with Stumble");
  });

  it("has nothing to explain for a card that can be played", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(unavailableReason(view, NO_INTENT, id("pos_002"))).toBeNull();
    expect(unavailableReason(view, staged(id("pos_002")), id("mov_013"))).toBeNull();
  });

  it("explains nothing to the waiting partner", () => {
    const state = openingState();
    state.players.follow.hand = [
      { instanceId: "follow-mov_013", cardId: "mov_013", owner: "follow" },
    ];
    const view = snapshotFor(state, "follow", content);
    expect(unavailableReason(view, NO_INTENT, "follow-mov_013")).toBeNull();
  });
});
