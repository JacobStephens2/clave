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
});
