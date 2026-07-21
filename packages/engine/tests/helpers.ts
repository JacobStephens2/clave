import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  type GameAction,
  type GameState,
  type Role,
} from "../src/index.js";

export function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

export function readyGame(seed = 42): GameState {
  let state = createGame({ seed, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
  return state;
}

export function finishTurn(
  state: GameState,
  danceAction: GameAction = { type: "END_DANCE", role: state.activeRole },
): GameState {
  const role = state.activeRole;
  state = applyOk(state, danceAction);
  if (state.status !== "playing") return state;
  return applyOk(state, { type: "END_LESSON", role });
}

export function playBasicGame(seed = 42): { state: GameState; actions: GameAction[] } {
  const actions: GameAction[] = [
    { type: "CONFIRM_HAND", role: "lead" },
    { type: "CONFIRM_HAND", role: "follow" },
  ];
  let state = createGame({ seed, content });
  for (const action of actions) state = applyOk(state, action);
  while (state.status === "playing") {
    const role: Role = state.activeRole;
    const turn: GameAction[] = [
      { type: "END_DANCE", role },
      { type: "END_LESSON", role },
    ];
    for (const action of turn) {
      state = applyOk(state, action);
      actions.push(action);
      if (state.status !== "playing") break;
    }
  }
  return { state, actions };
}

export function setHand(state: GameState, role: Role, cardIds: string[]): void {
  state.players[role].hand = cardIds.map((cardId, index) => ({
    instanceId: `test-${role}-${index}-${cardId}`,
    cardId,
    owner: role,
  }));
}
