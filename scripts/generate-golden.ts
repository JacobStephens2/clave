import { content, contentBytes, contentHash, hashCanonical } from "@clave/content";
import { writeFileSync } from "node:fs";
import {
  ENGINE_VERSION,
  applyAction,
  createGame,
  legalActions,
  type GameAction,
  type GameState,
} from "@clave/engine";

type Strategy = "basic" | "stumble-heavy" | "connection-loss" | "maximum-lessons";

function commit(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function run(seed: number, strategy: Strategy) {
  let state = createGame({ seed, content, contentHash });
  const actions: GameAction[] = [];
  const take = (action: GameAction) => {
    state = commit(state, action);
    actions.push(action);
  };
  take({ type: "CONFIRM_HAND", role: "lead" });
  take({ type: "CONFIRM_HAND", role: "follow" });
  while (state.status === "playing") {
    const role = state.activeRole;
    const shouldStumble =
      (strategy === "stumble-heavy" && (state.songIndex === 0 || state.songIndex === 9)) ||
      (strategy === "connection-loss" && (state.songIndex === 0 || state.songIndex === 1));
    take(
      shouldStumble
        ? { type: "STUMBLE", role, recoveryInstanceId: null }
        : { type: "END_DANCE", role },
    );
    if (state.status !== "playing") break;
    if (strategy === "maximum-lessons") {
      const purchase = legalActions(state, role, content).find(
        (action) => action.type === "BUY_LESSON" && action.source === "beginner",
      );
      if (purchase) take(purchase);
    }
    take({ type: "END_LESSON", role });
  }
  return {
    id: `${strategy}-${seed}`,
    seed,
    strategy,
    ending: state.status,
    engineVersion: ENGINE_VERSION,
    contentHash,
    contentBytes,
    actions,
    expectedStateHash: hashCanonical(state),
  };
}

const output = `${JSON.stringify(
  [
    run(101, "basic"),
    run(202, "basic"),
    run(303, "stumble-heavy"),
    run(404, "connection-loss"),
    run(505, "maximum-lessons"),
  ],
  null,
  2,
)}\n`;

if (process.argv.includes("--write"))
  writeFileSync(
    new URL("../packages/engine/fixtures/golden-replays.json", import.meta.url),
    output,
  );
else process.stdout.write(output);
