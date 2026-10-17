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

/**
 * Why a hand card cannot go to the floor on the viewer's dance step, or null when it can,
 * or when no explanation applies.
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
  if (view.turn.moveCardId !== null) {
    if (card.type === "move") return "You already danced a Move this 8-count";
    if (card.type === "position") return "Transition immediately after your Move";
    if (card.type === "recovery") return "Use with Stumble before playing dance cards";
    if (view.turn.flourished) return "You already added a Flourish this 8-count";
    if (card.positions !== "any" && view.turn.fromPosition)
      return `Needs ${alternatives(card.positions)} · Move started from ${view.turn.fromPosition}`;
    return null;
  }
  const floor = view.table.position?.card;
  const staged = stagedPosition(view, intent)?.card;

  switch (card.type) {
    case "move":
      if (floor?.type === "position")
        return card.positions.includes(floor.position)
          ? null
          : `Needs ${alternatives(card.positions)} · Floor is ${floor.position}`;
      if (staged?.type === "position")
        return `Needs ${alternatives(card.positions)} · ${staged.position} is staged`;
      return "Stage a Position first";
    case "position":
      if (floor) return "Play a Move first";
      return staged
        ? "A Position is already staged"
        : `No Move in hand dances from ${card.position}`;
    case "flourish":
      return "Play a Move first";
    case "recovery":
      return "Use with Stumble";
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
