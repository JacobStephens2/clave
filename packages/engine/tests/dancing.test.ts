import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

describe("dancing · rulebook §6", () => {
  it("opens atomically, transitions immediately, and flourishes the current move", () => {
    let state = readyGame();
    setHand(state, "lead", ["pos_002", "mov_013", "pos_001", "flo_001"]);
    const [closed, move, open, flourish] = state.players.lead.hand;
    state = applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: closed!.instanceId,
      moveInstanceId: move!.instanceId,
    });
    expect(state.shared.style).toBe(2);
    expect(state.table.move?.dancedFrom).toBe("Closed");
    state = applyOk(state, {
      type: "TRANSITION",
      role: "lead",
      positionInstanceId: open!.instanceId,
    });
    state = applyOk(state, {
      type: "PLAY_FLOURISH",
      role: "lead",
      flourishInstanceId: flourish!.instanceId,
    });
    expect(state.shared.style).toBe(3);
    expect(state.table.position?.cardId).toBe("pos_001");
    expect(state.phrase.flourishedBy.lead).toBe(true);
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    expect(state.danceHistory).toEqual([
      {
        sequence: state.sequence,
        phrase: 1,
        songIndex: 0,
        role: "lead",
        outcome: "dance",
        moveCardId: "mov_013",
        positionCardId: "pos_001",
        flourishCardId: "flo_001",
        fromPosition: "Closed",
        endingPosition: "Open",
      },
    ]);
  });

  it("rejects move-position mismatches and changing position before a move", () => {
    const state = readyGame();
    setHand(state, "lead", ["pos_002", "mov_002", "pos_001", "mov_006"]);
    const [closed, openOnlyMove] = state.players.lead.hand;
    const mismatch = applyAction(
      state,
      {
        type: "PLAY_OPEN",
        role: "lead",
        positionInstanceId: closed!.instanceId,
        moveInstanceId: openOnlyMove!.instanceId,
      },
      content,
    );
    expect(mismatch.ok).toBe(false);
    state.table.position = closed!;
    state.players.lead.hand = state.players.lead.hand.slice(1);
    const transition = applyAction(
      state,
      {
        type: "TRANSITION",
        role: "lead",
        positionInstanceId: state.players.lead.hand[1]!.instanceId,
      },
      content,
    );
    expect(transition.ok).toBe(false);
  });

  it("lets a stumble proceed to lessons unless Connection reaches zero", () => {
    let state = readyGame();
    state = applyOk(state, { type: "STUMBLE", role: "lead", recoveryInstanceId: null });
    expect(state.shared.connection).toBe(2);
    expect(state.phase).toBe("lesson");
    expect(state.status).toBe("playing");
    expect(state.players.lead.money).toBe(1);
    expect(state.danceHistory).toEqual([
      expect.objectContaining({
        phrase: 1,
        songIndex: 0,
        role: "lead",
        outcome: "stumble",
        moveCardId: null,
        positionCardId: null,
        flourishCardId: null,
      }),
    ]);
    const lesson = applyAction(
      state,
      { type: "BUY_LESSON", role: "lead", source: "beginner", cardId: "rec_001" },
      content,
    );
    expect(lesson.ok).toBe(true);
  });

  it("records a basic as a visible 8-count with the carried Position", () => {
    let state = readyGame();
    state.table.position = { instanceId: "previous-position", cardId: "pos_001", owner: "follow" };
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    expect(state.danceHistory).toEqual([
      expect.objectContaining({
        phrase: 1,
        songIndex: 0,
        role: "lead",
        outcome: "basic",
        moveCardId: null,
        positionCardId: "pos_001",
        fromPosition: "Open",
        endingPosition: "Open",
      }),
    ]);
  });

  it("applies recovery-card costs from content", () => {
    let state = readyGame();
    setHand(state, "lead", ["rec_001", "rec_002", "pos_001", "mov_001"]);
    const recovery = state.players.lead.hand[1]!;
    state = applyOk(state, {
      type: "STUMBLE",
      role: "lead",
      recoveryInstanceId: recovery.instanceId,
    });
    expect(state.shared.connection).toBe(4);
    expect(state.players.lead.discardPile.some((entry) => entry.cardId === "rec_002")).toBe(true);
  });
});
