import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { legalActions, snapshotFor, type GameState } from "../src/index.js";
import { applyOk, finishTurn, playBasicGame, readyGame } from "./helpers.js";

/** A whole song danced with all the talking the game allows: three signals and a lesson a turn. */
function talkativeGame(): GameState {
  let state = readyGame();
  while (state.status === "playing") {
    const role = state.activeRole;
    for (const instance of state.players[role].hand.slice(0, 3))
      state = applyOk(state, { type: "SIGNAL_CARD", role, instanceId: instance.instanceId });
    state = applyOk(state, { type: "END_DANCE", role, callId: null });
    if (state.status !== "playing") break;
    const lesson = legalActions(state, role, content).find(
      (action) => action.type === "BUY_LESSON" && action.source === "beginner",
    );
    if (lesson) state = applyOk(state, lesson);
    state = applyOk(state, { type: "END_LESSON", role });
  }
  return state;
}

describe("end of dance · rulebook §10", () => {
  it("loses immediately when Connection reaches zero", () => {
    let state = readyGame();
    state = finishTurn(state, { type: "STUMBLE", role: "lead", recoveryInstanceId: null });
    state = finishTurn(state, { type: "STUMBLE", role: "follow", recoveryInstanceId: null });
    expect(state.status).toBe("lost");
    expect(state.shared.connection).toBe(0);
    expect(state.phase).toBe("terminal");
    expect(state.danceHistory).toHaveLength(2);
    expect(state.danceHistory.at(-1)).toEqual(
      expect.objectContaining({ role: "follow", outcome: "stumble", songIndex: 1 }),
    );
  });

  it("rates a completed dance from Style plus Connection", () => {
    const { state } = playBasicGame();
    expect(state.finalScore).toBe(state.shared.style + state.shared.connection);
    expect(state.rating).toBeTruthy();
  });

  it("publishes the whole log once the dance is over, however long the song ran", () => {
    const state = talkativeGame();
    expect(state.status).toBe("completed");
    // A song this talkative outgrows the window the snapshot carries while it is being danced.
    expect(state.log.length).toBeGreaterThan(80);
    expect(snapshotFor({ ...state, status: "playing" }, "lead", content).log).toHaveLength(80);
    // The end screen recaps the whole song from its own sentences, and is published once.
    const view = snapshotFor(state, "lead", content);
    expect(view.log).toEqual(state.log);
    expect(view.log[0]?.sequence).toBe(0);
  });
});
