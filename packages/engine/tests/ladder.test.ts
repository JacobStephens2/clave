import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { snapshotFor, type GameAction, type GameState } from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

/** The Lead's 8-count ends; the Follow's begins with `callId` standing over it if given. */
function handOver(state: GameState, callId: string | null = null): GameState {
  const role = state.activeRole;
  return applyOk(applyOk(state, { type: "END_DANCE", role, callId }), {
    type: "END_LESSON",
    role,
  });
}

/** The 8-count the Follow dances with `hand`, through `plays`, and how it ends. */
function followCount(
  callId: string | null,
  hand: string[],
  plays: (state: GameState) => GameState,
  ending: GameAction = { type: "END_DANCE", role: "follow" },
): GameState {
  let state = readyGame();
  setHand(state, "lead", ["pos_001", "mov_002"]);
  const [position, move] = state.players.lead.hand;
  state = applyOk(state, {
    type: "PLAY_OPEN",
    role: "lead",
    positionInstanceId: position!.instanceId,
    moveInstanceId: move!.instanceId,
  });
  state = handOver(state, callId);
  setHand(state, "follow", hand);
  return applyOk(plays(state), ending);
}

const danceFirst = (state: GameState): GameState =>
  applyOk(state, {
    type: "PLAY_MOVE",
    role: "follow",
    moveInstanceId: state.players.follow.hand[0]!.instanceId,
  });

const stay = (state: GameState): GameState => state;

describe("the resolution ladder · rulebook §6.5", () => {
  it("marks an answered call perfect", () => {
    const state = followCount("call_002", ["mov_002"], danceFirst);
    expect(state.turnDance.rung).toBe("perfect");
    expect(state.danceHistory.at(-1)?.rung).toBe("perfect");
  });

  it("marks a Move with no call standing clean", () => {
    const state = followCount(null, ["mov_002"], danceFirst);
    expect(state.turnDance.rung).toBe("clean");
    expect(state.danceHistory.at(-1)?.outcome).toBe("dance");
  });

  it("marks the basic and a dropped call awkward", () => {
    expect(followCount(null, ["rec_001"], stay).turnDance.rung).toBe("awkward");
    const dropped = followCount("call_005", ["mov_002"], danceFirst);
    expect(dropped.turnDance.rung).toBe("awkward");
    expect(dropped.danceHistory.at(-1)?.outcome).toBe("dance");
  });

  it("marks a covered call recovered, even when the 8-count then dances", () => {
    const covered = followCount("call_005", ["rec_001", "mov_002"], (state) => {
      const [recovery, move] = state.players.follow.hand;
      const after = applyOk(state, {
        type: "COVER_CALL",
        role: "follow",
        recoveryInstanceId: recovery!.instanceId,
      });
      return applyOk(after, {
        type: "PLAY_MOVE",
        role: "follow",
        moveInstanceId: move!.instanceId,
      });
    });
    expect(covered.turnDance.rung).toBe("recovered");
  });

  it("marks a stumble a break whatever else the 8-count held", () => {
    const state = followCount("call_005", ["rec_001"], stay, {
      type: "STUMBLE",
      role: "follow",
      recoveryInstanceId: null,
    });
    expect(state.turnDance.rung).toBe("break");
    expect(state.danceHistory.at(-1)?.rung).toBe("break");
  });

  it("records the Style each 8-count gained and the afinque it left behind", () => {
    const answered = followCount("call_002", ["mov_002"], danceFirst);
    const entry = answered.danceHistory.at(-1)!;
    // A 1-Style Move, count 2's +1 Style from Open, the call's own 1 Style, and no afinque
    // bonus on the first link.
    expect(entry).toMatchObject({ styleGained: 3, afinqueAfter: 1, rung: "perfect" });
    // The Lead's own 8-count: the Move alone, because calling gave up the song's bonus.
    expect(answered.danceHistory[0]).toMatchObject({
      rung: "clean",
      styleGained: 1,
      afinqueAfter: 0,
    });
    expect(snapshotFor(answered, "lead", content).danceHistory.at(-1)).toMatchObject({
      rung: "perfect",
      styleGained: 3,
      afinqueAfter: 1,
    });
  });

  it("re-conditions the clean phrase on a dropped call as well as a stumble", () => {
    let state = readyGame();
    state.songIndex = 7;
    state.phase = "lesson";
    state.phrase = { ...state.phrase, stumbled: false, droppedCall: true };
    const before = state.shared.style;
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    expect(state.shared.style - before).toBe(0);

    let clean = readyGame();
    clean.songIndex = 7;
    clean.phase = "lesson";
    clean.phrase = { ...clean.phrase, stumbled: false, droppedCall: false };
    const cleanBefore = clean.shared.style;
    clean = applyOk(clean, { type: "END_LESSON", role: "lead" });
    expect(clean.shared.style - cleanBefore).toBe(content.rules.phraseBonuses.clean);
    expect(clean.phrase.droppedCall).toBe(false);
  });
});
