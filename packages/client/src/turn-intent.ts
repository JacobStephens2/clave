import type { CardView, GameAction, PlayerSnapshot } from "@clave/engine";
import { alternatives } from "./phrasing.js";

/**
 * What the viewer has started but not yet committed on the floor. Today that is
 * only the two-step opening: a Position staged on an empty floor, waiting for
 * one of its matching Moves.
 *
 * Every query in this module reconciles the intent it is given, so callers may
 * pass the intent they stored without reconciling it first.
 */
export interface TurnIntent {
  readonly stagedPositionId: string | null;
}

export const NO_INTENT: TurnIntent = { stagedPositionId: null };

export type DropResolution =
  | { kind: "stage"; intent: TurnIntent }
  | { kind: "dispatch"; action: GameAction; intent: TurnIntent }
  | { kind: "ignore" };

type OpeningAction = Extract<GameAction, { type: "PLAY_OPEN" }>;

const isViewersDanceStep = (view: PlayerSnapshot) =>
  view.status === "playing" && view.phase === "dance" && view.activeRole === view.viewerRole;

const openingActions = (view: PlayerSnapshot) =>
  view.legalActions.filter((action): action is OpeningAction => action.type === "PLAY_OPEN");

/** The hand card a single-card floor action plays, or null for any other action. */
function floorCardId(action: GameAction): string | null {
  if (action.type === "PLAY_MOVE") return action.moveInstanceId;
  if (action.type === "TRANSITION") return action.positionInstanceId;
  if (action.type === "PLAY_FLOURISH") return action.flourishInstanceId;
  return null;
}

/** The single-card floor action a hand card performs once a Position is on the table. */
export function floorActionFor(
  actions: readonly GameAction[],
  instanceId: string,
): GameAction | undefined {
  return actions.find((action) => floorCardId(action) === instanceId);
}

/**
 * The intent that is still valid against a fresh snapshot. A staged Position
 * survives only while it is in hand, the floor is empty, it is still the
 * viewer's dance step, and the Position still opens a legal pair.
 */
export function reconcileIntent(view: PlayerSnapshot, intent: TurnIntent): TurnIntent {
  const id = intent.stagedPositionId;
  if (id === null) return intent;
  const stillValid =
    isViewersDanceStep(view) &&
    !view.table.position &&
    view.self.hand.some((entry) => entry.instanceId === id) &&
    openingActions(view).some((action) => action.positionInstanceId === id);
  return stillValid ? intent : NO_INTENT;
}

export function stagedPosition(view: PlayerSnapshot, intent: TurnIntent): CardView | null {
  const id = reconcileIntent(view, intent).stagedPositionId;
  return view.self.hand.find((entry) => entry.instanceId === id) ?? null;
}

/** The hand cards the viewer may drag onto the floor right now. */
export function floorDraggableIds(view: PlayerSnapshot, intent: TurnIntent): Set<string> {
  const ids = new Set<string>();
  if (!isViewersDanceStep(view)) return ids;

  if (!view.table.position) {
    const staged = reconcileIntent(view, intent).stagedPositionId;
    for (const action of openingActions(view)) {
      if (staged === null) ids.add(action.positionInstanceId);
      else if (action.positionInstanceId === staged) ids.add(action.moveInstanceId);
    }
    return ids;
  }

  for (const action of view.legalActions) {
    const id = floorCardId(action);
    if (id !== null) ids.add(id);
  }
  return ids;
}

type HandCard = PlayerSnapshot["self"]["hand"][number]["card"];
type LessonSource = PlayerSnapshot["lessonRefusals"][number]["source"];

/**
 * Gesture sentences. They describe the two-step opening and a legal Stumble, which the
 * reducer does not know about, so they win over a refusal code. The pair check is membership
 * in `legalActions`, not a position match.
 */
function gestureSentence(
  view: PlayerSnapshot,
  intent: TurnIntent,
  instanceId: string,
  card: HandCard,
): string | null {
  if (card.type === "move" && !view.table.position) {
    const staged = stagedPosition(view, intent);
    if (!staged || staged.card.type !== "position") return "Stage a Position first";
    const paired = openingActions(view).some(
      (action) =>
        action.positionInstanceId === staged.instanceId && action.moveInstanceId === instanceId,
    );
    if (!paired) return `Needs ${alternatives(card.positions)} · ${staged.card.position} is staged`;
  }
  if (card.type === "position" && !view.table.position && stagedPosition(view, intent))
    return "A Position is already staged";
  if (
    card.type === "recovery" &&
    view.legalActions.some(
      (action) => action.type === "STUMBLE" && action.recoveryInstanceId === instanceId,
    )
  )
    return "Use with Stumble";
  return null;
}

/** Instructional sentence for a floor refusal code. Any code not listed here has no sentence. */
function floorSentence(view: PlayerSnapshot, card: HandCard, code: string): string | null {
  switch (code) {
    case "MOVE_LIMIT":
      return "You already danced a Move this 8-count";
    case "POSITION_MISMATCH": {
      const floor = view.table.position?.card;
      if (card.type === "move" && floor?.type === "position")
        return `Needs ${alternatives(card.positions)} · Floor is ${floor.position}`;
      if (card.type === "position" && !view.table.position)
        return `No Move in hand dances from ${card.position}`;
      return null;
    }
    case "TRANSITION_WINDOW_CLOSED":
      return view.turn.moveCardId === null
        ? "Play a Move first"
        : "Transition immediately after your Move";
    case "MOVE_REQUIRED":
      return "Play a Move first";
    case "FLOURISH_LIMIT":
      return "You already added a Flourish this 8-count";
    case "FLOURISH_MISMATCH":
      if (card.type !== "flourish" || card.positions === "any" || !view.turn.fromPosition)
        return null;
      return `Needs ${alternatives(card.positions)} · Move started from ${view.turn.fromPosition}`;
    case "ALREADY_DANCED":
      return "Use with Stumble before playing dance cards";
    default:
      return null;
  }
}

/**
 * Why a hand card cannot go to the floor on the viewer's dance step, or null when it can,
 * or when no explanation applies. Gesture sentences win. Otherwise the sentence is the
 * snapshot's refusal code, not a second check of the rule.
 */
export function unavailableReason(
  view: PlayerSnapshot,
  intent: TurnIntent,
  instanceId: string,
): string | null {
  if (!isViewersDanceStep(view)) return null;
  if (floorDraggableIds(view, intent).has(instanceId)) return null;
  const card = view.self.hand.find((entry) => entry.instanceId === instanceId)?.card;
  if (!card) return null;
  const gesture = gestureSentence(view, intent, instanceId, card);
  if (gesture) return gesture;
  const code = view.floorRefusals.find((entry) => entry.instanceId === instanceId)?.code;
  if (!code) return null;
  return floorSentence(view, card, code);
}

/**
 * Why the viewer cannot buy this market card, or null when the buy is legal or the code
 * has no instructional sentence. Cost and money are read from the snapshot.
 */
export function lessonUnavailableReason(
  view: PlayerSnapshot,
  source: LessonSource,
  cardId: string,
): string | null {
  const code = view.lessonRefusals.find(
    (entry) => entry.source === source && entry.cardId === cardId,
  )?.code;
  if (!code) return null;
  switch (code) {
    case "GAME_NOT_PLAYING":
    case "NOT_YOUR_TURN":
      return "Learn on your turn, after you dance";
    case "WRONG_PHASE":
      return "Learn after you dance this 8-count";
    case "LESSON_LIMIT":
      return "You already took a lesson this turn";
    case "PRIVATE_LESSON_TAKEN":
      return "Private lesson already taken this round";
    case "NOT_ENOUGH_MONEY":
      return `Costs $${view.rules.lessonCosts[source]} · you have $${view.self.money}`;
    default:
      return null;
  }
}

/** What playing a hand card to the floor, by drop or tap, does: stage it, play an action, or nothing. */
export function resolveDrop(
  view: PlayerSnapshot,
  intent: TurnIntent,
  instanceId: string,
): DropResolution {
  if (!floorDraggableIds(view, intent).has(instanceId)) return { kind: "ignore" };

  if (!view.table.position) {
    const staged = reconcileIntent(view, intent).stagedPositionId;
    if (staged === null) return { kind: "stage", intent: { stagedPositionId: instanceId } };
    const opening = openingActions(view).find(
      (action) => action.positionInstanceId === staged && action.moveInstanceId === instanceId,
    );
    return opening ? { kind: "dispatch", action: opening, intent: NO_INTENT } : { kind: "ignore" };
  }

  const action = floorActionFor(view.legalActions, instanceId);
  return action ? { kind: "dispatch", action, intent: NO_INTENT } : { kind: "ignore" };
}
