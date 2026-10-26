import { content } from "@clave/content";
import { isDeepStrictEqual } from "node:util";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  afinqueCap,
  applyAction,
  createGame,
  legalActions,
  nextRandom,
  type CardInstance,
  type GameAction,
  type GameState,
  type Role,
} from "../src/index.js";

function progress(actions: GameAction[]): GameAction {
  return (
    actions.find((action) => action.type === "CONFIRM_HAND") ??
    actions.find((action) => action.type === "PLAY_OPEN") ??
    actions.find((action) => action.type === "PLAY_MOVE") ??
    actions.find((action) => action.type === "END_DANCE") ??
    actions.find((action) => action.type === "END_LESSON") ??
    actions[0]!
  );
}

const roles: Role[] = ["lead", "follow"];
const phraseLength = content.song.cards.length / 2;

/** Every card instance a player owns, wherever it currently sits. */
function owned(state: GameState, role: Role): string[] {
  const player = state.players[role];
  const table = [state.table.position, state.table.move?.card ?? null, state.table.flourish]
    .filter((entry): entry is CardInstance => entry !== null)
    .filter((entry) => entry.owner === role);
  return [...player.hand, ...player.drawPile, ...player.discardPile, ...table].map(
    (entry) => entry.instanceId,
  );
}

/** What has to be true of every state the engine hands back. */
function invariants(state: GameState): void {
  expect(state.shared.style).toBeGreaterThanOrEqual(0);
  expect(state.shared.afinque).toBeGreaterThanOrEqual(0);
  expect(state.shared.afinque).toBeLessThanOrEqual(afinqueCap(content));
  // No call crosses a phrase ending, so counts 1 and 9 are never danced into one.
  if (state.phase === "dance" && state.songIndex % phraseLength === 0)
    expect(state.call).toBeNull();
  // A call asks for something from the floor the caller left, which keeps its Position.
  if (state.call) expect(state.table.position).not.toBeNull();
  if (state.status === "completed" || state.status === "lost") expect(state.call).toBeNull();
  for (const role of roles) {
    const ids = owned(state, role);
    expect(new Set(ids).size).toBe(ids.length);
  }
}

// Every action the reducer could be offered from the current state: every hand card in every
// hand-card slot, every hand pair for PLAY_OPEN, every supply, market and history card in every
// lesson slot, plus the argument-free actions. Deliberately broader than legalActions' sources.
function broadCandidates(state: GameState): GameAction[] {
  const lessonCardIds = new Set([
    ...content.decks.beginnerSupply,
    ...state.market.intermediateDisplay,
    ...state.market.advancedDisplay,
    ...state.moveHistory.map((entry) => entry.cardId),
  ]);
  const actions: GameAction[] = [];
  for (const role of roles) {
    actions.push(
      { type: "MULLIGAN", role },
      { type: "CONFIRM_HAND", role },
      { type: "CLEAR_SIGNAL", role },
      { type: "UNDO_TURN", role },
      { type: "END_DANCE", role, callId: null },
      { type: "STUMBLE", role, recoveryInstanceId: null },
      { type: "END_LESSON", role },
    );
    for (const option of content.rules.call?.options ?? [])
      actions.push({ type: "END_DANCE", role, callId: option.id });
    const hand = state.players[role].hand.map((entry) => entry.instanceId);
    for (const instanceId of hand) {
      actions.push(
        { type: "SIGNAL_CARD", role, instanceId },
        { type: "PLAY_MOVE", role, moveInstanceId: instanceId },
        { type: "TRANSITION", role, positionInstanceId: instanceId },
        { type: "ADJUST", role, positionInstanceId: instanceId },
        { type: "PLAY_FLOURISH", role, flourishInstanceId: instanceId },
        { type: "STUMBLE", role, recoveryInstanceId: instanceId },
        { type: "COVER_CALL", role, recoveryInstanceId: instanceId },
      );
      for (const moveInstanceId of hand)
        actions.push({ type: "PLAY_OPEN", role, positionInstanceId: instanceId, moveInstanceId });
    }
    for (const cardId of lessonCardIds) {
      for (const source of ["beginner", "intermediate", "advanced"] as const)
        actions.push({ type: "BUY_LESSON", role, source, cardId });
      actions.push({ type: "LEARN_FROM_PARTNER", role, cardId });
    }
  }
  return actions;
}

function withoutBookkeeping(state: GameState): GameState {
  return { ...state, sequence: 0, log: [] };
}

// Seeded random walk that mostly advances the turn, so the reverse property sees
// dance, flourish, transition, stumble and lesson states rather than only basics.
function walk(seed: number, visit: (state: GameState) => void): void {
  let state = createGame({ seed, content });
  let rng = seed;
  const next = (bound: number): number => {
    const random = nextRandom(rng);
    rng = random.state;
    return Math.floor(random.value * bound);
  };
  for (
    let steps = 0;
    (state.status === "setup" || state.status === "playing") && steps < 200;
    steps++
  ) {
    visit(state);
    const role = state.status === "setup" ? state.setupRole : state.activeRole;
    const actions = legalActions(state, role, content);
    const advancing = actions.filter(
      (action) => !["SIGNAL_CARD", "CLEAR_SIGNAL", "UNDO_TURN"].includes(action.type),
    );
    const pool = advancing.length > 0 && next(10) > 0 ? advancing : actions;
    const result = applyAction(state, pool[next(pool.length)]!, content);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
}

describe("engine properties", () => {
  // Opening Position and Move pairs push this past vitest's 5s default.
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
          expect(state.players.lead.hand.length).toBeLessThanOrEqual(content.rules.handSize);
          expect(state.players.follow.hand.length).toBeLessThanOrEqual(content.rules.handSize);
          invariants(state);
          steps += 1;
        }
        expect(["completed", "lost"]).toContain(state.status);
      }),
      { numRuns: 30 },
    );
  }, 30_000);

  it("every action the reducer accepts is a listed legal action, except a no-op undo", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), (seed) => {
        walk(seed, (state) => {
          invariants(state);
          const listed = roles.flatMap((role) => legalActions(state, role, content));
          for (const action of broadCandidates(state)) {
            const result = applyAction(state, action, content);
            if (!result.ok || listed.some((entry) => isDeepStrictEqual(entry, action))) continue;
            expect(action.type).toBe("UNDO_TURN");
            expect(withoutBookkeeping(result.state)).toEqual(withoutBookkeeping(state));
          }
        });
      }),
      { numRuns: 4 },
    );
  });

  it("never loses or duplicates a card instance along a walk", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), (seed) => {
        let previous: GameState | null = null;
        walk(seed, (state) => {
          for (const role of roles) {
            const ids = owned(state, role);
            expect(new Set(ids).size).toBe(ids.length);
            // Lessons mint cards and nothing else ever removes one, so the only way a card
            // can leave is an undo rolling back the turn that minted it, `nextInstance` too.
            if (previous && state.nextInstance >= previous.nextInstance)
              for (const id of owned(previous, role)) expect(ids).toContain(id);
          }
          previous = state;
        });
      }),
      { numRuns: 4 },
    );
  });
});
