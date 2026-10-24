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
  callHandoff,
  callMadeNote,
  readDanceStep,
  type CallPicker,
  type DanceStep,
  type HandOffer,
  type TurnIntent,
} from "../src/turn-intent.js";

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** Instance IDs deliberately differ from card IDs so the two cannot be confused. */
const id = (cardId: string) => `lead-hand-${cardId}`;

/** An established Open floor before a Move, with a hand of known cards. */
function establishedState(): GameState {
  let state = createGame({ seed: 42, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
  state.players.lead.hand = ["pos_002", "mov_013", "pos_001", "mov_002", "rec_001"].map(
    (cardId) => ({ instanceId: id(cardId), cardId, owner: "lead" as const }),
  );
  state.table.position = { instanceId: "previous-position", cardId: "pos_001", owner: "follow" };
  return state;
}

/** The Lead's first dance step with an empty floor and a hand of known cards. */
function openingState(): GameState {
  const state = establishedState();
  state.table.position = null;
  return state;
}

const staged = (positionInstanceId: string): TurnIntent => ({
  stagedPositionId: positionInstanceId,
});

/** The Follow's call standing over the Lead's 8-count, as END_DANCE would have left it. */
function withCall(state: GameState, callId: string, inPocket = false): GameState {
  state.call = { byRole: "follow", callId, forSongIndex: state.songIndex, inPocket };
  return state;
}

function pickerOf(step: DanceStep): CallPicker {
  const picker = step.telling?.picker;
  if (!picker) throw new Error("No call picker on this step");
  return picker;
}

function offerFor(step: DanceStep, instanceId: string): HandOffer {
  const offer = step.offers.find((entry) => entry.instanceId === instanceId);
  if (!offer) throw new Error(`No offer for ${instanceId}`);
  return offer;
}

/** Draggable, a play label, and a drop that plays are one fact. */
function expectPlayable(offer: HandOffer, playLabel: string, drop: HandOffer["drop"]) {
  expect(offer.draggable).toBe(true);
  expect(offer.playLabel).toBe(playLabel);
  expect(offer.drop).toEqual(drop);
}

function expectHeld(offer: HandOffer) {
  expect(offer.draggable).toBe(false);
  expect(offer.playLabel).toBeNull();
  expect(offer.drop).toEqual({ kind: "ignore" });
}

describe("opening with no staged Position", () => {
  it("lets only Positions that open a legal pair be dragged, and stages them", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.offers.filter((offer) => offer.draggable).map((offer) => offer.instanceId)).toEqual(
      [id("pos_002"), id("pos_001")],
    );
    expect(step.acceptsDrop).toBe(true);
    expectPlayable(offerFor(step, id("pos_002")), "Stage Position", {
      kind: "stage",
      intent: staged(id("pos_002")),
    });
    expectPlayable(offerFor(step, id("pos_001")), "Stage Position", {
      kind: "stage",
      intent: staged(id("pos_001")),
    });
    expect(offerFor(step, id("pos_002")).inRow).toBe(true);
  });

  it("holds a Move until a Position is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const offer = offerFor(readDanceStep(view, NO_INTENT), id("mov_013"));
    expectHeld(offer);
    expect(offer.sentence).toBe("Stage a Position first");
  });

  it("has no staged Position card", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.stagedPosition).toBeNull();
    expect(step.intent).toBe(NO_INTENT);
  });

  it("offers every hand card in hand order, each with its signal", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.offers.map((offer) => offer.instanceId)).toEqual(
      view.self.hand.map((entry) => entry.instanceId),
    );
    const signal = view.legalActions.find(
      (action) => action.type === "SIGNAL_CARD" && action.instanceId === id("mov_002"),
    );
    expect(offerFor(step, id("mov_002")).signal).toBe(signal);
    expect(step.clearSignal).toBeNull();
  });
});

describe("opening with a staged Position", () => {
  it("lets only the Moves paired with the staged Position be dragged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const closed = readDanceStep(view, staged(id("pos_002")));
    expect(
      closed.offers.filter((offer) => offer.draggable).map((offer) => offer.instanceId),
    ).toEqual([id("mov_013")]);
    const opening = view.legalActions.find(
      (action) =>
        action.type === "PLAY_OPEN" &&
        action.positionInstanceId === id("pos_002") &&
        action.moveInstanceId === id("mov_013"),
    );
    expectPlayable(offerFor(closed, id("mov_013")), "Dance move", {
      kind: "dispatch",
      action: opening!,
      intent: NO_INTENT,
    });
    if (offerFor(closed, id("mov_013")).drop.kind === "dispatch")
      expect(offerFor(closed, id("mov_013")).drop.action).toBe(opening);

    const open = readDanceStep(view, staged(id("pos_001")));
    expect(open.offers.filter((offer) => offer.draggable).map((offer) => offer.instanceId)).toEqual(
      [id("mov_002")],
    );
  });

  it("takes the staged Position out of the hand row and keeps it for the enlarged card", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, staged(id("pos_002")));
    expect(step.stagedPosition?.cardId).toBe("pos_002");
    const stagedOffer = offerFor(step, id("pos_002"));
    expect(stagedOffer.inRow).toBe(false);
    expect(stagedOffer.stagedNote).toBe("Staged on the floor, waiting for a matching Move");
    expectHeld(stagedOffer);
    expect(offerFor(step, id("pos_001")).inRow).toBe(true);
  });

  it("ignores a Move that does not pair with the staged Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const offer = offerFor(readDanceStep(view, staged(id("pos_002"))), id("mov_002"));
    expectHeld(offer);
    expect(offer.sentence).toBe("Needs Open or Half-Open · Closed is staged");
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

  it("lets a card with a legal floor action be dragged and dispatches that action", () => {
    const view = snapshotFor(tableState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.offers.filter((offer) => offer.draggable).map((offer) => offer.instanceId)).toEqual(
      [id("pos_001")],
    );
    const transition = view.legalActions.find((action) => action.type === "TRANSITION");
    expectPlayable(offerFor(step, id("pos_001")), "Transition", {
      kind: "dispatch",
      action: transition!,
      intent: NO_INTENT,
    });
    if (offerFor(step, id("pos_001")).drop.kind === "dispatch")
      expect(offerFor(step, id("pos_001")).drop.action).toBe(transition);
  });

  it("holds a card with no floor action", () => {
    const view = snapshotFor(tableState(), "lead", content);
    expectHeld(offerFor(readDanceStep(view, NO_INTENT), id("mov_002")));
  });
});

describe("when it is not the viewer's dance step", () => {
  it("lets the waiting partner drag nothing and grows no dance heading", () => {
    const view = snapshotFor(openingState(), "follow", content);
    const step = readDanceStep(view, staged(id("pos_002")));
    expect(step.intent).toBe(NO_INTENT);
    expect(step.acceptsDrop).toBe(false);
    expect(step.telling).toBeNull();
    expect(step.floorHint).toBe("Lead’s 8-count");
    expect(step.offers.every((offer) => !offer.draggable && offer.signal === null)).toBe(true);
  });

  it("lets nothing be dragged outside the dance phase", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(view.phase).toBe("lesson");
    expect(step.acceptsDrop).toBe(false);
    expect(step.telling).toBeNull();
    expect(step.floorHint).toBe("Your 8-count");
    expect(step.offers.every((offer) => !offer.draggable)).toBe(true);
  });
});

describe("reconciling a staged Position", () => {
  it("keeps the same intent object when the Position can still open", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const intent = staged(id("pos_002"));
    expect(readDanceStep(view, intent).intent).toBe(intent);
    expect(readDanceStep(view, intent).stagedPosition?.instanceId).toBe(id("pos_002"));
  });

  it("keeps the same intent object across an unrelated action", () => {
    const state = applyOk(openingState(), {
      type: "SIGNAL_CARD",
      role: "lead",
      instanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    const intent = staged(id("pos_002"));
    expect(readDanceStep(view, intent).intent).toBe(intent);
  });

  it("clears a staged Position that left the hand", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("pos_002"),
    );
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, staged(id("pos_002")));
    expect(step.intent).toBe(NO_INTENT);
    expect(step.stagedPosition).toBeNull();
  });

  it("clears the staged Position once a Position reaches the table", () => {
    const state = applyOk(openingState(), {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: id("pos_001"),
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(readDanceStep(view, staged(id("pos_002"))).intent).toBe(NO_INTENT);
  });

  it("clears the staged Position when the phase moves on", () => {
    const state = applyOk(openingState(), { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(readDanceStep(view, staged(id("pos_002"))).intent).toBe(NO_INTENT);
  });

  it("clears the staged Position for a viewer whose step it is not", () => {
    const view = snapshotFor(openingState(), "follow", content);
    expect(readDanceStep(view, staged(id("pos_002"))).intent).toBe(NO_INTENT);
  });

  it("clears a staged card that does not open a legal pair", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(readDanceStep(view, staged(id("mov_013"))).intent).toBe(NO_INTENT);
  });

  it("leaves no intent untouched", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(readDanceStep(view, NO_INTENT).intent).toBe(NO_INTENT);
  });
});

describe("the heading and the floor hint share one moment", () => {
  it("opens an empty floor by staging a Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.floorHint).toBe("Drag a highlighted Position here");
    expect(step.telling).toMatchObject({
      heading: "Open the floor with a Position",
      instruction: null,
      openingGuide:
        "Stage any highlighted Position from your hand, then add a Move that dances from it.",
    });
    expect(step.telling?.controls).toEqual({
      kind: "row",
      controls: [
        {
          kind: "end",
          action: { type: "END_DANCE", role: "lead", callId: null },
          label: "Dance the basic",
        },
        {
          kind: "stumble",
          action: { type: "STUMBLE", role: "lead", recoveryInstanceId: null },
          label: "Stumble · −2 Connection",
        },
        {
          kind: "stumble",
          action: { type: "STUMBLE", role: "lead", recoveryInstanceId: id("rec_001") },
          label: "Stumble · Return to Basic",
        },
        { kind: "undo", action: { type: "UNDO_TURN", role: "lead" }, label: "Reset turn" },
      ],
    });
  });

  it("completes a staged Position, and the return replaces end, Stumble, and undo", () => {
    const state = applyOk(openingState(), {
      type: "SIGNAL_CARD",
      role: "lead",
      instanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(view.legalActions.some((action) => action.type === "END_DANCE")).toBe(true);
    expect(view.legalActions.some((action) => action.type === "STUMBLE")).toBe(true);
    expect(view.legalActions.some((action) => action.type === "UNDO_TURN")).toBe(true);
    const step = readDanceStep(view, staged(id("pos_002")));
    expect(step.floorHint).toBe("Now drag a highlighted matching Move here");
    expect(step.telling).toEqual({
      heading: "Complete the opening",
      instruction: null,
      note: "The hold gives up this 8-count\u2019s song bonus.",
      openingGuide:
        "Closed Position is staged. Play a highlighted matching Move next. Or take the hold with it alone — that gives up the song bonus.",
      picker: null,
      controls: {
        kind: "return",
        label: "Return Position to hand",
        hold: {
          action: { type: "ADJUST", role: "lead", positionInstanceId: id("pos_002") },
          label: "Take the hold instead",
          note: "Opens the floor with this Position alone — gives up the song bonus.",
        },
      },
    });
    expect(step.clearSignal).toBe(
      view.legalActions.find((action) => action.type === "CLEAR_SIGNAL"),
    );
  });

  it("asks for a Move while the floor already has a Position and one can be played", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(view.legalActions.some((action) => action.type === "PLAY_MOVE")).toBe(true);
    expect(step.floorHint).toBe("Drag a highlighted Move here");
    expect(step.telling).toMatchObject({
      heading: "Play a Move first",
      instruction:
        "Current Position: Open. Play a Move whose top edge includes Open. A Position alone adjusts the hold instead, giving up the song bonus. Or choose Dance the basic or Stumble below.",
      openingGuide: null,
    });
    expectPlayable(offerFor(step, id("mov_002")), "Dance move", {
      kind: "dispatch",
      action: view.legalActions.find(
        (action) => action.type === "PLAY_MOVE" && action.moveInstanceId === id("mov_002"),
      )!,
      intent: NO_INTENT,
    });
  });

  it("offers the hold when no Move in hand dances from the floor", () => {
    const state = establishedState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("mov_002"),
    );
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(view.legalActions.some((action) => action.type === "PLAY_MOVE")).toBe(false);
    expect(step.floorHint).toBe("Drag a highlighted Position here for the hold");
    expect(step.telling).toMatchObject({
      heading: "Adjust the hold—or dance the basic",
      instruction:
        "No Move in your hand includes Open. A Position alone adjusts the hold: that gives up the song bonus, and you can still call.",
      openingGuide: null,
    });
    expect(step.acceptsDrop).toBe(true);
  });

  it("falls back to the active role when neither a Move nor the hold is available", () => {
    const state = establishedState();
    state.players.lead.hand = [{ instanceId: id("rec_001"), cardId: "rec_001", owner: "lead" }];
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(view.legalActions.some((action) => action.type === "PLAY_MOVE")).toBe(false);
    expect(view.legalActions.some((action) => action.type === "ADJUST")).toBe(false);
    expect(step.floorHint).toBe("Your 8-count");
    expect(step.telling).toMatchObject({
      heading: "Play a Move first",
      instruction: "No Move in your hand includes Open. Dance the basic or Stumble below.",
      openingGuide: null,
    });
    expect(step.acceptsDrop).toBe(false);
  });

  it("prefers a legal Transition over a legal Flourish in the heading and the hint", () => {
    let state = establishedState();
    state.players.lead.hand.push({ instanceId: id("flo_001"), cardId: "flo_001", owner: "lead" });
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: id("mov_002") });
    const view = snapshotFor(state, "lead", content);
    expect(view.legalActions.some((action) => action.type === "TRANSITION")).toBe(true);
    expect(view.legalActions.some((action) => action.type === "PLAY_FLOURISH")).toBe(true);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.floorHint).toBe("Now drag a highlighted Position here");
    expect(step.telling).toMatchObject({
      heading: "Move played — add a Position",
      instruction: "Your Move is on the floor. Add a highlighted Position or Flourish, or finish.",
      openingGuide: null,
    });
    expectPlayable(offerFor(step, id("flo_001")), "Flourish", {
      kind: "dispatch",
      action: view.legalActions.find((action) => action.type === "PLAY_FLOURISH")!,
      intent: NO_INTENT,
    });
  });

  it("offers a Flourish once no Transition is legal", () => {
    let state = establishedState();
    state.players.lead.hand.push({ instanceId: id("flo_001"), cardId: "flo_001", owner: "lead" });
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: id("mov_002") });
    state = applyOk(state, {
      type: "TRANSITION",
      role: "lead",
      positionInstanceId: id("pos_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(view.legalActions.some((action) => action.type === "TRANSITION")).toBe(false);
    expect(view.legalActions.some((action) => action.type === "PLAY_FLOURISH")).toBe(true);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.floorHint).toBe("Now drag a highlighted Flourish here");
    expect(step.telling).toMatchObject({
      heading: "Add a Flourish—or finish",
      instruction: "Your Move is on the floor. Add a highlighted Flourish, or finish the 8-count.",
      openingGuide: null,
    });
  });

  it("finishes the 8-count when nothing is left to play to the floor", () => {
    let state = establishedState();
    state.players.lead.hand = [
      { instanceId: id("mov_002"), cardId: "mov_002", owner: "lead" },
      { instanceId: id("rec_001"), cardId: "rec_001", owner: "lead" },
    ];
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: id("mov_002") });
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.floorHint).toBe("Your 8-count");
    expect(step.telling).toMatchObject({
      heading: "Finish the 8-count",
      instruction: "Your Move is on the floor. Finish the 8-count when you’re ready.",
      openingGuide: null,
      controls: {
        kind: "row",
        controls: [
          {
            kind: "end",
            action: { type: "END_DANCE", role: "lead", callId: null },
            label: "Take the song · +1 Connection",
          },
          { kind: "undo", action: { type: "UNDO_TURN", role: "lead" }, label: "Reset turn" },
        ],
      },
    });
  });

  it("names the other role's 8-count from the active role", () => {
    const view = snapshotFor(openingState(), "follow", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(view.activeRole).toBe("lead");
    expect(step.floorHint).toBe("Lead’s 8-count");
    expect(step.telling).toBeNull();
  });

  it("uses the active role on the Follow's own 8-count, not the role who confirmed", () => {
    let state = openingState();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    state.players.follow.hand = [{ instanceId: "follow-rec", cardId: "rec_001", owner: "follow" }];
    const view = snapshotFor(state, "follow", content);
    expect(view.activeRole).toBe("follow");
    expect(view.setupRole).not.toBe(view.activeRole);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.floorHint).toBe("Your 8-count");
    expect(step.telling?.heading).toBe("Finish the 8-count");
  });

  it("grows no dance heading during the opening hand", () => {
    const state = createGame({ seed: 42, content });
    const lead = readDanceStep(snapshotFor(state, "lead", content), NO_INTENT);
    const follow = readDanceStep(snapshotFor(state, "follow", content), NO_INTENT);
    expect(lead.telling).toBeNull();
    expect(lead.floorHint).toBe("Your 8-count");
    expect(follow.telling).toBeNull();
    expect(follow.floorHint).toBe("Lead’s 8-count");

    const confirmed = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    const followTurn = readDanceStep(snapshotFor(confirmed, "follow", content), NO_INTENT);
    const leadWaiting = readDanceStep(snapshotFor(confirmed, "lead", content), NO_INTENT);
    expect(snapshotFor(confirmed, "follow", content).activeRole).toBe("follow");
    expect(followTurn.telling).toBeNull();
    expect(followTurn.floorHint).toBe("Your 8-count");
    expect(leadWaiting.floorHint).toBe("Follow’s 8-count");
    expect(leadWaiting.telling).toBeNull();
  });
});

describe("sentences on an established floor", () => {
  it("names the Positions a mismatched Move needs and the floor Position", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("mov_013")).sentence).toBe(
      "Needs Closed or Half-Closed · Floor is Open",
    );
  });

  it("needs no sentence for a Position, which can adjust the hold before the Move", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(view.floorRefusals.map((entry) => entry.instanceId)).not.toContain(id("pos_002"));
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_002")).sentence).toBeNull();
  });

  it("points a Recovery card at Stumble", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("rec_001")).sentence).toBe(
      "Use with Stumble",
    );
  });

  it("asks for the Move before a Flourish", () => {
    const state = establishedState();
    state.players.lead.hand.push({ instanceId: id("flo_001"), cardId: "flo_001", owner: "lead" });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("flo_001")).sentence).toBe(
      "Play a Move first",
    );
  });

  it("explains a Flourish against where the Move started, even after a transition", () => {
    let state = establishedState();
    state.players.lead.hand.push({ instanceId: id("flo_004"), cardId: "flo_004", owner: "lead" });
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: id("mov_002") });
    state = applyOk(state, {
      type: "TRANSITION",
      role: "lead",
      positionInstanceId: id("pos_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("flo_004")).sentence).toBe(
      "Needs Closed · Move started from Open",
    );
  });

  it("explains why a second Flourish must wait for another 8-count", () => {
    let state = establishedState();
    state.players.lead.hand.push(
      { instanceId: id("flo_001"), cardId: "flo_001", owner: "lead" },
      { instanceId: id("flo_002"), cardId: "flo_002", owner: "lead" },
    );
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: id("mov_002") });
    state = applyOk(state, {
      type: "PLAY_FLOURISH",
      role: "lead",
      flourishInstanceId: id("flo_001"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("flo_002")).sentence).toBe(
      "You already added a Flourish this 8-count",
    );
  });

  it("explains why a held Move cannot follow the Move already danced", () => {
    const state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("mov_013")).sentence).toBe(
      "You already danced a Move this 8-count",
    );
  });

  it("explains a Position after the transition window has closed", () => {
    let state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    state = applyOk(state, {
      type: "TRANSITION",
      role: "lead",
      positionInstanceId: id("pos_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_001")).sentence).toBe(
      "Transition immediately after your Move",
    );
  });

  it("explains that Recovery belongs before playing dance cards", () => {
    const state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("rec_001")).sentence).toBe(
      "Use with Stumble before playing dance cards",
    );
  });
});

describe("sentences on an empty floor", () => {
  it("needs no sentence for a Position no Move dances from, which can take the hold", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("mov_002"),
    );
    const view = snapshotFor(state, "lead", content);
    expect(view.floorRefusals.map((entry) => entry.instanceId)).not.toContain(id("pos_001"));
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_001")).sentence).toBeNull();
  });

  it("holds other Positions back while one is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(offerFor(readDanceStep(view, staged(id("pos_002"))), id("pos_001")).sentence).toBe(
      "A Position is already staged",
    );
  });

  it("names what a Move needs when it does not pair with the staged Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(offerFor(readDanceStep(view, staged(id("pos_001"))), id("mov_013")).sentence).toBe(
      "Needs Closed or Half-Closed · Open is staged",
    );
  });

  it("points a Recovery card at Stumble", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("rec_001")).sentence).toBe(
      "Use with Stumble",
    );
  });

  it("has nothing to explain for a card that can be played", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_002")).sentence).toBeNull();
    expect(offerFor(readDanceStep(view, staged(id("pos_002"))), id("mov_013")).sentence).toBeNull();
  });

  it("explains nothing to the waiting partner", () => {
    const state = openingState();
    state.players.follow.hand = [
      { instanceId: "follow-mov_013", cardId: "mov_013", owner: "follow" },
    ];
    const view = snapshotFor(state, "follow", content);
    expect(offerFor(readDanceStep(view, NO_INTENT), "follow-mov_013").sentence).toBeNull();
  });

  it("shows no sentence for a position-limit code", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    view.floorRefusals = view.floorRefusals.map((entry) =>
      entry.instanceId === id("pos_002") ? { ...entry, code: "POSITION_LIMIT" } : entry,
    );
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_002")).sentence).toBeNull();
  });
});

describe("lesson sentences", () => {
  function lessonStep(): GameState {
    return applyOk(establishedState(), { type: "END_DANCE", role: "lead" });
  }

  it("says to learn after the dance during the dance step", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    const cardId = view.market.intermediate[0]!.id;
    expect(readDanceStep(view, NO_INTENT).lessonSentence("intermediate", cardId)).toBe(
      "Learn after you dance this 8-count",
    );
  });

  it("says to learn on your own turn for the waiting partner", () => {
    const view = snapshotFor(establishedState(), "follow", content);
    const cardId = view.market.beginner[0]!.id;
    expect(readDanceStep(view, NO_INTENT).lessonSentence("beginner", cardId)).toBe(
      "Learn on your turn, after you dance",
    );
  });

  it("shows the money sentence when the private lesson is also already taken", () => {
    const state = lessonStep();
    state.players.lead.money = 0;
    state.phrase.privateLessonTakenThisRound = true;
    const cardId = state.market.intermediateDisplay[0]!;
    const view = snapshotFor(state, "lead", content);
    expect(view.lessonRefusals).toContainEqual({
      source: "intermediate",
      cardId,
      code: "NOT_ENOUGH_MONEY",
    });
    expect(readDanceStep(view, NO_INTENT).lessonSentence("intermediate", cardId)).toBe(
      "Costs $2 · you have $0",
    );
  });

  it("names the private lesson once the viewer can afford it", () => {
    const state = lessonStep();
    state.players.lead.money = 5;
    state.phrase.privateLessonTakenThisRound = true;
    const cardId = state.market.intermediateDisplay[0]!;
    const view = snapshotFor(state, "lead", content);
    expect(readDanceStep(view, NO_INTENT).lessonSentence("intermediate", cardId)).toBe(
      "Private lesson already taken this round",
    );
  });

  it("says the lesson was already taken this turn", () => {
    let state = lessonStep();
    state = applyOk(state, {
      type: "BUY_LESSON",
      role: "lead",
      source: "beginner",
      cardId: "flo_003",
    });
    const view = snapshotFor(state, "lead", content);
    expect(readDanceStep(view, NO_INTENT).lessonSentence("beginner", "pos_001")).toBe(
      "You already took a lesson this turn",
    );
  });

  it("shows no sentence for a closed advanced lesson", () => {
    const state = lessonStep();
    state.players.lead.money = 10;
    state.market.advancedDisplay = ["flo_004"];
    const view = snapshotFor(state, "lead", content);
    expect(view.lessonRefusals).toContainEqual({
      source: "advanced",
      cardId: "flo_004",
      code: "ADVANCED_CLOSED",
    });
    expect(readDanceStep(view, NO_INTENT).lessonSentence("advanced", "flo_004")).toBeNull();
  });

  it("has nothing to explain for a lesson the reducer accepts", () => {
    const view = snapshotFor(lessonStep(), "lead", content);
    expect(readDanceStep(view, NO_INTENT).lessonSentence("beginner", "flo_003")).toBeNull();
  });

  it("maps a money code from the snapshot even when the viewer could afford the card", () => {
    const state = lessonStep();
    state.players.lead.money = 5;
    const view = snapshotFor(state, "lead", content);
    const cardId = view.market.intermediate[0]!.id;
    view.lessonRefusals = [{ source: "intermediate", cardId, code: "NOT_ENOUGH_MONEY" }];
    expect(readDanceStep(view, NO_INTENT).lessonSentence("intermediate", cardId)).toBe(
      "Costs $2 · you have $5",
    );
  });
});

describe("ending the dance step", () => {
  it("names what taking the song pays, from the snapshot's own bonus", () => {
    const state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(view.turn.songBonus).toEqual({ style: 0, connection: 1 });
    const step = readDanceStep(view, NO_INTENT);
    const controls = step.telling?.controls;
    expect(controls?.kind).toBe("row");
    expect(controls?.kind === "row" && controls.controls[0]).toMatchObject({
      kind: "end",
      label: "Take the song · +1 Connection",
    });
  });

  it("keeps the plain labels when the song pays nothing", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(view.turn.songBonus).toBeNull();
    const step = readDanceStep(view, NO_INTENT);
    const controls = step.telling?.controls;
    expect(controls?.kind).toBe("row");
    expect(controls?.kind === "row" && controls.controls[0]).toMatchObject({
      kind: "end",
      label: "Dance the basic",
    });
  });

  it("offers every call the snapshot makes legal, with its ask, Style, and chain", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    const picker = pickerOf(readDanceStep(view, NO_INTENT));
    expect(picker.label).toBe("Make a call");
    expect(picker.closed).toBeNull();
    expect(picker.options.map((option) => option.callId)).toEqual(
      view.calls.map((call) => call.id),
    );
    expect(picker.options).toHaveLength(7);
    const stayClose = picker.options.find((option) => option.callId === "call_005")!;
    expect(stayClose.action).toEqual({ type: "END_DANCE", role: "lead", callId: "call_005" });
    expect(stayClose).toMatchObject({
      name: "Stay close",
      ask: "dance your Move from Closed or Half-Closed",
      style: 4,
      favoured: false,
      inPocket: 0,
      afinque: 0,
    });
    expect(stayClose.sentence).toBe(
      "Stay close. Ask your partner to dance your Move from Closed or Half-Closed. Pays 4 Style when answered.",
    );
  });

  it("marks the song card's favoured call with the in-pocket Style it pays", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    const picker = pickerOf(readDanceStep(view, NO_INTENT));
    const favoured = picker.options.filter((option) => option.favoured);
    expect(favoured.map((option) => option.callId)).toEqual(["call_001"]);
    expect(favoured[0]!.inPocket).toBe(view.rules.call?.inPocketStyle);
    expect(favoured[0]!.sentence).toBe(
      "Stay with me. Ask your partner to dance a Move — any Move. Pays no Style of its own. This song card favours it: 1 more Style.",
    );
  });

  it("adds what the next link of the chain would pay", () => {
    const state = establishedState();
    state.shared.afinque = 2;
    const view = snapshotFor(state, "lead", content);
    expect(view.afinque.nextBonus).toBe(1);
    const picker = pickerOf(readDanceStep(view, NO_INTENT));
    const option = picker.options.find((entry) => entry.callId === "call_006")!;
    expect(option.afinque).toBe(1);
    expect(option.sentence).toContain("The next answer in a row adds 1 Style.");
  });

  it("says what a call gives up while the song bonus is met", () => {
    const state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    expect(pickerOf(readDanceStep(view, NO_INTENT)).givesUp).toBe(
      "A call gives up the song’s +1 Connection.",
    );
  });

  it("gives up nothing to say when the song bonus is not met", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(pickerOf(readDanceStep(view, NO_INTENT)).givesUp).toBeNull();
  });

  it("closes the picker on a phrase's last 8-count and says why", () => {
    const state = establishedState();
    state.songIndex = 7;
    const view = snapshotFor(state, "lead", content);
    expect(view.phrase.count).toBe(view.rules.phraseLength);
    expect(
      view.legalActions.some((action) => action.type === "END_DANCE" && action.callId !== null),
    ).toBe(false);
    const picker = pickerOf(readDanceStep(view, NO_INTENT));
    expect(picker.options).toEqual([]);
    expect(picker.closed).toBe("The phrase ends here — there is nothing to call into.");
  });

  it("closes the picker over an empty floor and asks for a Position", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const picker = pickerOf(readDanceStep(view, NO_INTENT));
    expect(picker.options).toEqual([]);
    expect(picker.closed).toBe("Leave a Position on the floor to make a call.");
  });

  it("grows no picker while a Position is staged", () => {
    const view = snapshotFor(openingState(), "lead", content);
    expect(readDanceStep(view, staged(id("pos_002"))).telling?.picker).toBeNull();
  });

  it("grows no picker for the partner who is only watching", () => {
    const view = snapshotFor(establishedState(), "follow", content);
    expect(readDanceStep(view, NO_INTENT).telling).toBeNull();
  });
});

describe("the call standing over an 8-count", () => {
  it("tells the answering player what to dance and that it is not answered yet", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005", true), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.call).toMatchObject({
      answering: true,
      headline: "Follow calls Stay close",
      ask: "Your answer: dance your Move from Closed or Half-Closed.",
      reward: "4 Style · ★ +1 in the pocket",
      met: false,
      state: "Not answered yet",
    });
  });

  it("turns to answered the moment the dance meets the call", () => {
    const state = applyOk(withCall(establishedState(), "call_002"), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const step = readDanceStep(snapshotFor(state, "lead", content), NO_INTENT);
    expect(step.call).toMatchObject({
      met: true,
      state: "Answered · finish to collect",
      reward: "1 Style",
    });
  });

  it("words the same call for the partner who made it and is watching", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005", true), "follow", content);
    const step = readDanceStep(view, NO_INTENT);
    expect(step.telling).toBeNull();
    expect(step.call).toMatchObject({
      answering: false,
      headline: "You called Stay close",
      ask: "You asked: dance your Move from Closed or Half-Closed.",
      state: "Lead is answering",
      covers: [],
    });
  });

  it("offers a cover for each Recovery card in hand, with what it costs", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005"), "lead", content);
    const covers = readDanceStep(view, NO_INTENT).call?.covers ?? [];
    expect(covers).toEqual([
      {
        action: { type: "COVER_CALL", role: "lead", recoveryInstanceId: id("rec_001") },
        label: "Cover with Return to Basic",
        note: "Keeps your Connection and the clean phrase. The afinque chain starts over.",
      },
    ]);
  });

  it("plays a Recovery card to the floor as the cover", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005"), "lead", content);
    const offer = offerFor(readDanceStep(view, NO_INTENT), id("rec_001"));
    expectPlayable(offer, "Cover the call", {
      kind: "dispatch",
      action: view.legalActions.find((action) => action.type === "COVER_CALL")!,
      intent: NO_INTENT,
    });
    expect(offer.playNote).toBe(
      "Keeps your Connection and the clean phrase. The afinque chain starts over.",
    );
  });

  it("has no banner when no call stands", () => {
    expect(
      readDanceStep(snapshotFor(establishedState(), "lead", content), NO_INTENT).call,
    ).toBeNull();
  });
});

describe("the hold", () => {
  it("maps a Position played before the dance to the adjust, with what it gives up", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    const adjust = view.legalActions.find(
      (action) => action.type === "ADJUST" && action.positionInstanceId === id("pos_002"),
    );
    expectPlayable(offerFor(step, id("pos_002")), "Adjust the hold", {
      kind: "dispatch",
      action: adjust!,
      intent: NO_INTENT,
    });
    expect(offerFor(step, id("pos_002")).playNote).toBe(
      "Adjusts the hold before you dance — gives up the song bonus this 8-count.",
    );
  });

  it("still transitions with the same card after the Move", () => {
    const state = applyOk(establishedState(), {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: id("mov_002"),
    });
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expectPlayable(offerFor(step, id("pos_002")), "Transition", {
      kind: "dispatch",
      action: view.legalActions.find((action) => action.type === "TRANSITION")!,
      intent: NO_INTENT,
    });
    expect(offerFor(step, id("pos_002")).playNote).toBeNull();
  });

  it("takes the hold with a Position no Move in hand dances from", () => {
    const state = openingState();
    state.players.lead.hand = state.players.lead.hand.filter(
      (entry) => entry.instanceId !== id("mov_002"),
    );
    const view = snapshotFor(state, "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    const adjust = view.legalActions.find(
      (action) => action.type === "ADJUST" && action.positionInstanceId === id("pos_001"),
    );
    expectPlayable(offerFor(step, id("pos_001")), "Take the hold", {
      kind: "dispatch",
      action: adjust!,
      intent: NO_INTENT,
    });
    expect(offerFor(step, id("pos_001")).playNote).toBe(
      "Opens the floor with this Position alone — gives up the song bonus this 8-count.",
    );
  });

  it("keeps staging the Position that a Move can open with", () => {
    const view = snapshotFor(openingState(), "lead", content);
    const step = readDanceStep(view, NO_INTENT);
    expectPlayable(offerFor(step, id("pos_002")), "Stage Position", {
      kind: "stage",
      intent: staged(id("pos_002")),
    });
    expect(offerFor(step, id("pos_002")).playNote).toBeNull();
  });

  it("explains a Position that matches the floor it would replace", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(view.floorRefusals).toContainEqual({
      instanceId: id("pos_001"),
      code: "SAME_POSITION",
    });
    expect(offerFor(readDanceStep(view, NO_INTENT), id("pos_001")).sentence).toBe(
      "The floor is already Open",
    );
  });
});

describe("the hot-seat handoff", () => {
  it("hands the incoming player the call they have to answer", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005", true), "follow", content);
    expect(callHandoff(view, "lead")).toEqual({
      caller: "Follow",
      name: "Stay close",
      ask: "dance your Move from Closed or Half-Closed",
      reward: "4 Style · ★ +1 in the pocket",
      sentence:
        "Follow called Stay close: dance your Move from Closed or Half-Closed. Your answer.",
    });
  });

  it("hands the caller nothing to answer", () => {
    const view = snapshotFor(withCall(establishedState(), "call_005"), "lead", content);
    expect(callHandoff(view, "follow")).toBeNull();
  });

  it("hands nothing over when no call stands", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(callHandoff(view, "follow")).toBeNull();
  });

  it("names the call the viewer just made during their lesson step", () => {
    const state = applyOk(establishedState(), {
      type: "END_DANCE",
      role: "lead",
      callId: "call_003",
    });
    const view = snapshotFor(state, "lead", content);
    expect(view.call).toBeNull();
    expect(callMadeNote(view)).toBe(
      "You called Change the room. Your partner answers next 8-count.",
    );
  });

  it("names no call when the song was taken instead", () => {
    const state = applyOk(establishedState(), { type: "END_DANCE", role: "lead" });
    expect(callMadeNote(snapshotFor(state, "lead", content))).toBeNull();
  });
});

describe("the note that survives a phone width", () => {
  it("names what the hold costs wherever the hold is legal", () => {
    const view = snapshotFor(establishedState(), "lead", content);
    expect(view.legalActions.some((action) => action.type === "ADJUST")).toBe(true);
    expect(readDanceStep(view, NO_INTENT).telling?.note).toBe(
      "The hold gives up this 8-count’s song bonus.",
    );
  });

  it("says nothing when no Position can take the hold", () => {
    const state = establishedState();
    state.players.lead.hand = [{ instanceId: id("mov_002"), cardId: "mov_002", owner: "lead" }];
    const view = snapshotFor(state, "lead", content);
    expect(view.legalActions.some((action) => action.type === "ADJUST")).toBe(false);
    expect(readDanceStep(view, NO_INTENT).telling?.note).toBeNull();
  });
});
