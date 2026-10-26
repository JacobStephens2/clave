import { content } from "@clave/content";
import {
  applyEnvelopeAction,
  createEnvelope,
  snapshotFor,
  type GameAction,
  type PlayerSnapshot,
  type ResumeEnvelope,
} from "@clave/engine";
import type { Page } from "@playwright/test";

/**
 * Hot-seat states a spec would otherwise spend minutes clicking its way to — a call standing
 * with a Recovery in hand, an established floor to adjust, a whole song danced out. Each one
 * is a real game played by the real engine here in Node, then handed to the browser as the
 * save the app resumes from. Nothing is hand-written, so a state can never drift out of the
 * rules; the app reads the same `@clave/engine` build this module does.
 */

const HOTSEAT_KEY = "clave.hotseat.v1";

/** The seeds tried, in order, until one reaches the moment a spec asked for. */
const SEEDS = [101, 203, 307, 409, 511, 613, 719, 821, 923, 1031];

/**
 * A moment in a game, read from the active player's snapshot. The game it is read from
 * comes with it, so a moment can look one action ahead with {@link nextOf}.
 */
export type Moment = (view: PlayerSnapshot, envelope: ResumeEnvelope) => boolean;

/** How the driver plays while it looks for the moment. */
interface Manner {
  /** Stumble every 8-count: the short road to a lost dance. */
  readonly reckless?: boolean;
  /** Buy a Recovery early, so one reaches the hand a few 8-counts later. */
  readonly learnsRecovery?: boolean;
  /**
   * Let every call go unanswered. A pair that never answers pays a Connection each time, so
   * this is the road to a dropped call and then to the drop that ends the dance.
   */
  readonly ignoresCalls?: boolean;
  /** Buy a pose Flourish and keep it in hand, for the cierre on the song's last 8-count. */
  readonly savesPose?: boolean;
}

/** Whether a Flourish in the active player's hand is a pose — the Dip and the Ponche are. */
function isPose(envelope: ResumeEnvelope, instanceId: string): boolean {
  const held = snapshotFor(envelope.state, envelope.state.activeRole, content).self.hand.find(
    (entry) => entry.instanceId === instanceId,
  );
  return held?.card.type === "flourish" && held.card.pose;
}

/**
 * The first play that would answer the call standing over the active player, or undefined if
 * none would. The driver plays it; a spec that wants the answer clicked reads the same one, so
 * neither guesses which card in the hand the call asks for.
 */
export function answeringPlay(envelope: ResumeEnvelope): GameAction | undefined {
  const role = envelope.state.activeRole;
  const reading = snapshotFor(envelope.state, role, content);
  if (!reading.call || reading.call.met) return undefined;
  return reading.legalActions.find((action) => {
    if (!["PLAY_OPEN", "PLAY_MOVE", "TRANSITION", "PLAY_FLOURISH"].includes(action.type))
      return false;
    const attempt = applyEnvelopeAction(envelope, action);
    return attempt.ok && (snapshotFor(attempt.envelope.state, role, content).call?.met ?? false);
  });
}

function play(seed: number, moment: Moment, manner: Manner): ResumeEnvelope | null {
  let envelope = createEnvelope({ seed, gameId: `hot-${seed}` });
  let found: ResumeEnvelope | null = null;

  const view = () => snapshotFor(envelope.state, envelope.state.activeRole, content);
  const take = (action: GameAction) => {
    const result = applyEnvelopeAction(envelope, action);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    envelope = result.envelope;
    if (!found && moment(view(), envelope)) found = envelope;
  };
  const legal = <T extends GameAction["type"]>(type: T) =>
    view().legalActions.filter(
      (action): action is Extract<GameAction, { type: T }> => action.type === type,
    );
  const answering = () => answeringPlay(envelope);

  /**
   * Whether the partner could answer this call next 8-count. A pair that only asks for what
   * the other can dance keeps its Connection, which is what makes a whole song reachable.
   */
  const answerable = (call: Extract<GameAction, { type: "END_DANCE" }>) => {
    const ended = applyEnvelopeAction(envelope, call);
    if (!ended.ok || ended.envelope.state.status !== "playing") return false;
    const lesson = applyEnvelopeAction(ended.envelope, {
      type: "END_LESSON",
      role: ended.envelope.state.activeRole,
    });
    return lesson.ok && answeringPlay(lesson.envelope) !== undefined;
  };

  take({ type: "CONFIRM_HAND", role: "lead" });
  take({ type: "CONFIRM_HAND", role: "follow" });

  while (!found && envelope.state.status === "playing") {
    const role = envelope.state.activeRole;
    if (manner.reckless) {
      take({ type: "STUMBLE", role, recoveryInstanceId: null });
      if (envelope.state.status !== "playing") break;
      take({ type: "END_LESSON", role });
      continue;
    }

    // Dance: answer the call if it can be answered — unless this pair never does — and then
    // open the floor and move.
    const answer = manner.ignoresCalls ? undefined : answering();
    if (answer) take(answer);
    const opening = legal("PLAY_OPEN")[0];
    if (opening) take(opening);
    const move = legal("PLAY_MOVE")[0];
    if (move) take(move);
    const late = manner.ignoresCalls ? undefined : answering();
    if (late) take(late);
    const flourish = legal("PLAY_FLOURISH").find(
      (action) => !manner.savesPose || !isPose(envelope, action.flourishInstanceId),
    );
    if (flourish) take(flourish);
    if (found) break;

    // End it with the song card's own favoured call, or any other the partner could answer.
    // A pair that ignores its calls asks anyway, since an unanswered call is the point.
    const favoured = content.song.cards[envelope.state.songIndex]?.favouredCall ?? null;
    const calls = legal("END_DANCE").filter((action) => action.callId !== null);
    const wanted = calls.find((action) => action.callId === favoured);
    const call = [wanted, ...calls].find(
      (action) => action && (manner.ignoresCalls || answerable(action)),
    );
    take(call ?? { type: "END_DANCE", role, callId: null });
    if (found || envelope.state.status !== "playing") break;

    if (manner.learnsRecovery) {
      const recovery = legal("BUY_LESSON").find((action) => action.cardId === "rec_001");
      if (recovery) take(recovery);
    }
    if (manner.savesPose) {
      const pose = legal("BUY_LESSON").find((action) => action.cardId === "flo_005");
      if (pose) take(pose);
    }
    take({ type: "END_LESSON", role });
  }

  return found ?? (moment(view(), envelope) ? envelope : null);
}

/**
 * The first game that reaches `moment`, played from a fixed list of seeds so every run of a
 * spec gets the same dance. Throws rather than let a spec quietly test a state it did not ask
 * for — a content retune that makes a moment unreachable should fail loudly.
 */
export function gameAt(moment: Moment, manner: Manner = {}): ResumeEnvelope {
  for (const seed of SEEDS) {
    const envelope = play(seed, moment, manner);
    if (envelope) return envelope;
  }
  throw new Error(`No seeded game reached that moment (tried ${SEEDS.length} seeds).`);
}

/** The active player's view of a seeded game, for reading what the screen should say. */
export function viewOf(envelope: ResumeEnvelope): PlayerSnapshot {
  return snapshotFor(envelope.state, envelope.state.activeRole, content);
}

/** The game one action later, or null if the engine refuses it: a moment's look ahead. */
export function nextOf(envelope: ResumeEnvelope, action: GameAction): ResumeEnvelope | null {
  const result = applyEnvelopeAction(envelope, action);
  return result.ok ? result.envelope : null;
}

/** The whole song danced out, so the end screen has a full ladder to show. */
export const completedGame = () => gameAt((view) => view.status === "completed");

/** A dance that ran out of Connection: the other ending. */
export const lostGame = () => gameAt((view) => view.status === "lost", { reckless: true });

/**
 * Answers the hot-seat completion beacon here instead of letting it reach the server. The
 * server charges that beacon to the same ten-per-minute, per-IP budget as room creation
 * (`packages/server/src/app.ts` shares one `RoomCreateLimiter` between the two routes), so a
 * suite that dances songs to their end on two device profiles can spend the budget the online
 * specs need to open a room — the whole run comes from 127.0.0.1. Any test that plays a dance
 * to its ending calls this; what the beacon itself does is covered by
 * `packages/server/tests/hotseat-beacon.test.ts`.
 */
export async function keepCompletionLocal(page: Page): Promise<void> {
  await page.route("**/api/events/hotseat", (route) => route.fulfill({ status: 204 }));
}

/** Writes the save before the app loads, so the home screen offers to resume it. */
export async function seedHotseat(page: Page, envelope: ResumeEnvelope): Promise<void> {
  await page.addInitScript(([key, saved]) => localStorage.setItem(key, saved), [
    HOTSEAT_KEY,
    JSON.stringify(envelope),
  ] as const);
}

/**
 * Seeds the save, resumes it, and takes the screen as the player whose 8-count it is. A
 * finished song has nobody to pass to and opens on its own end screen.
 */
export async function resumeSeeded(page: Page, envelope: ResumeEnvelope): Promise<PlayerSnapshot> {
  const view = viewOf(envelope);
  await seedHotseat(page, envelope);
  await page.goto("/");
  await page.getByRole("button", { name: "Resume" }).click();
  if (view.status === "playing") await page.getByRole("button", { name: /^I’m the/ }).click();
  return view;
}
