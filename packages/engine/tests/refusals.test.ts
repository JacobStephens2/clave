import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  applyAction,
  createEnvelope,
  refusalCode,
  snapshotFor,
  type GameAction,
} from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

describe("snapshot refusal codes", () => {
  it("publishes the established-floor failure and omits an action the reducer accepts", () => {
    const state = readyGame();
    setHand(state, "lead", ["mov_013", "mov_002", "pos_002", "rec_001", "flo_003"]);
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    const [closedMove, openMove, position, recovery, flourish] = state.players.lead.hand;
    const view = snapshotFor(state, "lead", content);

    const mismatchedMove = applyAction(
      state,
      { type: "PLAY_MOVE", role: "lead", moveInstanceId: closedMove!.instanceId },
      content,
    );
    const matchingMove = applyAction(
      state,
      { type: "PLAY_MOVE", role: "lead", moveInstanceId: openMove!.instanceId },
      content,
    );
    const transition = applyAction(
      state,
      { type: "TRANSITION", role: "lead", positionInstanceId: position!.instanceId },
      content,
    );
    const stumble = applyAction(
      state,
      { type: "STUMBLE", role: "lead", recoveryInstanceId: recovery!.instanceId },
      content,
    );
    const flourishPlay = applyAction(
      state,
      { type: "PLAY_FLOURISH", role: "lead", flourishInstanceId: flourish!.instanceId },
      content,
    );

    expect(mismatchedMove.ok).toBe(false);
    expect(transition.ok).toBe(false);
    expect(flourishPlay.ok).toBe(false);
    expect(matchingMove.ok).toBe(true);
    expect(stumble.ok).toBe(true);
    if (!mismatchedMove.ok && !flourishPlay.ok) {
      expect(view.floorRefusals).toEqual([
        { instanceId: closedMove!.instanceId, code: mismatchedMove.error.code },
        { instanceId: flourish!.instanceId, code: flourishPlay.error.code },
      ]);
    }
    // The Position is published as playable: a transition is too early, but the hold is not.
    expect(
      applyAction(
        state,
        { type: "ADJUST", role: "lead", positionInstanceId: position!.instanceId },
        content,
      ).ok,
    ).toBe(true);
    expect(view.engineVersion).toBe(state.engineVersion);
    expect(ENGINE_VERSION).toBe(6);
  });

  it("omits an empty-floor card when any opening pair passes", () => {
    const state = readyGame();
    setHand(state, "lead", ["pos_002", "mov_013", "pos_001", "mov_002"]);
    const [closed, closedMove, open, openMove] = state.players.lead.hand;
    const view = snapshotFor(state, "lead", content);
    const closedPair = applyAction(
      state,
      {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: closed!.instanceId,
        moveInstanceId: closedMove!.instanceId,
      },
      content,
    );
    const openPair = applyAction(
      state,
      {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: open!.instanceId,
        moveInstanceId: openMove!.instanceId,
      },
      content,
    );
    expect(closedPair.ok).toBe(true);
    expect(openPair.ok).toBe(true);
    expect(view.floorRefusals).toEqual([]);
  });

  it("publishes POSITION_MISMATCH when every opening pair mismatches or the hand has no opposite card", () => {
    const mismatched = readyGame();
    setHand(mismatched, "lead", ["pos_001", "mov_013"]);
    const [open, closedMove] = mismatched.players.lead.hand;
    const mismatch = applyAction(
      mismatched,
      {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: open!.instanceId,
        moveInstanceId: closedMove!.instanceId,
      },
      content,
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(snapshotFor(mismatched, "lead", content).floorRefusals).toEqual([
        { instanceId: closedMove!.instanceId, code: mismatch.error.code },
      ]);
      expect(mismatch.error.code).toBe("POSITION_MISMATCH");
    }

    // A Position with no Move to open from is not stuck: it can still take the hold.
    const alone = readyGame();
    setHand(alone, "lead", ["pos_001"]);
    expect(snapshotFor(alone, "lead", content).floorRefusals).toEqual([]);
  });

  it("publishes the shared opening failure when it is not a position mismatch", () => {
    const state = readyGame();
    setHand(state, "lead", ["pos_002", "mov_013"]);
    state.turnDance.cardsPlayed = 1;
    const [closed, move] = state.players.lead.hand;
    const opening = applyAction(
      state,
      {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: closed!.instanceId,
        moveInstanceId: move!.instanceId,
      },
      content,
    );
    expect(opening.ok).toBe(false);
    if (!opening.ok) {
      expect(opening.error.code).toBe("OPEN_FIRST");
      expect(snapshotFor(state, "lead", content).floorRefusals).toEqual([
        { instanceId: closed!.instanceId, code: "OPEN_FIRST" },
        { instanceId: move!.instanceId, code: "OPEN_FIRST" },
      ]);
    }
  });

  it("lists no floor refusal off the dance step", () => {
    let state = readyGame();
    setHand(state, "lead", ["mov_013"]);
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    expect(snapshotFor(state, "lead", content).floorRefusals).toEqual([]);
  });

  it("lists no floor refusal for the partner whose dance step it is not", () => {
    const state = readyGame();
    setHand(state, "follow", ["mov_013"]);
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "lead" };
    const follow = snapshotFor(state, "follow", content);
    expect(follow.floorRefusals).toEqual([]);
    expect(follow.activeRole).toBe("lead");
    expect(follow.phase).toBe("dance");
  });

  it("publishes each market card's buy failure and omits a legal buy", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    const view = snapshotFor(state, "lead", content);

    for (const card of view.market.beginner) {
      const bought = applyAction(
        state,
        { type: "BUY_LESSON", role: "lead", source: "beginner", cardId: card.id },
        content,
      );
      expect(bought.ok).toBe(true);
      expect(
        view.lessonRefusals.find(
          (entry) => entry.source === "beginner" && entry.cardId === card.id,
        ),
      ).toBeUndefined();
    }
    for (const card of view.market.intermediate) {
      const bought = applyAction(
        state,
        { type: "BUY_LESSON", role: "lead", source: "intermediate", cardId: card.id },
        content,
      );
      expect(bought.ok).toBe(false);
      if (!bought.ok) {
        expect(view.lessonRefusals).toContainEqual({
          source: "intermediate",
          cardId: card.id,
          code: bought.error.code,
        });
      }
    }
    expect(view.lessonRefusals.filter((entry) => entry.source === "beginner")).toEqual([]);
  });

  it("publishes the money failure when a private lesson is also already taken", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state.players.lead.money = 0;
    state.phrase.privateLessonTakenThisRound = true;
    const cardId = state.market.intermediateDisplay[0]!;
    const bought = applyAction(
      state,
      { type: "BUY_LESSON", role: "lead", source: "intermediate", cardId },
      content,
    );
    expect(bought.ok).toBe(false);
    if (!bought.ok) {
      expect(bought.error.code).toBe("NOT_ENOUGH_MONEY");
      expect(snapshotFor(state, "lead", content).lessonRefusals).toContainEqual({
        source: "intermediate",
        cardId,
        code: "NOT_ENOUGH_MONEY",
      });
    }
  });

  it("publishes lesson refusals for the waiting partner and during the dance step", () => {
    const dancing = readyGame();
    const lead = snapshotFor(dancing, "lead", content);
    const follow = snapshotFor(dancing, "follow", content);
    const cardId = dancing.market.intermediateDisplay[0]!;
    const leadBuy = applyAction(
      dancing,
      { type: "BUY_LESSON", role: "lead", source: "intermediate", cardId },
      content,
    );
    const followBuy = applyAction(
      dancing,
      { type: "BUY_LESSON", role: "follow", source: "intermediate", cardId },
      content,
    );
    expect(leadBuy.ok).toBe(false);
    expect(followBuy.ok).toBe(false);
    if (!leadBuy.ok && !followBuy.ok) {
      expect(lead.lessonRefusals).toContainEqual({
        source: "intermediate",
        cardId,
        code: leadBuy.error.code,
      });
      expect(follow.lessonRefusals).toContainEqual({
        source: "intermediate",
        cardId,
        code: followBuy.error.code,
      });
      expect(leadBuy.error.code).toBe("WRONG_PHASE");
      expect(followBuy.error.code).toBe("NOT_YOUR_TURN");
    }
  });

  it("publishes the position-limit failure when that is what the reducer returns", () => {
    const state = readyGame();
    setHand(state, "lead", ["pos_002"]);
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    state.turnDance.canTransition = true;
    state.turnDance.positionsPlayed = content.rules.danceLimits.positions;
    const position = state.players.lead.hand[0]!;
    const transition = applyAction(
      state,
      { type: "TRANSITION", role: "lead", positionInstanceId: position.instanceId },
      content,
    );
    expect(transition.ok).toBe(false);
    if (!transition.ok) {
      expect(transition.error.code).toBe("POSITION_LIMIT");
      expect(snapshotFor(state, "lead", content).floorRefusals).toEqual([
        { instanceId: position.instanceId, code: "POSITION_LIMIT" },
      ]);
    }
  });

  it("publishes ADVANCED_CLOSED for an advanced market card before the montuno", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state.players.lead.money = 10;
    state.market.advancedDisplay = ["flo_004"];
    const bought = applyAction(
      state,
      { type: "BUY_LESSON", role: "lead", source: "advanced", cardId: "flo_004" },
      content,
    );
    expect(bought.ok).toBe(false);
    if (!bought.ok) {
      expect(bought.error.code).toBe("ADVANCED_CLOSED");
      expect(snapshotFor(state, "lead", content).lessonRefusals).toContainEqual({
        source: "advanced",
        cardId: "flo_004",
        code: "ADVANCED_CLOSED",
      });
    }
  });

  it("reads an action the same way the reducer does, defaults included", () => {
    const state = readyGame();
    // An action stored before the call names no `callId` at all: the reducer's parse fills
    // in null, so the published code has to read that same object the same way.
    const unnamed = { type: "END_DANCE", role: state.activeRole } as GameAction;
    expect(applyAction(state, unnamed, content).ok).toBe(true);
    expect(refusalCode(state, unnamed, content)).toBeNull();
    const malformed = {
      type: "END_DANCE",
      role: state.activeRole,
      callId: "nope",
    } as GameAction;
    expect(applyAction(state, malformed, content)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACTION" },
    });
    expect(refusalCode(state, malformed, content)).toBe("INVALID_ACTION");
  });

  it("does not store refusal codes in the resume envelope", () => {
    const envelope = createEnvelope({ seed: 1 });
    const stored = JSON.stringify(envelope);
    expect(stored).not.toContain("floorRefusals");
    expect(stored).not.toContain("lessonRefusals");
    expect(envelope.engineVersion).toBe(6);
  });
});
