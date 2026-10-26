import { content, contentBytes, contentHash, hashCanonical } from "@clave/content";
import { writeFileSync } from "node:fs";
import {
  ENGINE_VERSION,
  applyAction,
  createGame,
  legalActions,
  snapshotFor,
  type GameAction,
  type GameState,
} from "@clave/engine";

type Strategy =
  "basic" | "stumble-heavy" | "connection-loss" | "maximum-lessons" | "call-and-answer";

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
  /** The first legal action of `type`, which is this fixture's only source of choice. */
  const first = <T extends GameAction["type"]>(
    type: T,
  ): Extract<GameAction, { type: T }> | undefined =>
    legalActions(state, state.activeRole, content).find(
      (action): action is Extract<GameAction, { type: T }> => action.type === type,
    );
  const callMet = () => snapshotFor(state, state.activeRole, content).call?.met ?? false;
  /** The first legal dance action that would answer the call standing over this 8-count. */
  const takeAnswering = () => {
    if (!state.call || callMet()) return;
    const role = state.activeRole;
    const answering = legalActions(state, role, content).find((action) => {
      if (
        !["ADJUST", "PLAY_OPEN", "PLAY_MOVE", "TRANSITION", "PLAY_FLOURISH"].includes(action.type)
      )
        return false;
      const result = applyAction(state, action, content);
      return result.ok && (snapshotFor(result.state, role, content).call?.met ?? false);
    });
    if (answering) take(answering);
  };
  /**
   * A dance step that uses every part of the call: the hold, an opening or a Move, a Flourish,
   * answering or covering the call standing over it, and making the song card's favoured call.
   */
  const danceAndCall = () => {
    const role = state.activeRole;
    // The hold comes before any card, so the answer that needs it has to be found first.
    takeAnswering();
    // Count 4 is this fixture's hold: the floor is adjusted before anyone dances on it.
    if (state.songIndex === 3) {
      const held = first("ADJUST");
      if (held) take(held);
    }
    const opening = first("PLAY_OPEN");
    if (opening) take(opening);
    const move = first("PLAY_MOVE");
    if (move) take(move);
    takeAnswering();
    const flourish = first("PLAY_FLOURISH");
    if (flourish) take(flourish);
    if (state.call && !callMet()) {
      const cover = first("COVER_CALL");
      if (cover) take(cover);
    }
    // Bold while the Connection can take a dropped call, and "any Move" when it cannot.
    const wanted =
      state.shared.connection > 2
        ? (content.song.cards[state.songIndex]?.favouredCall ?? null)
        : "call_001";
    const call = legalActions(state, role, content).find(
      (action) => action.type === "END_DANCE" && action.callId === wanted,
    );
    take(call ?? { type: "END_DANCE", role, callId: null });
  };
  take({ type: "CONFIRM_HAND", role: "lead" });
  take({ type: "CONFIRM_HAND", role: "follow" });
  while (state.status === "playing") {
    const role = state.activeRole;
    const shouldStumble =
      (strategy === "stumble-heavy" && (state.songIndex === 0 || state.songIndex === 9)) ||
      (strategy === "connection-loss" && (state.songIndex === 0 || state.songIndex === 1));
    if (strategy === "call-and-answer" && !shouldStumble) danceAndCall();
    else
      take(
        shouldStumble
          ? { type: "STUMBLE", role, recoveryInstanceId: null }
          : { type: "END_DANCE", role, callId: null },
      );
    if (state.status !== "playing") break;
    if (strategy === "call-and-answer" && state.songIndex <= 2) {
      // One Recovery card early, so there is something to cover an unanswerable call with.
      const recovery = legalActions(state, role, content).find(
        (action) => action.type === "BUY_LESSON" && action.cardId === "rec_001",
      );
      if (recovery) take(recovery);
    }
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
    run(606, "call-and-answer"),
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
