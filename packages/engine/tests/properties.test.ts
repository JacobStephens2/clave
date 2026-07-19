import { content } from "@clave/content";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyAction, createGame, legalActions, type GameAction } from "../src/index.js";

function progress(actions: GameAction[]): GameAction {
  return (
    actions.find((action) => action.type === "CONFIRM_HAND") ??
    actions.find((action) => action.type === "PLAY_OPEN") ??
    actions.find((action) => action.type === "PLAY_MOVE") ??
    actions.find((action) => action.type === "END_DANCE") ??
    actions.find((action) => action.type === "END_LESSON") ??
    actions.find((action) => action.type === "FRESHEN") ??
    actions[0]!
  );
}

describe("engine properties", () => {
  it("every reported legal action applies and no invariant is breached", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), (seed) => {
        let state = createGame({ seed, content });
        let steps = 0;
        while ((state.status === "setup" || state.status === "playing") && steps < 100) {
          const role = state.status === "setup" ? state.setupRole : state.activeRole;
          const actions = legalActions(state, role, content);
          expect(actions.length).toBeGreaterThan(0);
          for (const action of actions) expect(applyAction(state, action, content).ok).toBe(true);
          const result = applyAction(state, progress(actions), content);
          if (!result.ok) throw new Error(result.error.message);
          state = result.state;
          expect(state.shared.connection).toBeGreaterThanOrEqual(0);
          expect(state.shared.connection).toBeLessThanOrEqual(content.rules.maximumConnection);
          if (state.phase !== "freshen") {
            expect(state.players.lead.hand.length).toBeLessThanOrEqual(content.rules.handSize);
            expect(state.players.follow.hand.length).toBeLessThanOrEqual(content.rules.handSize);
          }
          steps += 1;
        }
        expect(["completed", "lost"]).toContain(state.status);
      }),
      { numRuns: 30 },
    );
  });
});
