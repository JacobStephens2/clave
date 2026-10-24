import type { CardView, GameAction, PlayerSnapshot, Role } from "@clave/engine";
import { alternatives } from "./phrasing.js";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
const other = (role: Role): Role => (role === "lead" ? "follow" : "lead");

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
  /** What playing it costs or clears, when the label alone does not say. */
  readonly playNote: string | null;
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
      /** What a Recovery card saves, when the label names the card rather than the cost. */
      readonly note: string | null;
    }
  | {
      readonly kind: "undo";
      readonly action: Extract<GameAction, { type: "UNDO_TURN" }>;
      readonly label: string;
    };

/** Playing one Position alone: the hold, in exchange for the song card's bonus. */
export interface HoldControl {
  readonly action: Extract<GameAction, { type: "ADJUST" }>;
  readonly label: string;
  readonly note: string;
}

/** Either return the staged Position, or the row of dance actions. Never both. */
export type DanceControls =
  | {
      readonly kind: "return";
      readonly label: string;
      /** The staged Position can also be taken as the hold, with no Move. */
      readonly hold: HoldControl | null;
    }
  | { readonly kind: "row"; readonly controls: readonly DanceRowControl[] };

/** One call the viewer could make as this 8-count ends. */
export interface CallOffer {
  readonly callId: string;
  readonly action: Extract<GameAction, { type: "END_DANCE" }>;
  readonly name: string;
  /** What the partner must dance, in the second person: "include a Flourish". */
  readonly ask: string;
  readonly style: number;
  /** The call this 8-count's song card asks for: answered, it pays `inPocket` more. */
  readonly favoured: boolean;
  readonly inPocket: number;
  /**
   * What the next link of the afinque chain would add on top of the call's Style. The answer
   * lands after this 8-count ends, so it is read from the run this 8-count will leave behind.
   */
  readonly afinque: number;
  /** The whole option in one sentence, for the screen reader. */
  readonly sentence: string;
}

/** The "Make a call" disclosure: its options, or the one line that says why there are none. */
export interface CallPicker {
  readonly label: string;
  readonly options: readonly CallOffer[];
  /** What taking the song would have paid, when a call gives that up. */
  readonly givesUp: string | null;
  /**
   * What leaving the standing call unanswered costs, reprinted because the open sheet covers
   * the banner. Set only while a call stands unmet over the player holding the sheet.
   */
  readonly price: string | null;
  /** Why no call can be made right now. Set only when there are no options. */
  readonly closed: string | null;
}

/** The heading, instruction, opening guide, and buttons for the viewer's own dance step. */
export interface DanceTelling {
  readonly heading: string;
  readonly instruction: string | null;
  /** One short line that stays on screen at phone widths, where the instruction is hidden. */
  readonly note: string | null;
  readonly openingGuide: string | null;
  readonly picker: CallPicker | null;
  readonly controls: DanceControls;
}

/** Discarding one Recovery card to clear the call standing over you. */
export interface CoverOffer {
  readonly action: Extract<GameAction, { type: "COVER_CALL" }>;
  readonly label: string;
  readonly note: string;
}

/**
 * The call standing over the 8-count being danced, worded for whoever is looking: the player
 * answering it, or the partner who made it and is watching.
 */
export interface CallStanding {
  /** True on the device of the player whose 8-count the call stands over. */
  readonly answering: boolean;
  readonly headline: string;
  readonly ask: string;
  readonly reward: string;
  /** What leaving it unanswered costs. Set only on the device that has to answer it. */
  readonly price: string | null;
  /** Whether the dance so far answers the call. Public: the floor is public. */
  readonly met: boolean;
  readonly state: string;
  readonly covers: readonly CoverOffer[];
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
  /** Set on both devices while a call stands, read from the snapshot's public call. */
  readonly call: CallStanding | null;
  readonly clearSignal: Extract<GameAction, { type: "CLEAR_SIGNAL" }> | null;
  readonly lessonSentence: (source: LessonSource, cardId: string) => string | null;
}

type OpeningAction = Extract<GameAction, { type: "PLAY_OPEN" }>;
type StepMoment =
  "staged" | "opening" | "hold" | "move" | "transition" | "flourish" | "finish" | "not-step";

type AfterMove = "both" | "transition" | "flourish" | "neither";

const isViewersDanceStep = (view: PlayerSnapshot) =>
  view.status === "playing" && view.phase === "dance" && view.activeRole === view.viewerRole;

const openingActions = (view: PlayerSnapshot) =>
  view.legalActions.filter((action): action is OpeningAction => action.type === "PLAY_OPEN");

/** Taking or adjusting the hold with one named Position, when the reducer allows it. */
function holdActionFor(
  view: PlayerSnapshot,
  instanceId: string,
): Extract<GameAction, { type: "ADJUST" }> | undefined {
  return view.legalActions.find(
    (action): action is Extract<GameAction, { type: "ADJUST" }> =>
      action.type === "ADJUST" && action.positionInstanceId === instanceId,
  );
}

/** The hand card a single-card floor action plays, or null for any other action. */
function floorCardId(action: GameAction): string | null {
  if (action.type === "PLAY_MOVE") return action.moveInstanceId;
  if (action.type === "TRANSITION" || action.type === "ADJUST") return action.positionInstanceId;
  if (action.type === "PLAY_FLOURISH") return action.flourishInstanceId;
  if (action.type === "COVER_CALL") return action.recoveryInstanceId;
  return null;
}

/**
 * The single-card floor action a hand card performs once a Position is on the table. A Position
 * played before the dance takes the hold; after a Move the same card carries the dance onward.
 */
function floorActionFor(view: PlayerSnapshot, instanceId: string): GameAction | undefined {
  const actions = view.legalActions.filter((action) => floorCardId(action) === instanceId);
  if (actions.length < 2) return actions[0];
  const meant = view.turn.cardsPlayed === 0 ? "ADJUST" : "TRANSITION";
  return actions.find((action) => action.type === meant) ?? actions[0];
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
    // A Position no Move in hand dances from can still take the hold and open the floor.
    if (staged === null)
      for (const action of view.legalActions)
        if (action.type === "ADJUST") ids.add(action.positionInstanceId);
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
    case "SAME_POSITION":
      return card.type === "position" ? `The floor is already ${card.position}` : null;
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
    if (staged === null) {
      // The two-step opening comes first: a Position a Move can dance from is staged, not held.
      const opens = openingActions(view).some((action) => action.positionInstanceId === instanceId);
      if (opens) return { kind: "stage", intent: { stagedPositionId: instanceId } };
      const hold = holdActionFor(view, instanceId);
      return hold ? { kind: "dispatch", action: hold, intent: NO_INTENT } : { kind: "ignore" };
    }
    const opening = openingActions(view).find(
      (action) => action.positionInstanceId === staged && action.moveInstanceId === instanceId,
    );
    return opening ? { kind: "dispatch", action: opening, intent: NO_INTENT } : { kind: "ignore" };
  }

  const action = floorActionFor(view, instanceId);
  return action ? { kind: "dispatch", action, intent: NO_INTENT } : { kind: "ignore" };
}

/** Draggable, the play label, and a drop other than "ignore" are the same fact. */
function playLabel(view: PlayerSnapshot, drop: DropResolution): string | null {
  if (drop.kind === "ignore") return null;
  if (drop.kind === "stage") return "Stage Position";
  switch (drop.action.type) {
    case "TRANSITION":
      return "Transition";
    case "PLAY_FLOURISH":
      return "Flourish";
    case "ADJUST":
      return view.table.position ? "Adjust the hold" : "Take the hold";
    case "COVER_CALL":
      return "Cover the call";
    default:
      return "Dance move";
  }
}

/** What the hold gives up, and what a cover clears, in plain words. */
function playNote(view: PlayerSnapshot, drop: DropResolution): string | null {
  if (drop.kind !== "dispatch") return null;
  if (drop.action.type === "ADJUST")
    return view.table.position
      ? "Adjusts the hold before you dance — gives up the song bonus this 8-count."
      : "Opens the floor with this Position alone — gives up the song bonus this 8-count.";
  if (drop.action.type === "COVER_CALL") return coverNote(view);
  return null;
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
  // No Move to dance, but a Position in hand: the hold is the way out of the 8-count.
  if (
    view.turn.moveCardId === null &&
    !view.legalActions.some((action) => action.type === "PLAY_MOVE") &&
    view.legalActions.some((action) => action.type === "ADJUST")
  )
    return "hold";
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
    case "hold":
      return "Drag a highlighted Position here for the hold";
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

function headingFor(view: PlayerSnapshot, moment: Exclude<StepMoment, "not-step">): string {
  switch (moment) {
    case "staged":
      return "Complete the opening";
    case "opening":
      return "Open the floor with a Position";
    case "hold":
      return view.table.position
        ? "Adjust the hold\u2014or dance the basic"
        : "Take the hold\u2014or dance the basic";
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

/** The Position on the floor, by name, or null on an empty floor. */
function floorPosition(view: PlayerSnapshot): string | null {
  const card = view.table.position?.card;
  return card?.type === "position" ? card.position : null;
}

/**
 * The ways out of the 8-count the snapshot still offers, named as their buttons name them.
 * Taking the hold spends the basic and the Stumble with it, so the sentence has to read the
 * actions rather than assume the two are always there.
 */
function outsFor(view: PlayerSnapshot): string[] {
  const basic =
    view.turn.cardsPlayed === 0 &&
    view.legalActions.some((action) => action.type === "END_DANCE" && action.callId === null);
  const stumble = view.legalActions.some((action) => action.type === "STUMBLE");
  return [basic ? "Dance the basic" : null, stumble ? "Stumble" : null].filter(
    (out): out is string => out !== null,
  );
}

function instructionFor(view: PlayerSnapshot, moment: StepMoment): string | null {
  if (moment === "hold") {
    const floor = floorPosition(view);
    return floor
      ? `No Move in your hand includes ${floor}. A Position alone adjusts the hold: that gives up the song bonus, and you can still call.`
      : "No Move in your hand pairs with a Position. One Position alone takes the hold: that gives up the song bonus, and leaves a floor to call from.";
  }
  if (moment === "move") {
    const floor = floorPosition(view);
    const hold = view.legalActions.some((action) => action.type === "ADJUST")
      ? " A Position alone adjusts the hold instead, giving up the song bonus."
      : "";
    const outs = outsFor(view);
    return view.legalActions.some((action) => action.type === "PLAY_MOVE")
      ? `Current Position: ${floor}. Play a Move whose top edge includes ${floor}.${hold}${
          outs.length > 0
            ? ` Or choose ${alternatives(outs)} below.`
            : " Or finish the 8-count below."
        }`
      : `No Move in your hand includes ${floor}.${
          outs.length > 0 ? ` ${alternatives(outs)} below.` : " Finish the 8-count below."
        }`;
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

/** The one thing about this step a phone must still read with the instruction hidden. */
function noteFor(view: PlayerSnapshot): string | null {
  return view.legalActions.some((action) => action.type === "ADJUST")
    ? "The hold gives up this 8-count\u2019s song bonus."
    : null;
}

function openingGuide(view: PlayerSnapshot, stagedCard: CardView | null): string | null {
  if (openingActions(view).length === 0) return null;
  if (stagedCard?.card.type === "position") {
    const hold = holdActionFor(view, stagedCard.instanceId)
      ? " Or take the hold with it alone — that gives up the song bonus."
      : "";
    return `${stagedCard.card.name} is staged. Play a highlighted matching Move next.${hold}`;
  }
  return "Stage any highlighted Position from your hand, then add a Move that dances from it.";
}

const COVER_NOTE = "Keeps your Connection and the clean phrase. The afinque chain starts over.";

/** The extra Style the song card pays for the call it asked for, when it asked for this one. */
function pocketStyle(view: PlayerSnapshot, call: NonNullable<PlayerSnapshot["call"]>): number {
  return call.inPocket ? (view.rules.call?.inPocketStyle ?? 0) : 0;
}

/** What answering the call standing over this 8-count pays, from its printed Style upwards. */
function answerStyle(view: PlayerSnapshot, call: NonNullable<PlayerSnapshot["call"]>): number {
  return call.style + pocketStyle(view, call) + view.afinque.nextBonus;
}

/**
 * What the cover is for, or — once the 8-count already answers the call, which the rulebook
 * still allows a cover over (§7.1) — what spending the Recovery there would throw away.
 */
function coverNote(view: PlayerSnapshot): string {
  const call = view.call;
  if (!call?.met) return COVER_NOTE;
  const style = answerStyle(view, call);
  return style > 0
    ? `Your 8-count already answers this call — covering gives up its ${style} Style and breaks the chain.`
    : "Your 8-count already answers this call — covering gives up the answer and breaks the chain.";
}

/** What a bonus pays, in the rulebook's words: "+4 Style", "+1 Style and +1 Connection". */
function bonusWords(effect: PlayerSnapshot["turn"]["songBonus"]): string | null {
  if (!effect) return null;
  const parts = [
    effect.style > 0 ? `+${effect.style} Style` : null,
    effect.connection > 0 ? `+${effect.connection} Connection` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" and ") : null;
}

/** A score change with its sign, the way the HUD shows one: "+1 Style", "−1 Connection". */
function netWords(net: NonNullable<PlayerSnapshot["turn"]["ifEndedNow"]>): string | null {
  const signed = (value: number) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`);
  const parts = [
    net.style !== 0 ? `${signed(net.style)} Style` : null,
    net.connection !== 0 ? `${signed(net.connection)} Connection` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Whether ending the 8-count here drops the call standing over it, unanswered. */
function dropsCall(view: PlayerSnapshot): boolean {
  const call = view.call;
  return call !== null && call.byRole !== view.viewerRole && !call.met;
}

/**
 * Taking the song: what ending the 8-count here really pays, netted by the engine — the song
 * card and the call standing over it together — plus what it costs beside the score, so the
 * gold control can never promise a Connection it hands straight back to a dropped call.
 */
function endLabel(view: PlayerSnapshot): string {
  const net = view.turn.ifEndedNow;
  const bonus = bonusWords(view.turn.songBonus);
  const verb =
    view.turn.cardsPlayed === 0
      ? "Dance the basic"
      : bonus
        ? "Take the song"
        : "Finish the 8-count";
  const tail = [
    net ? netWords(net) : bonus,
    dropsCall(view) ? "drops the call" : null,
    net?.lost ? "ends the dance" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return tail ? `${verb} · ${tail}` : verb;
}

/** One call option read aloud whole, so a screen reader needs no visual scan. */
function callSentence(option: Omit<CallOffer, "sentence">): string {
  const pays =
    option.style > 0 ? `Pays ${option.style} Style when answered.` : "Pays no Style of its own.";
  const pocket =
    option.favoured && option.inPocket > 0
      ? ` This song card favours it: ${option.inPocket} more Style.`
      : "";
  const chain = option.afinque > 0 ? ` The next answer in a row adds ${option.afinque} Style.` : "";
  return `${option.name}. Ask your partner to ${option.ask}. ${pays}${pocket}${chain}`;
}

/**
 * Why no call can be made as this 8-count ends, read from the state the engine guards: the
 * sentence, and the words the greyed trigger carries itself, since on the table there is no
 * room for a printed line beside it.
 */
function callsClosed(view: PlayerSnapshot): { label: string; reason: string } | null {
  if (view.phrase.count >= view.rules.phraseLength)
    return {
      label: "No call · the phrase ends here",
      reason: "The phrase ends here — there is nothing to call into.",
    };
  if (!view.table.position)
    return {
      label: "No call · open the floor first",
      reason: "Leave a Position on the floor to make a call.",
    };
  return null;
}

/** The seven calls, each with the END_DANCE the snapshot says is legal for it. */
function callPicker(view: PlayerSnapshot): CallPicker | null {
  if (view.calls.length === 0) return null;
  const inPocketStyle = view.rules.call?.inPocketStyle ?? 0;
  const options = view.calls.flatMap<CallOffer>((call) => {
    const action = view.legalActions.find(
      (entry): entry is Extract<GameAction, { type: "END_DANCE" }> =>
        entry.type === "END_DANCE" && entry.callId === call.id,
    );
    if (!action) return [];
    const option = {
      callId: call.id,
      action,
      name: call.name,
      ask: call.ask,
      style: call.style,
      favoured: call.favoured,
      inPocket: call.favoured ? inPocketStyle : 0,
      // The chain this 8-count will leave behind: the answer to this call lands after it.
      afinque: view.afinque.ifCalledNow.nextBonus,
    };
    return [{ ...option, sentence: callSentence(option) }];
  });
  const closed = options.length === 0 ? callsClosed(view) : null;
  if (options.length === 0 && closed === null) return null;
  const given = bonusWords(view.turn.songBonus);
  return {
    label: closed ? closed.label : "Make a call",
    options,
    givesUp: given ? `A call gives up the song’s ${given}.` : null,
    // The sheet covers the banner, so the standing call's price is reprinted inside it: both
    // ways out of an 8-count with a call unmet name the same cost.
    price: standingPrice(view),
    closed: closed?.reason ?? null,
  };
}

/** The Recovery cards in hand that can clear the call standing over the viewer. */
function coverOffers(view: PlayerSnapshot): CoverOffer[] {
  return view.legalActions.flatMap<CoverOffer>((action) => {
    if (action.type !== "COVER_CALL") return [];
    const card = view.self.hand.find(
      (entry) => entry.instanceId === action.recoveryInstanceId,
    )?.card;
    if (!card) return [];
    return [{ action, label: `Cover with ${card.name}`, note: coverNote(view) }];
  });
}

/**
 * What answering the standing call pays, in the order the rules add it up: the call's own
 * Style, the pocket when the song card asked for it, and the afinque link on top. One reading,
 * so the banner and the hot-seat pass screen can never name different numbers for one call.
 */
function answerReward(view: PlayerSnapshot, call: NonNullable<PlayerSnapshot["call"]>): string {
  const inPocket = pocketStyle(view, call);
  return [
    call.style > 0 ? `${call.style} Style` : "No Style of its own",
    inPocket > 0 ? `★ +${inPocket} in the pocket` : null,
    view.afinque.nextBonus > 0 ? `+${view.afinque.nextBonus} afinque` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What dropping the call costs the player who has to answer it: the Connection the rules take
 * for a miss, and the phrase's clean bonus with it while that bonus is still in play. A
 * stumble or an earlier dropped call has already taken that bonus (`scorePhrase`), so from
 * then on the drop costs the Connection alone.
 */
function missPrice(view: PlayerSnapshot): string | null {
  const connection = view.rules.call?.missConnectionCost ?? 0;
  if (connection === 0) return null;
  const clean =
    view.phrase.stumbled || view.phrase.droppedCall
      ? ""
      : `, and the phrase loses its clean +${view.rules.phraseBonuses.clean}`;
  return `Unanswered: −${connection} Connection${clean}`;
}

/** The price of the 8-count ending unanswered, on the device that has to answer it. */
function standingPrice(view: PlayerSnapshot): string | null {
  const call = view.call;
  if (!call || call.byRole === view.viewerRole || call.met) return null;
  return missPrice(view);
}

/**
 * An ask is printed in the caller's own voice ("a Move I have already danced"), so every
 * surface that puts one in front of the answering player quotes it with the caller named:
 * the "I" in it is always theirs.
 */
const askedBy = (caller: string, ask: string) => `${caller} asks: ${ask}.`;

/** The standing call, worded for the player answering it or the partner watching. */
function callStanding(view: PlayerSnapshot): CallStanding | null {
  const call = view.call;
  if (!call) return null;
  const answering = call.byRole !== view.viewerRole;
  const answerer = roleName(other(call.byRole));
  return {
    answering,
    headline: answering ? `${roleName(call.byRole)} calls ${call.name}` : `You called ${call.name}`,
    // The ask is printed in the caller's own voice, so it is quoted, never addressed.
    ask: answering ? askedBy(roleName(call.byRole), call.ask) : `You asked: ${call.ask}.`,
    reward: answerReward(view, call),
    price: standingPrice(view),
    met: call.met,
    state: answering
      ? call.met
        ? "Answered · finish to collect"
        : "Not answered yet"
      : call.met
        ? `${answerer} has it`
        : `${answerer} is answering`,
    covers: coverOffers(view),
  };
}

/**
 * The call the player taking the screen must answer, for the hot-seat handoff. `role` is the
 * player the screen is being passed to, who is not the snapshot's viewer.
 */
export function callHandoff(
  view: PlayerSnapshot,
  role: Role,
): {
  caller: string;
  name: string;
  ask: string;
  reward: string;
  price: string | null;
  sentence: string;
} | null {
  const call = view.call;
  if (!call || call.byRole === role) return null;
  const caller = roleName(call.byRole);
  return {
    caller,
    name: call.name,
    // Quoted and attributed, exactly as the banner the next screen shows words it.
    ask: askedBy(caller, call.ask),
    reward: answerReward(view, call),
    price: call.met ? null : missPrice(view),
    sentence: `${caller} called ${call.name}: ${call.ask}. Your answer.`,
  };
}

/** The call the viewer just made, which stands over the partner from the next 8-count. */
export function callMadeNote(view: PlayerSnapshot): string | null {
  const callId = view.turn.callMade;
  if (callId === null) return null;
  const name = view.calls.find((call) => call.id === callId)?.name;
  return name ? `You called ${name}. Your partner answers next 8-count.` : null;
}

/** Playing one Position alone, with no Move: taking or adjusting the hold. */
function holdControl(view: PlayerSnapshot, positionInstanceId: string): HoldControl | null {
  const action = holdActionFor(view, positionInstanceId);
  if (!action) return null;
  return {
    action,
    label: "Take the hold instead",
    note: "Opens the floor with this Position alone — gives up the song bonus.",
  };
}

function danceControls(view: PlayerSnapshot, staged: string | null): DanceControls {
  if (staged !== null)
    return { kind: "return", label: "Return Position to hand", hold: holdControl(view, staged) };
  const controls: DanceRowControl[] = [];
  for (const action of view.legalActions) {
    // Taking the song. The calls are a picker of their own, not more buttons in this row.
    if (action.type === "END_DANCE" && action.callId === null)
      controls.push({ kind: "end", action, label: endLabel(view) });
  }
  const stumbleCost = view.rules.stumble.defaultConnectionCost;
  for (const action of view.legalActions) {
    if (action.type !== "STUMBLE") continue;
    const recovery = action.recoveryInstanceId
      ? view.self.hand.find((entry) => entry.instanceId === action.recoveryInstanceId)
      : null;
    const saves = recovery?.card.type === "recovery" ? recovery.card.connectionCost : null;
    controls.push({
      kind: "stumble",
      action,
      // The cost is this game's own, never a number spelled out here.
      label: recovery
        ? `Stumble \u00b7 ${recovery.card.name}`
        : `Stumble \u00b7 \u2212${stumbleCost} Connection`,
      note:
        recovery && saves !== null
          ? `${recovery.card.name}: \u2212${saves} Connection instead of \u2212${stumbleCost}.`
          : null,
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
      playLabel: playLabel(view, drop),
      playNote: playNote(view, drop),
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
            heading: headingFor(view, moment),
            instruction: instructionFor(view, moment),
            note: noteFor(view),
            openingGuide: openingGuide(view, stagedCard),
            picker: moment === "staged" ? null : callPicker(view),
            controls: danceControls(view, moment === "staged" ? reconciled.stagedPositionId : null),
          },
    call: callStanding(view),
    clearSignal:
      view.legalActions.find(
        (action): action is Extract<GameAction, { type: "CLEAR_SIGNAL" }> =>
          action.type === "CLEAR_SIGNAL",
      ) ?? null,
    lessonSentence: (source, cardId) => lessonUnavailableReason(view, source, cardId),
  };
}
