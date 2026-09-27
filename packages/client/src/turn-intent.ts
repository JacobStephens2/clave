import type { CardView, GameAction, PlayerSnapshot } from "@clave/engine";

/**
 * What the viewer has started but not yet committed on the floor. Today that is
 * only the two-step opening: a Position staged on an empty floor, waiting for
 * one of its matching Moves.
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

/** The single-card floor action a hand card performs once a Position is on the table. */
export function floorActionFor(
  actions: readonly GameAction[],
  instanceId: string,
): GameAction | undefined {
  return actions.find(
    (action) =>
      (action.type === "PLAY_MOVE" && action.moveInstanceId === instanceId) ||
      (action.type === "TRANSITION" && action.positionInstanceId === instanceId) ||
      (action.type === "PLAY_FLOURISH" && action.flourishInstanceId === instanceId),
  );
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
export function draggableCardIds(view: PlayerSnapshot, intent: TurnIntent): Set<string> {
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
    if (action.type === "PLAY_MOVE") ids.add(action.moveInstanceId);
    if (action.type === "TRANSITION") ids.add(action.positionInstanceId);
    if (action.type === "PLAY_FLOURISH") ids.add(action.flourishInstanceId);
  }
  return ids;
}

/** What dropping a hand card on the floor does: stage it, play an action, or nothing. */
export function resolveDrop(
  view: PlayerSnapshot,
  intent: TurnIntent,
  instanceId: string,
): DropResolution {
  if (!draggableCardIds(view, intent).has(instanceId)) return { kind: "ignore" };

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
