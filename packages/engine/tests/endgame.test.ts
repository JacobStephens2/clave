import { describe, expect, it } from "vitest";
import { finishTurn, playBasicGame, readyGame } from "./helpers.js";

describe("end of dance · rulebook §10", () => {
  it("loses immediately when Connection reaches zero", () => {
    let state = readyGame();
    state = finishTurn(state, { type: "STUMBLE", role: "lead", recoveryInstanceId: null });
    state = finishTurn(state, { type: "STUMBLE", role: "follow", recoveryInstanceId: null });
    expect(state.status).toBe("lost");
    expect(state.shared.connection).toBe(0);
    expect(state.phase).toBe("terminal");
  });

  it("rates a completed dance from Style plus Connection", () => {
    const { state } = playBasicGame();
    expect(state.finalScore).toBe(state.shared.style + state.shared.connection);
    expect(state.rating).toBeTruthy();
  });
});
