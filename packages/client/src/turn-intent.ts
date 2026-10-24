import type { CardView, GameAction, PlayerSnapshot } from "@clave/engine";
import { alternatives } from "./phrasing.js";

/**
 * What the viewer has started but not yet committed on the floor. Today that is
 * only the two-step opening: a Position staged on an empty floor, waiting for
 * one of its matching Moves. Staging is a gesture, not a game action, so the
 * snapshot never stores it.
 *
 * `readDanceStep` reconciles the intent it is given. A staged Position that can
 * still open is the same object the caller passed. One that cannot is `NO_INTENT`.
 */
export interface TurnIntent {
  readonly stagedPositionId: string | null;
}

export const NO_INTENT: TurnIntent = { stagedPositionId: null };

export type DropResolution =
  | { kind: "stage"; intent: TurnIntent }
  | { kind: "dispatch"; action: GameAction; intent: TurnIntent }
  | { kind: "ignore" };

/** What one hand card offers the hand row and the enlarged card. */
export interface HandOffer {
  readonly instanceId: string;
  /** False only for the staged Position, which leaves the row and stays inspectable. */
  readonly inRow: boolean;
  readonly draggable: boolean;
  readonly playLabel: string | null;
  readonly sentence: string | null;
  readonly drop: DropResolution;
  readonly signal: Extract<GameAction, { type: "SIGNAL_CARD" }> | null;
  readonly stagedNote: string | null;
}

/** End, Stumble, and undo, in that order. Never mixed with the return control. */
export type DanceRowControl =
  | {
      readonly kind: "end";
      readonly action: Extract<GameAction, { type: "END_DANCE" }>;
      readonly label: string;
    }
  | {
      readonly kind: "stumble";
      readonly action: Extract<GameAction, { type: "STUMBLE" }>;
      readonly label: string;
    }
  | {
      readonly kind: "undo";
      readonly action: Extract<GameAction, { type: "UNDO_TURN" }>;
      readonly label: string;
    };

/** Either return the staged Position, or the row of dance actions. Never both. */
export type DanceControls =
  | { readonly kind: "return"; readonly label: string }
  | { readonly kind: "row"; readonly controls: readonly DanceRowControl[] };

/** The heading, instruction, opening guide, and buttons for the viewer's own dance step. */
export interface DanceTelling {
  readonly heading: string;
  readonly instruction: string | null;
  readonly openingGuide: string | null;
  readonly controls: DanceControls;
}

type LessonSource = PlayerSnapshot["lessonRefusals"][number]["source"];

/**
 * One reading of a snapshot plus the staged opening Position.
 * The floor hint is always set. The telling is set only on this viewer's dance step.
 */
export interface DanceStep {
  readonly intent: TurnIntent;
  readonly stagedPosition: CardView | null;
  readonly floorHint: string;
  readonly acceptsDrop: boolean;
  readonly offers: readonly HandOffer[];
  readonly telling: DanceTelling | null;
  readonly clearSignal: Extract<GameAction, { type: "CLEAR_SIGNAL" }> | null;
  readonly lessonSentence: (source: LessonSource, cardId: string) => string | null;
}

type OpeningAction = Extract<GameAction, { type: "PLAY_OPEN" }>;
type StepMoment = "staged" | "opening" | "move" | "transition" | "flourish" | "finish" | "not-step";

type AfterMove = "both" | "transition" | "flourish" | "neither";

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
function floorActionFor(
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
function reconcileIntent(view: PlayerSnapshot, intent: TurnIntent): TurnIntent {
  const id = intent.stagedPositionId;
  if (id === null) return intent;
  const stillValid =
    isViewersDanceStep(view) &&
    !view.table.position &&
    view.self.hand.some((entry) => entry.instanceId === id) &&
    openingActions(view).some((action) => action.positionInstanceId === id);
  return stillValid ? intent : NO_INTENT;
}

function stagedPosition(view: PlayerSnapshot, intent: TurnIntent): CardView | null {
  const id = reconcileIntent(view, intent).stagedPositionId;
  return view.self.hand.find((entry) => entry.instanceId === id) ?? null;
}

/** The hand cards the viewer may drag onto the floor right now. */
function floorDraggableIds(view: PlayerSnapshot, intent: TurnIntent): Set<string> {
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
function unavailableReason(
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
function lessonUnavailableReason(
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
function resolveDrop(view: PlayerSnapshot, intent: TurnIntent, instanceId: string): DropResolution {
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

/** Draggable, the play label, and a drop other than "ignore" are the same fact. */
function playLabel(drop: DropResolution): string | null {
  if (drop.kind === "ignore") return null;
  if (drop.kind === "stage") return "Stage Position";
  if (drop.action.type === "TRANSITION") return "Transition";
  if (drop.action.type === "PLAY_FLOURISH") return "Flourish";
  return "Dance move";
}

function countHint(view: PlayerSnapshot): string {
  if (view.activeRole === view.viewerRole) return "Your 8-count";
  const name = view.activeRole === "lead" ? "Lead" : "Follow";
  return `${name}\u2019s 8-count`;
}

/** Transition, Flourish, both, or neither. Heading and instruction share this. */
function afterMove(view: PlayerSnapshot): AfterMove {
  const transition = view.legalActions.some((action) => action.type === "TRANSITION");
  const flourish = view.legalActions.some((action) => action.type === "PLAY_FLOURISH");
  if (transition && flourish) return "both";
  if (transition) return "transition";
  if (flourish) return "flourish";
  return "neither";
}

/**
 * Staged Position, else a legal opening, else a Move still to play, else a legal
 * Transition, else a legal Flourish, else nothing left. Outside this viewer's
 * dance step none of those drops apply.
 */
function stepMoment(view: PlayerSnapshot, intent: TurnIntent): StepMoment {
  if (!isViewersDanceStep(view)) return "not-step";
  if (intent.stagedPositionId !== null) return "staged";
  if (openingActions(view).length > 0) return "opening";
  if (view.table.position && view.turn.moveCardId === null) return "move";
  const next = afterMove(view);
  if (next === "transition" || next === "both") return "transition";
  if (next === "flourish") return "flourish";
  return "finish";
}

function floorHintFor(view: PlayerSnapshot, moment: StepMoment): string {
  switch (moment) {
    case "staged":
      return "Now drag a highlighted matching Move here";
    case "opening":
      return "Drag a highlighted Position here";
    case "move":
      return view.legalActions.some((action) => action.type === "PLAY_MOVE")
        ? "Drag a highlighted Move here"
        : countHint(view);
    case "transition":
      return "Now drag a highlighted Position here";
    case "flourish":
      return "Now drag a highlighted Flourish here";
    case "finish":
    case "not-step":
      return countHint(view);
  }
}

function headingFor(moment: Exclude<StepMoment, "not-step">): string {
  switch (moment) {
    case "staged":
      return "Complete the opening";
    case "opening":
      return "Open the floor with a Position";
    case "move":
      return "Play a Move first";
    case "transition":
      return "Move played \u2014 add a Position";
    case "flourish":
      return "Add a Flourish\u2014or finish";
    case "finish":
      return "Finish the 8-count";
  }
}

function instructionFor(view: PlayerSnapshot, moment: StepMoment): string | null {
  if (moment === "move") {
    const card = view.table.position?.card;
    const floorPosition = card?.type === "position" ? card.position : null;
    return view.legalActions.some((action) => action.type === "PLAY_MOVE")
      ? `Current Position: ${floorPosition}. Play a Move whose top edge includes ${floorPosition}. Or choose Dance the basic or Stumble below.`
      : `No Move in your hand includes ${floorPosition}. Dance the basic or Stumble below.`;
  }
  if (view.turn.moveCardId === null) return null;
  switch (afterMove(view)) {
    case "both":
      return "Your Move is on the floor. Add a highlighted Position or Flourish, or finish.";
    case "transition":
      return "Your Move is on the floor. Add a highlighted Position, or finish the 8-count.";
    case "flourish":
      return "Your Move is on the floor. Add a highlighted Flourish, or finish the 8-count.";
    case "neither":
      return "Your Move is on the floor. Finish the 8-count when you\u2019re ready.";
  }
}

function openingGuide(view: PlayerSnapshot, stagedCard: CardView | null): string | null {
  if (openingActions(view).length === 0) return null;
  if (stagedCard?.card.type === "position")
    return `${stagedCard.card.name} is staged. Play a highlighted matching Move next.`;
  return "Stage any highlighted Position from your hand, then add a Move that dances from it.";
}

function danceControls(view: PlayerSnapshot, staged: boolean): DanceControls {
  if (staged) return { kind: "return", label: "Return Position to hand" };
  const controls: DanceRowControl[] = [];
  for (const action of view.legalActions) {
    // Taking the song. The calls are a picker of their own, not more buttons in this row.
    if (action.type === "END_DANCE" && action.callId === null)
      controls.push({
        kind: "end",
        action,
        label: view.turn.cardsPlayed === 0 ? "Dance the basic" : "Finish the 8-count",
      });
  }
  for (const action of view.legalActions) {
    if (action.type !== "STUMBLE") continue;
    const recovery = action.recoveryInstanceId
      ? view.self.hand.find((entry) => entry.instanceId === action.recoveryInstanceId)
      : null;
    controls.push({
      kind: "stumble",
      action,
      label: recovery
        ? `Stumble \u00b7 ${recovery.card.name}`
        : "Stumble \u00b7 \u22122 Connection",
    });
  }
  for (const action of view.legalActions) {
    if (action.type === "UNDO_TURN") controls.push({ kind: "undo", action, label: "Reset turn" });
  }
  return { kind: "row", controls };
}

function handOffers(view: PlayerSnapshot, intent: TurnIntent): HandOffer[] {
  const stagedId = intent.stagedPositionId;
  return view.self.hand.map((entry) => {
    const drop = resolveDrop(view, intent, entry.instanceId);
    const signal = view.legalActions.find(
      (action): action is Extract<GameAction, { type: "SIGNAL_CARD" }> =>
        action.type === "SIGNAL_CARD" && action.instanceId === entry.instanceId,
    );
    return {
      instanceId: entry.instanceId,
      inRow: entry.instanceId !== stagedId,
      draggable: drop.kind !== "ignore",
      playLabel: playLabel(drop),
      sentence: unavailableReason(view, intent, entry.instanceId),
      drop,
      signal: signal ?? null,
      stagedNote:
        entry.instanceId === stagedId ? "Staged on the floor, waiting for a matching Move" : null,
    };
  });
}

/** The floor hint, and on this viewer's dance step the heading, offers, and buttons. */
export function readDanceStep(view: PlayerSnapshot, intent: TurnIntent): DanceStep {
  const reconciled = reconcileIntent(view, intent);
  const stagedCard = stagedPosition(view, reconciled);
  const offers = handOffers(view, reconciled);
  const moment = stepMoment(view, reconciled);
  return {
    intent: reconciled,
    stagedPosition: stagedCard,
    floorHint: floorHintFor(view, moment),
    acceptsDrop: offers.some((offer) => offer.draggable),
    offers,
    telling:
      moment === "not-step"
        ? null
        : {
            heading: headingFor(moment),
            instruction: instructionFor(view, moment),
            openingGuide: openingGuide(view, stagedCard),
            controls: danceControls(view, moment === "staged"),
          },
    clearSignal:
      view.legalActions.find(
        (action): action is Extract<GameAction, { type: "CLEAR_SIGNAL" }> =>
          action.type === "CLEAR_SIGNAL",
      ) ?? null,
    lessonSentence: (source, cardId) => lessonUnavailableReason(view, source, cardId),
  };
}
