import {
  cardsById as defaultCardsById,
  content as defaultContent,
  contentHash as defaultContentHash,
  hashCanonical,
  type BonusCondition,
  type BonusEffect,
  type Call,
  type CallRules,
  type ContentSet,
  type DanceCard,
  type FlourishCard,
  type MoveCard,
  type Position,
} from "@clave/content";
import { shuffle } from "./rng.js";
import {
  ENGINE_VERSION,
  GameActionSchema,
  type ApplyResult,
  type CardInstance,
  type GameAction,
  type GameState,
  type Market,
  type PhraseStats,
  type PlayerState,
  type Role,
  type StandingCall,
  type TurnCheckpoint,
  type TurnDance,
  otherRole,
} from "./schemas.js";

interface CreateGameOptions {
  seed: number;
  gameId?: string;
  content?: ContentSet;
  contentHash?: string;
}

class RuleViolation extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const emptyTurnDance = (): TurnDance => ({
  moveCardId: null,
  moveStyle: null,
  fromPosition: null,
  cardsPlayed: 0,
  positionsPlayed: 0,
  flourished: false,
  posePlayed: false,
  changedPosition: false,
  stumbled: false,
  canTransition: false,
  boughtLesson: false,
  learnedFromPartner: false,
  bonusStyle: 0,
  bonusConnection: 0,
  callMade: null,
  callAnswered: false,
  callDropped: false,
  callCovered: false,
  callStyle: 0,
  adjusted: false,
  rung: "pending",
});

const emptyPhrase = (number: PhraseStats["number"]): PhraseStats => ({
  number,
  stumbled: false,
  positionsDancedFrom: [],
  flourishedBy: { lead: false, follow: false },
  poseOnFinalCount: false,
  learnedBy: { lead: false, follow: false },
  privateLessonTakenThisRound: false,
  droppedCall: false,
});

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cardsFor(contentSet: ContentSet): Record<string, DanceCard> {
  if (contentSet === defaultContent) return defaultCardsById;
  return Object.fromEntries(contentSet.cards.map((card) => [card.id, card]));
}

function expanded(entries: readonly { cardId: string; count: number }[]): string[] {
  return entries.flatMap(({ cardId, count }) => Array.from({ length: count }, () => cardId));
}

function takeDisplay(deck: string[], amount: number): string[] {
  return deck.splice(0, Math.min(amount, deck.length));
}

export function createGame(options: CreateGameOptions): GameState {
  const contentSet = options.content ?? defaultContent;
  const resolvedHash =
    options.contentHash ??
    (contentSet === defaultContent ? defaultContentHash : hashCanonical(contentSet));
  let rngState = options.seed >>> 0;
  let nextInstance = 1;

  const makeInstances = (role: Role, ids: readonly string[]): CardInstance[] =>
    ids.map((cardId) => ({ instanceId: `${role}-${nextInstance++}`, cardId, owner: role }));

  const makePlayer = (role: Role): PlayerState => {
    const instances = makeInstances(role, expanded(contentSet.decks.starter));
    const shuffled = shuffle(instances, rngState);
    rngState = shuffled.state;
    return {
      role,
      hand: shuffled.items.splice(0, contentSet.rules.handSize),
      drawPile: shuffled.items,
      discardPile: [],
      money: contentSet.rules.startingMoney,
      mulliganUsed: false,
      ready: false,
    };
  };

  const lead = makePlayer("lead");
  const follow = makePlayer("follow");
  const intermediate = shuffle(expanded(contentSet.decks.intermediate), rngState);
  rngState = intermediate.state;
  const advanced = shuffle(expanded(contentSet.decks.advanced), rngState);
  rngState = advanced.state;
  const intermediateDeck = intermediate.items;
  const market: Market = {
    intermediateDisplay: takeDisplay(intermediateDeck, 3),
    intermediateDeck,
    advancedDisplay: [],
    advancedDeck: advanced.items,
  };

  return {
    engineVersion: ENGINE_VERSION,
    contentHash: resolvedHash,
    gameId: options.gameId ?? `clave-${options.seed >>> 0}`,
    seed: options.seed >>> 0,
    rngState,
    nextInstance,
    sequence: 0,
    status: "setup",
    terminalReason: null,
    activeRole: "lead",
    setupRole: "lead",
    phase: "mulligan",
    songIndex: -1,
    currentSongId: null,
    players: { lead, follow },
    shared: {
      connection: contentSet.rules.initialConnection,
      style: contentSet.rules.initialStyle,
      afinque: 0,
    },
    market,
    table: { position: null, move: null, flourish: null },
    phrase: emptyPhrase(1),
    moveHistory: [],
    danceHistory: [],
    turnDance: emptyTurnDance(),
    signal: null,
    call: null,
    log: [
      {
        sequence: 0,
        role: null,
        kind: "system",
        message:
          "Lead checks their opening hand first. Choose a Position and matching Move to open the dance.",
      },
    ],
    checkpoint: null,
    finalScore: null,
    rating: null,
  };
}

function fail(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new RuleViolation(code, message);
}

function log(
  state: GameState,
  kind: GameState["log"][number]["kind"],
  message: string,
  role: Role | null = null,
): void {
  state.log.push({ sequence: state.sequence + 1, role, kind, message });
}

function roleName(role: Role): string {
  return role === "lead" ? "Lead" : "Follow";
}

function card(contentSet: ContentSet, cardId: string): DanceCard {
  const result = cardsFor(contentSet)[cardId];
  fail(result, "UNKNOWN_CARD", `Unknown card ${cardId}.`);
  return result;
}

function instanceFromHand(player: PlayerState, instanceId: string): CardInstance {
  const instance = player.hand.find((candidate) => candidate.instanceId === instanceId);
  fail(instance, "CARD_NOT_IN_HAND", "That card is not in your hand.");
  return instance;
}

// Effects only: the action's check has already confirmed the card is in hand.
function removeFromHand(player: PlayerState, instanceId: string): CardInstance {
  const index = player.hand.findIndex((candidate) => candidate.instanceId === instanceId);
  if (index < 0) throw new Error(`Unchecked effect removed ${instanceId}, which is not in hand.`);
  return player.hand.splice(index, 1)[0]!;
}

function discardTable(state: GameState): void {
  const entries = [
    state.table.position,
    state.table.move?.card ?? null,
    state.table.flourish,
  ].filter((entry): entry is CardInstance => entry !== null);
  for (const entry of entries) state.players[entry.owner].discardPile.push(entry);
  state.table = { position: null, move: null, flourish: null };
}

function discardMoveLayer(state: GameState): void {
  if (state.table.move)
    state.players[state.table.move.card.owner].discardPile.push(state.table.move.card);
  if (state.table.flourish)
    state.players[state.table.flourish.owner].discardPile.push(state.table.flourish);
  state.table.move = null;
  state.table.flourish = null;
}

function positionFor(contentSet: ContentSet, instance: CardInstance): Position {
  const definition = card(contentSet, instance.cardId);
  fail(definition.type === "position", "NOT_A_POSITION", "Choose a Position card.");
  return definition.position;
}

function moveFor(contentSet: ContentSet, instance: CardInstance): MoveCard {
  const definition = card(contentSet, instance.cardId);
  fail(definition.type === "move", "NOT_A_MOVE", "Choose a Move card.");
  return definition;
}

function flourishFor(contentSet: ContentSet, instance: CardInstance): FlourishCard {
  const definition = card(contentSet, instance.cardId);
  fail(definition.type === "flourish", "NOT_A_FLOURISH", "Choose a Flourish card.");
  return definition;
}

function addConnection(state: GameState, amount: number, contentSet: ContentSet): void {
  state.shared.connection = Math.max(
    0,
    Math.min(contentSet.rules.maximumConnection, state.shared.connection + amount),
  );
}

/**
 * The single writer for Style. `SharedScoreSchema.style` is nonnegative, so one unclamped
 * subtraction would leave a state that no longer reads back under its own schema.
 */
function addStyle(state: GameState, amount: number): void {
  state.shared.style = Math.max(0, state.shared.style + amount);
}

function callRules(contentSet: ContentSet): CallRules | null {
  return contentSet.rules.call ?? null;
}

/** The call `callId` names, or null when this content prints no such call. */
export function callDefinition(contentSet: ContentSet, callId: string): Call | null {
  return callRules(contentSet)?.options.find((option) => option.id === callId) ?? null;
}

/** How long a run of answered calls can grow: as long as the bonus table. */
export function afinqueCap(contentSet: ContentSet): number {
  return callRules(contentSet)?.afinqueBonus.length ?? 0;
}

/** The extra Style an answer earns for being the `links`th answer in a row. */
export function afinqueBonus(links: number, contentSet: ContentSet): number {
  return callRules(contentSet)?.afinqueBonus[links - 1] ?? 0;
}

function breakAfinque(state: GameState): void {
  state.shared.afinque = 0;
}

/** The number of 8-counts in one phrase. */
function phraseLength(contentSet: ContentSet): number {
  return contentSet.song.cards.length / 2;
}

/** True when `songIndex` is the last 8-count of its phrase, which no call may cross. */
function endsPhrase(songIndex: number, contentSet: ContentSet): boolean {
  return (songIndex + 1) % phraseLength(contentSet) === 0;
}

/**
 * The call standing over the 8-count being danced. A call is made for the 8-count after the one
 * that made it, so one that outlived its own 8-count is a bug: it is cleared, never resolved.
 */
export function standingCall(state: GameState): StandingCall {
  if (!state.call) return null;
  return state.call.forSongIndex === state.songIndex ? state.call : null;
}

/** Would `role`'s 8-count so far answer `standing`? Every call also asks for a Move. */
export function callMet(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  standing: NonNullable<StandingCall>,
): boolean {
  const definition = callDefinition(contentSet, standing.callId);
  if (!definition) return false;
  return (
    state.turnDance.moveCardId !== null &&
    bonusConditionMet(definition.condition, { state, role, contentSet })
  );
}

function snapshotCheckpoint(state: GameState): TurnCheckpoint {
  return clone({
    players: state.players,
    table: state.table,
    shared: state.shared,
    market: state.market,
    phrase: state.phrase,
    moveHistory: state.moveHistory,
    danceHistory: state.danceHistory,
    rngState: state.rngState,
    nextInstance: state.nextInstance,
    turnDance: state.turnDance,
    signal: state.signal,
    call: state.call,
  });
}

function advancedLessonsOpen(state: GameState, contentSet: ContentSet): boolean {
  return state.songIndex >= contentSet.song.cards.length / 2;
}

function startTurn(state: GameState, role: Role, contentSet: ContentSet): void {
  const advancedWereOpen = advancedLessonsOpen(state, contentSet);
  state.activeRole = role;
  state.phase = "dance";
  state.songIndex += 1;
  const song = contentSet.song.cards[state.songIndex];
  fail(song, "SONG_EXHAUSTED", "There are no song cards left.");
  state.currentSongId = song.id;
  state.players[role].money += contentSet.rules.incomePerTurn;
  state.turnDance = emptyTurnDance();
  state.signal = null;
  if (role === "lead") state.phrase.privateLessonTakenThisRound = false;
  if (!advancedWereOpen && advancedLessonsOpen(state, contentSet)) {
    state.market.advancedDisplay.push(...takeDisplay(state.market.advancedDeck, 2));
    log(state, "system", "The montuno begins. Advanced lessons are now open.");
  }
  log(state, "song", `${song.number} · ${song.section} · ${song.title}: ${song.description}`, role);
  state.checkpoint = snapshotCheckpoint(state);
}

function canMulligan(player: PlayerState, contentSet: ContentSet): boolean {
  const moves = player.hand.filter((entry) => card(contentSet, entry.cardId).type === "move");
  const positions = player.hand.filter(
    (entry) => card(contentSet, entry.cardId).type === "position",
  );
  return !positions.some((position) => {
    const positionName = positionFor(contentSet, position);
    return moves.some((move) => moveFor(contentSet, move).positions.includes(positionName));
  });
}

function moveMatches(move: MoveCard, position: Position): boolean {
  return move.positions.includes(position);
}

function recordMove(
  state: GameState,
  role: Role,
  moveInstance: CardInstance,
  fromPosition: Position,
  definition: MoveCard,
): void {
  discardMoveLayer(state);
  state.table.move = { card: moveInstance, dancedFrom: fromPosition };
  addStyle(state, definition.style);
  state.turnDance.moveCardId = definition.id;
  state.turnDance.moveStyle = definition.style;
  state.turnDance.fromPosition = fromPosition;
  state.turnDance.cardsPlayed += 1;
  state.turnDance.canTransition = true;
  if (!state.phrase.positionsDancedFrom.includes(fromPosition))
    state.phrase.positionsDancedFrom.push(fromPosition);
  state.moveHistory.push({
    cardId: definition.id,
    role,
    phrase: state.phrase.number,
    songIndex: state.songIndex,
    fromPosition,
  });
  log(
    state,
    "dance",
    `${roleName(role)} danced ${definition.name} for ${definition.style} Style.`,
    role,
  );
}

interface BonusContext {
  state: GameState;
  role: Role;
  contentSet: ContentSet;
}

export function bonusConditionMet(condition: BonusCondition, context: BonusContext): boolean {
  const { state, role } = context;
  const turn = state.turnDance;
  const currentMove = turn.moveCardId;
  switch (condition.op) {
    case "moveStyleAtMost":
      return turn.moveStyle !== null && turn.moveStyle <= condition.value;
    case "moveStyleAtLeast":
      return turn.moveStyle !== null && turn.moveStyle >= condition.value;
    case "moveFrom":
      return turn.fromPosition !== null && condition.positions.includes(turn.fromPosition);
    case "flourishPlayed":
      return turn.flourished;
    case "posePlayed":
      return turn.posePlayed;
    case "noPositionPlayed":
      return turn.positionsPlayed === 0;
    case "samePositionAsPreviousMove": {
      if (turn.fromPosition === null) return false;
      const earlier = [...state.moveHistory]
        .reverse()
        .find((entry) => entry.songIndex < state.songIndex);
      return earlier?.fromPosition === turn.fromPosition;
    }
    case "endsInPosition":
      return (
        state.table.position !== null &&
        positionFor(context.contentSet, state.table.position) === condition.position
      );
    case "positionChanged":
      return turn.changedPosition;
    case "partnerPlayedMoveGame":
      return (
        currentMove !== null &&
        state.moveHistory.some(
          (entry) =>
            entry.role === otherRole(role) &&
            entry.cardId === currentMove &&
            entry.songIndex < state.songIndex,
        )
      );
    case "partnerPlayedMovePhrase":
      return (
        currentMove !== null &&
        state.moveHistory.some(
          (entry) =>
            entry.role === otherRole(role) &&
            entry.cardId === currentMove &&
            entry.phrase === state.phrase.number &&
            entry.songIndex < state.songIndex,
        )
      );
    case "cardsPlayedAtLeast":
      return turn.cardsPlayed >= condition.value;
    case "answeredCall":
      return turn.callAnswered;
  }
  const exhaustive: never = condition;
  throw new Error(`Unknown bonus condition ${(exhaustive as BonusCondition).op}.`);
}

/** What taking the song would pay `role` right now, or null when it would pay nothing. */
export function songBonusFor(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
): BonusEffect | null {
  // The hold trades the song card's bonus for the frame, so nothing is on offer after one.
  if (state.turnDance.adjusted || state.songIndex < 0) return null;
  // `answeredCall` reads a field only END_DANCE writes, so answer the standing call here to
  // ask the same question it will. Inert on END_DANCE's own path: the call is cleared by then.
  const standing = standingCall(state);
  const asked = standing
    ? {
        ...state,
        turnDance: { ...state.turnDance, callAnswered: callMet(state, role, contentSet, standing) },
      }
    : state;
  const branch = contentSet.song.cards[state.songIndex]?.bonuses.find(({ condition }) =>
    bonusConditionMet(condition, { state: asked, role, contentSet }),
  );
  return branch ? { ...branch.effect } : null;
}

function applySongBonus(state: GameState, role: Role, contentSet: ContentSet): void {
  const song = contentSet.song.cards[state.songIndex];
  fail(song, "NO_SONG_CARD", "No current song card.");
  const effect = songBonusFor(state, role, contentSet);
  if (!effect) return;
  addStyle(state, effect.style);
  addConnection(state, effect.connection, contentSet);
  state.turnDance.bonusStyle = effect.style;
  state.turnDance.bonusConnection = effect.connection;
  const rewards = [
    effect.style > 0 ? `+${effect.style} Style` : null,
    effect.connection > 0 ? `+${effect.connection} Connection` : null,
  ].filter(Boolean);
  log(state, "score", `${song.title} lands: ${rewards.join(" and ")}.`, role);
}

/** Which rung of the ladder this 8-count ended on: break beats recovered beats the rest. */
export function rungFor(turn: TurnDance): TurnDance["rung"] {
  if (turn.stumbled) return "break";
  if (turn.callCovered) return "recovered";
  if (turn.callAnswered) return "perfect";
  if (turn.moveCardId === null || turn.callDropped) return "awkward";
  return "clean";
}

function recordDanceCombo(state: GameState, role: Role, contentSet: ContentSet): void {
  state.turnDance.rung = rungFor(state.turnDance);
  const positionCardId = state.table.position?.cardId ?? null;
  const endingPosition = state.table.position
    ? positionFor(contentSet, state.table.position)
    : null;
  state.danceHistory.push({
    sequence: state.sequence + 1,
    phrase: state.phrase.number,
    songIndex: state.songIndex,
    role,
    outcome: state.turnDance.stumbled ? "stumble" : state.turnDance.moveCardId ? "dance" : "basic",
    moveCardId: state.turnDance.moveCardId,
    positionCardId,
    flourishCardId: state.table.flourish?.cardId ?? null,
    fromPosition: state.turnDance.fromPosition ?? endingPosition,
    endingPosition,
    rung: state.turnDance.rung,
    // The turn's checkpoint is taken before the player plays anything this 8-count.
    styleGained: state.shared.style - (state.checkpoint?.shared.style ?? state.shared.style),
    afinqueAfter: state.shared.afinque,
  });
}

/** The only way the dance ends early: the Connection the couple shares has run out. */
function endInConnectionLoss(state: GameState, role: Role, contentSet: ContentSet): void {
  recordDanceCombo(state, role, contentSet);
  state.status = "lost";
  state.phase = "terminal";
  state.terminalReason = "Connection reached 0.";
  state.finalScore = state.shared.style;
  state.rating = null;
  state.checkpoint = null;
  state.call = null;
  log(state, "system", "The connection breaks. The dance is over.");
}

/**
 * Reads the call standing over `role`'s 8-count and marks how it went, before anything is
 * scored: the song card's `answeredCall` bonus asks this question too.
 */
function resolveStandingCall(state: GameState, role: Role, contentSet: ContentSet): StandingCall {
  const standing = standingCall(state);
  // Either way the call does not outlive the 8-count it stood over.
  state.call = null;
  if (!standing) return null;
  if (callMet(state, role, contentSet, standing)) state.turnDance.callAnswered = true;
  else state.turnDance.callDropped = true;
  return standing;
}

/** The Style an answered call earns the couple, or the Connection a dropped one costs them. */
function applyCallOutcome(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  standing: NonNullable<StandingCall>,
): void {
  const rules = callRules(contentSet);
  const definition = callDefinition(contentSet, standing.callId);
  if (!rules || !definition) return;
  if (state.turnDance.callAnswered) {
    state.shared.afinque = Math.min(afinqueCap(contentSet), state.shared.afinque + 1);
    const earned =
      definition.style +
      afinqueBonus(state.shared.afinque, contentSet) +
      (standing.inPocket ? rules.inPocketStyle : 0);
    state.turnDance.callStyle = earned;
    addStyle(state, earned);
    log(
      state,
      "call",
      earned > 0
        ? `${roleName(role)} answers ${definition.name}: +${earned} Style.`
        : `${roleName(role)} answers ${definition.name}.`,
      role,
    );
    return;
  }
  addConnection(state, -rules.missConnectionCost, contentSet);
  state.phrase.droppedCall = true;
  breakAfinque(state);
  log(state, "call", `The call drops: −${rules.missConnectionCost} Connection.`, role);
}

/** The call `role` makes over their partner's next 8-count instead of taking the song. */
function makeCall(state: GameState, role: Role, contentSet: ContentSet, callId: string): void {
  const definition = callDefinition(contentSet, callId);
  if (!definition) return;
  const inPocket = contentSet.song.cards[state.songIndex]?.favouredCall === callId;
  state.turnDance.callMade = callId;
  state.call = { byRole: role, callId, forSongIndex: state.songIndex + 1, inPocket };
  log(
    state,
    "call",
    `${roleName(role)} calls ${definition.name}${inPocket ? " — in the pocket" : ""}.`,
    role,
  );
}

/**
 * The end of an 8-count, in the order the rules resolve it: the call standing over it, then the
 * song card's bonus or a new call, then the rung the 8-count ended on.
 */
function finishDance(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  callId: string | null,
): void {
  const standing = resolveStandingCall(state, role, contentSet);
  if (callId === null && !state.turnDance.adjusted) applySongBonus(state, role, contentSet);
  if (standing) applyCallOutcome(state, role, contentSet, standing);
  if (state.shared.connection === 0) {
    endInConnectionLoss(state, role, contentSet);
    return;
  }
  if (callId !== null) makeCall(state, role, contentSet, callId);
  // The basic, or a hold alone: nothing was danced, so the run of answered calls ends here.
  if (state.turnDance.moveCardId === null) breakAfinque(state);
  recordDanceCombo(state, role, contentSet);
  state.turnDance.canTransition = false;
  state.phase = "lesson";
}

function refillDisplay(deck: string[], display: string[], target: number): void {
  display.push(...takeDisplay(deck, target - display.length));
}

function drawToHand(state: GameState, role: Role, contentSet: ContentSet): void {
  const player = state.players[role];
  while (player.hand.length < contentSet.rules.handSize) {
    if (player.drawPile.length === 0) {
      if (player.discardPile.length === 0) break;
      const shuffled = shuffle(player.discardPile, state.rngState);
      state.rngState = shuffled.state;
      player.drawPile = shuffled.items;
      player.discardPile = [];
    }
    const next = player.drawPile.shift();
    if (!next) break;
    player.hand.push(next);
  }
}

function scorePhrase(state: GameState, contentSet: ContentSet): void {
  const rewards: string[] = [];
  if (!state.phrase.stumbled && !state.phrase.droppedCall) {
    addStyle(state, contentSet.rules.phraseBonuses.clean);
    rewards.push(`clean +${contentSet.rules.phraseBonuses.clean}`);
  }
  const extraPositions = Math.max(0, state.phrase.positionsDancedFrom.length - 1);
  if (extraPositions > 0) {
    const value = extraPositions * contentSet.rules.phraseBonuses.varietyPerExtraPosition;
    addStyle(state, value);
    rewards.push(`variety +${value}`);
  }
  if (state.phrase.flourishedBy.lead && state.phrase.flourishedBy.follow) {
    addStyle(state, contentSet.rules.phraseBonuses.sharedFlair);
    rewards.push(`shared flair +${contentSet.rules.phraseBonuses.sharedFlair}`);
  }
  if (state.phrase.poseOnFinalCount) {
    addStyle(state, contentSet.rules.phraseBonuses.poseFinish);
    rewards.push(`pose finish +${contentSet.rules.phraseBonuses.poseFinish}`);
  }
  log(
    state,
    "score",
    `Phrase ${state.phrase.number}: ${rewards.length ? rewards.join(", ") : "no phrase bonuses"}.`,
  );
  discardTable(state);
}

function finishGame(state: GameState, contentSet: ContentSet): void {
  state.status = "completed";
  state.phase = "terminal";
  state.currentSongId = null;
  state.finalScore = state.shared.style + state.shared.connection;
  const rating = [...contentSet.rules.ratings]
    .sort((left, right) => right.minimum - left.minimum)
    .find((entry) => state.finalScore! >= entry.minimum);
  state.rating = rating?.name ?? contentSet.rules.ratings[0]!.name;
  state.terminalReason = "The final 8-count is complete.";
  state.checkpoint = null;
  state.call = null;
  log(state, "system", `The song ends at ${state.finalScore} — ${state.rating}.`);
}

function endPhraseOrTurn(state: GameState, role: Role, contentSet: ContentSet): void {
  const phraseEnd = endsPhrase(state.songIndex, contentSet);
  if (phraseEnd) scorePhrase(state, contentSet);
  // Every phrase ending clears the run of answered calls, the song's last one included.
  if (phraseEnd && callRules(contentSet)?.resetAfinqueAtPhraseEnd) breakAfinque(state);
  if (state.songIndex === contentSet.song.cards.length - 1) {
    finishGame(state, contentSet);
    return;
  }
  if (phraseEnd) state.phrase = emptyPhrase(2);
  startTurn(state, otherRole(role), contentSet);
}

function newOwnedInstance(state: GameState, role: Role, cardId: string): CardInstance {
  return { instanceId: `${role}-${state.nextInstance++}`, cardId, owner: role };
}

function restoreCheckpoint(state: GameState, saved: TurnCheckpoint): void {
  const checkpoint = clone(saved);
  state.players = checkpoint.players;
  state.table = checkpoint.table;
  state.shared = checkpoint.shared;
  state.market = checkpoint.market;
  state.phrase = checkpoint.phrase;
  state.moveHistory = checkpoint.moveHistory;
  state.danceHistory = checkpoint.danceHistory;
  state.rngState = checkpoint.rngState;
  state.nextInstance = checkpoint.nextInstance;
  state.turnDance = checkpoint.turnDance;
  state.signal = null;
  // Unlike the signal: the call standing over you is your partner's and not yours to undo. The
  // call you made this turn lives in the same field, so the checkpoint un-makes exactly that.
  state.call = checkpoint.call;
  state.phase = "dance";
}

type ActionOf<T extends GameAction["type"]> = Extract<GameAction, { type: T }>;

/**
 * What an action does to a state, run only after its check has passed. The parameter is
 * named `state` on purpose: it shadows the checked state so an effect can only touch the
 * clone it is handed.
 */
type Effect = (state: GameState) => void;

function checkSetupStep(state: GameState, role: Role): void {
  fail(
    state.status === "setup" && state.phase === "mulligan",
    "WRONG_PHASE",
    "Opening hands are already settled.",
  );
  fail(
    state.setupRole === role,
    "NOT_YOUR_SETUP",
    "It is your partner's turn to check their hand.",
  );
}

function checkTurn(state: GameState, role: Role): void {
  fail(state.status === "playing", "GAME_NOT_PLAYING", "The dance is not active.");
  fail(state.activeRole === role, "NOT_YOUR_TURN", "It is your partner's turn.");
}

function checkDanceCardStep(state: GameState): void {
  fail(
    state.phase === "dance",
    "WRONG_PHASE",
    "Dance cards can only be played during the dance step.",
  );
}

function checkMulligan(
  state: GameState,
  { role }: ActionOf<"MULLIGAN">,
  contentSet: ContentSet,
): Effect {
  checkSetupStep(state, role);
  const player = state.players[role];
  fail(!player.mulliganUsed, "MULLIGAN_USED", "The one-time mulligan has already been used.");
  fail(
    canMulligan(player, contentSet),
    "MULLIGAN_NOT_ALLOWED",
    "This hand has a matching Position and Move.",
  );
  return (state) => {
    const player = state.players[role];
    const shuffled = shuffle([...player.hand, ...player.drawPile], state.rngState);
    state.rngState = shuffled.state;
    player.hand = shuffled.items.splice(0, contentSet.rules.handSize);
    player.drawPile = shuffled.items;
    player.mulliganUsed = true;
    log(state, "system", `${roleName(role)} takes their one mulligan.`, role);
  };
}

function checkConfirmHand(
  state: GameState,
  { role }: ActionOf<"CONFIRM_HAND">,
  contentSet: ContentSet,
): Effect {
  checkSetupStep(state, role);
  return (state) => {
    state.players[role].ready = true;
    log(state, "system", `${roleName(role)} keeps their opening hand.`, role);
    if (role === "lead") {
      state.setupRole = "follow";
      state.activeRole = "follow";
    } else {
      state.status = "playing";
      state.setupRole = "lead";
      startTurn(state, "lead", contentSet);
    }
  };
}

function checkSignalCard(state: GameState, { role, instanceId }: ActionOf<"SIGNAL_CARD">): Effect {
  checkTurn(state, role);
  instanceFromHand(state.players[role], instanceId);
  return (state) => {
    state.signal = { role, instanceId };
    log(state, "signal", `${roleName(role)} reveals one card as a signal.`, role);
  };
}

function checkClearSignal(state: GameState, { role }: ActionOf<"CLEAR_SIGNAL">): Effect {
  checkTurn(state, role);
  fail(state.signal?.role === role, "NO_SIGNAL", "There is no signal to clear.");
  return (state) => {
    state.signal = null;
  };
}

function checkUndoTurn(state: GameState, { role }: ActionOf<"UNDO_TURN">): Effect {
  checkTurn(state, role);
  fail(state.checkpoint, "NOTHING_TO_UNDO", "Nothing has been played this turn.");
  return (state) => {
    restoreCheckpoint(state, state.checkpoint!);
    log(state, "system", `${roleName(role)} resets their turn.`, role);
  };
}

function checkPlayOpen(
  state: GameState,
  { role, positionInstanceId, moveInstanceId }: ActionOf<"PLAY_OPEN">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  fail(state.table.position === null, "DANCE_ALREADY_OPEN", "The dance already has a position.");
  fail(
    state.turnDance.cardsPlayed === 0,
    "OPEN_FIRST",
    "An opening Position and Move must be played together.",
  );
  const player = state.players[role];
  const positionInstance = instanceFromHand(player, positionInstanceId);
  const moveInstance = instanceFromHand(player, moveInstanceId);
  fail(
    positionInstance.instanceId !== moveInstance.instanceId,
    "SAME_CARD",
    "Choose two different cards.",
  );
  const position = positionFor(contentSet, positionInstance);
  const move = moveFor(contentSet, moveInstance);
  fail(
    moveMatches(move, position),
    "POSITION_MISMATCH",
    `${move.name} cannot be danced from ${position}.`,
  );
  return (state) => {
    const player = state.players[role];
    state.table.position = removeFromHand(player, positionInstanceId);
    state.turnDance.positionsPlayed += 1;
    state.turnDance.cardsPlayed += 1;
    recordMove(state, role, removeFromHand(player, moveInstanceId), position, move);
  };
}

function checkPlayMove(
  state: GameState,
  { role, moveInstanceId }: ActionOf<"PLAY_MOVE">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  fail(state.table.position, "OPEN_REQUIRED", "Open with a matching Position and Move first.");
  fail(state.turnDance.moveCardId === null, "MOVE_LIMIT", "Only one Move may be played per turn.");
  const move = moveFor(contentSet, instanceFromHand(state.players[role], moveInstanceId));
  const fromPosition = positionFor(contentSet, state.table.position);
  fail(
    moveMatches(move, fromPosition),
    "POSITION_MISMATCH",
    `${move.name} cannot be danced from ${fromPosition}.`,
  );
  return (state) => {
    recordMove(
      state,
      role,
      removeFromHand(state.players[role], moveInstanceId),
      fromPosition,
      move,
    );
  };
}

function checkTransition(
  state: GameState,
  { role, positionInstanceId }: ActionOf<"TRANSITION">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  fail(
    state.turnDance.canTransition,
    "TRANSITION_WINDOW_CLOSED",
    "Transition immediately after your Move.",
  );
  fail(
    state.turnDance.positionsPlayed < contentSet.rules.danceLimits.positions,
    "POSITION_LIMIT",
    "The Position limit for this turn has been reached.",
  );
  const nextPosition = positionFor(
    contentSet,
    instanceFromHand(state.players[role], positionInstanceId),
  );
  const previousPosition = state.table.position
    ? positionFor(contentSet, state.table.position)
    : null;
  return (state) => {
    if (state.table.position)
      state.players[state.table.position.owner].discardPile.push(state.table.position);
    state.table.position = removeFromHand(state.players[role], positionInstanceId);
    state.turnDance.cardsPlayed += 1;
    state.turnDance.positionsPlayed += 1;
    state.turnDance.changedPosition ||= previousPosition !== nextPosition;
    state.turnDance.canTransition = false;
    log(state, "dance", `${roleName(role)} carries the dance to ${nextPosition}.`, role);
  };
}

/**
 * Taking the hold on an empty floor, or adjusting an established one: one Position card alone,
 * played before you dance, in exchange for the song card's bonus this 8-count.
 */
function checkAdjust(
  state: GameState,
  { role, positionInstanceId }: ActionOf<"ADJUST">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  fail(
    state.turnDance.cardsPlayed === 0,
    "ADJUST_AFTER_PLAY",
    "Find the frame before you dance, not after.",
  );
  fail(
    state.turnDance.positionsPlayed < contentSet.rules.danceLimits.positions,
    "POSITION_LIMIT",
    "The Position limit for this turn has been reached.",
  );
  const nextPosition = positionFor(
    contentSet,
    instanceFromHand(state.players[role], positionInstanceId),
  );
  const previousPosition = state.table.position
    ? positionFor(contentSet, state.table.position)
    : null;
  fail(previousPosition !== nextPosition, "SAME_POSITION", `The floor is already ${nextPosition}.`);
  return (state) => {
    if (state.table.position)
      state.players[state.table.position.owner].discardPile.push(state.table.position);
    state.table.position = removeFromHand(state.players[role], positionInstanceId);
    state.turnDance.cardsPlayed += 1;
    state.turnDance.positionsPlayed += 1;
    state.turnDance.adjusted = true;
    // Taking the hold on an empty floor changes no room, just as opening the dance does not.
    state.turnDance.changedPosition ||= previousPosition !== null;
    log(
      state,
      "dance",
      previousPosition === null
        ? `${roleName(role)} takes the hold in ${nextPosition}.`
        : `${roleName(role)} adjusts the hold to ${nextPosition}.`,
      role,
    );
  };
}

function checkPlayFlourish(
  state: GameState,
  { role, flourishInstanceId }: ActionOf<"PLAY_FLOURISH">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  fail(
    state.turnDance.moveCardId !== null,
    "MOVE_REQUIRED",
    "A Flourish belongs on the Move you played this turn.",
  );
  fail(!state.turnDance.flourished, "FLOURISH_LIMIT", "Only one Flourish may be played per turn.");
  const flourish = flourishFor(
    contentSet,
    instanceFromHand(state.players[role], flourishInstanceId),
  );
  const fromPosition = state.turnDance.fromPosition!;
  fail(
    flourish.positions === "any" || flourish.positions.includes(fromPosition),
    "FLOURISH_MISMATCH",
    `${flourish.name} does not match ${fromPosition}.`,
  );
  return (state) => {
    state.table.flourish = removeFromHand(state.players[role], flourishInstanceId);
    addStyle(state, flourish.style);
    state.turnDance.cardsPlayed += 1;
    state.turnDance.flourished = true;
    state.turnDance.posePlayed = flourish.pose;
    state.turnDance.canTransition = false;
    state.phrase.flourishedBy[role] = true;
    if (flourish.pose && (state.songIndex + 1) % (contentSet.song.cards.length / 2) === 0) {
      state.phrase.poseOnFinalCount = true;
    }
    log(
      state,
      "dance",
      `${roleName(role)} adds ${flourish.name} for ${flourish.style} Style.`,
      role,
    );
  };
}

function checkEndDance(
  state: GameState,
  { role, callId }: ActionOf<"END_DANCE">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  fail(state.phase === "dance", "WRONG_PHASE", "The dance step is already complete.");
  if (callId !== null) {
    fail(callRules(contentSet), "NO_CALLS", "This dance has no calls to make.");
    fail(callDefinition(contentSet, callId), "UNKNOWN_CALL", "That is not one of the calls.");
    fail(
      !endsPhrase(state.songIndex, contentSet),
      "NO_CALL_WINDOW",
      "The phrase ends here. There is nothing to call into.",
    );
    // No call crosses a phrase ending, so no call ever stands over an empty floor.
    fail(
      state.table.position,
      "NO_FLOOR",
      "You cannot ask for something from a floor you did not leave.",
    );
  }
  return (state) => finishDance(state, role, contentSet, callId);
}

/**
 * Covering the call standing over you: one Recovery card, discarded, and the call is gone. A
 * Recovery card's printed Connection cost is a stumble's price, not a cover's.
 */
function checkCoverCall(
  state: GameState,
  { role, recoveryInstanceId }: ActionOf<"COVER_CALL">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  checkDanceCardStep(state);
  const standing = standingCall(state);
  fail(standing, "NO_CALL_STANDING", "There is no call standing over your 8-count.");
  const recovery = card(
    contentSet,
    instanceFromHand(state.players[role], recoveryInstanceId).cardId,
  );
  fail(recovery.type === "recovery", "NOT_RECOVERY", "Choose a Recovery card.");
  const name = callDefinition(contentSet, standing.callId)?.name ?? standing.callId;
  return (state) => {
    const player = state.players[role];
    player.discardPile.push(removeFromHand(player, recoveryInstanceId));
    state.call = null;
    state.turnDance.callCovered = true;
    breakAfinque(state);
    log(state, "call", `${roleName(role)} covers ${name} with ${recovery.name}.`, role);
  };
}

function checkStumble(
  state: GameState,
  { role, recoveryInstanceId }: ActionOf<"STUMBLE">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  fail(state.phase === "dance", "WRONG_PHASE", "A stumble replaces the dance step.");
  fail(
    state.turnDance.cardsPlayed === 0,
    "ALREADY_DANCED",
    "You cannot stumble after playing dance cards.",
  );
  let connectionCost = contentSet.rules.stumble.defaultConnectionCost;
  if (recoveryInstanceId !== null) {
    const recoveryInstance = instanceFromHand(state.players[role], recoveryInstanceId);
    const recovery = card(contentSet, recoveryInstance.cardId);
    fail(recovery.type === "recovery", "NOT_RECOVERY", "Choose a Recovery card.");
    connectionCost = recovery.connectionCost;
  }
  return (state) => {
    if (recoveryInstanceId !== null) {
      const player = state.players[role];
      player.discardPile.push(removeFromHand(player, recoveryInstanceId));
    }
    discardTable(state);
    addConnection(state, -connectionCost, contentSet);
    state.turnDance.stumbled = true;
    state.phrase.stumbled = true;
    // A stumble drops the call standing over you without the dropped call's own cost.
    if (standingCall(state)) {
      state.turnDance.callDropped = true;
      state.phrase.droppedCall = true;
    }
    state.call = null;
    breakAfinque(state);
    log(state, "dance", `${roleName(role)} stumbles and loses ${connectionCost} Connection.`, role);
    if (state.shared.connection === 0) {
      endInConnectionLoss(state, role, contentSet);
      return;
    }
    finishDance(state, role, contentSet, null);
  };
}

function privateLessonMarket(
  market: Market,
  source: "intermediate" | "advanced",
): { display: string[]; deck: string[]; size: number } {
  return source === "intermediate"
    ? { display: market.intermediateDisplay, deck: market.intermediateDeck, size: 3 }
    : { display: market.advancedDisplay, deck: market.advancedDeck, size: 2 };
}

function checkBuyLesson(
  state: GameState,
  { role, source, cardId }: ActionOf<"BUY_LESSON">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  fail(state.phase === "lesson", "WRONG_PHASE", "Lessons come after the dance step.");
  fail(!state.turnDance.boughtLesson, "LESSON_LIMIT", "Only one lesson may be bought per turn.");
  const cost = contentSet.rules.lessonCosts[source];
  fail(state.players[role].money >= cost, "NOT_ENOUGH_MONEY", `This lesson costs $${cost}.`);
  if (source === "beginner") {
    fail(
      contentSet.decks.beginnerSupply.includes(cardId),
      "NOT_IN_SUPPLY",
      "That Beginner card is not available.",
    );
  } else {
    fail(
      !state.phrase.privateLessonTakenThisRound,
      "PRIVATE_LESSON_TAKEN",
      "The private lesson is already taken this round.",
    );
    if (source === "advanced")
      fail(
        advancedLessonsOpen(state, contentSet),
        "ADVANCED_CLOSED",
        "Advanced lessons open in the montuno.",
      );
    fail(
      privateLessonMarket(state.market, source).display.includes(cardId),
      "NOT_IN_MARKET",
      "That card is no longer in the market.",
    );
  }
  const lesson = card(contentSet, cardId);
  return (state) => {
    const player = state.players[role];
    if (source !== "beginner") {
      const { display, deck, size } = privateLessonMarket(state.market, source);
      display.splice(display.indexOf(cardId), 1);
      refillDisplay(deck, display, size);
      state.phrase.privateLessonTakenThisRound = true;
    }
    player.money -= cost;
    const learned = newOwnedInstance(state, role, cardId);
    // You just learned it and you want to use it, so a private lesson is your next draw.
    if (contentSet.rules.lessonToDrawTop?.[source]) player.drawPile.unshift(learned);
    else player.discardPile.push(learned);
    state.turnDance.boughtLesson = true;
    log(state, "lesson", `${roleName(role)} learns ${lesson.name}.`, role);
  };
}

function checkLearnFromPartner(
  state: GameState,
  { role, cardId }: ActionOf<"LEARN_FROM_PARTNER">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  fail(
    state.phase === "lesson",
    "WRONG_PHASE",
    "Learning from your partner happens at the end of your turn.",
  );
  fail(
    !state.phrase.learnedBy[role],
    "ALREADY_LEARNED",
    "You have already learned from your partner this phrase.",
  );
  const available = state.moveHistory.some(
    (entry) =>
      entry.role === otherRole(role) &&
      entry.phrase === state.phrase.number &&
      entry.cardId === cardId &&
      entry.songIndex < state.songIndex,
  );
  fail(
    available,
    "PARTNER_DID_NOT_PLAY",
    "Your partner has not played that Move earlier this phrase.",
  );
  const learned = card(contentSet, cardId);
  return (state) => {
    state.players[role].discardPile.push(newOwnedInstance(state, role, cardId));
    state.phrase.learnedBy[role] = true;
    state.turnDance.learnedFromPartner = true;
    log(state, "lesson", `${roleName(role)} learns ${learned.name} from their partner.`, role);
  };
}

function checkEndLesson(
  state: GameState,
  { role }: ActionOf<"END_LESSON">,
  contentSet: ContentSet,
): Effect {
  checkTurn(state, role);
  fail(state.phase === "lesson", "WRONG_PHASE", "The lesson step is already complete.");
  return (state) => {
    const player = state.players[role];
    player.discardPile.push(...player.hand);
    player.hand = [];
    drawToHand(state, role, contentSet);
    state.signal = null;
    endPhraseOrTurn(state, role, contentSet);
  };
}

/**
 * The single statement of an action's rules. Throws the `RuleViolation` the reducer reports
 * when the action may not be taken from `state`, and otherwise returns the action's effect.
 * Never mutates `state`, so `legalActions` can run it on every candidate.
 */
function checkAction(state: GameState, action: GameAction, contentSet: ContentSet): Effect {
  switch (action.type) {
    case "MULLIGAN":
      return checkMulligan(state, action, contentSet);
    case "CONFIRM_HAND":
      return checkConfirmHand(state, action, contentSet);
    case "SIGNAL_CARD":
      return checkSignalCard(state, action);
    case "CLEAR_SIGNAL":
      return checkClearSignal(state, action);
    case "UNDO_TURN":
      return checkUndoTurn(state, action);
    case "PLAY_OPEN":
      return checkPlayOpen(state, action, contentSet);
    case "PLAY_MOVE":
      return checkPlayMove(state, action, contentSet);
    case "TRANSITION":
      return checkTransition(state, action, contentSet);
    case "ADJUST":
      return checkAdjust(state, action, contentSet);
    case "PLAY_FLOURISH":
      return checkPlayFlourish(state, action, contentSet);
    case "END_DANCE":
      return checkEndDance(state, action, contentSet);
    case "COVER_CALL":
      return checkCoverCall(state, action, contentSet);
    case "STUMBLE":
      return checkStumble(state, action, contentSet);
    case "BUY_LESSON":
      return checkBuyLesson(state, action, contentSet);
    case "LEARN_FROM_PARTNER":
      return checkLearnFromPartner(state, action, contentSet);
    case "END_LESSON":
      return checkEndLesson(state, action, contentSet);
  }
  const exhaustive: never = action;
  throw new RuleViolation("UNKNOWN_ACTION", `Unknown action ${(exhaustive as GameAction).type}.`);
}

export function applyAction(
  state: GameState,
  input: GameAction,
  contentSet: ContentSet = defaultContent,
): ApplyResult {
  const parsed = GameActionSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "INVALID_ACTION",
        message: parsed.error.issues[0]?.message ?? "Invalid action.",
      },
    };
  try {
    const effect = checkAction(state, parsed.data, contentSet);
    const next = clone(state);
    effect(next);
    next.sequence = state.sequence + 1;
    return { ok: true, state: next };
  } catch (error) {
    if (error instanceof RuleViolation)
      return { ok: false, error: { code: error.code, message: error.message } };
    throw error;
  }
}

/**
 * The reducer's failure code for `action`, or null when the check accepts it. It parses first
 * for the same reason the reducer does: an action is only the action its defaults fill in.
 */
export function refusalCode(
  state: GameState,
  action: GameAction,
  contentSet: ContentSet = defaultContent,
): string | null {
  const parsed = GameActionSchema.safeParse(action);
  if (!parsed.success) return "INVALID_ACTION";
  try {
    checkAction(state, parsed.data, contentSet);
    return null;
  } catch (error) {
    if (error instanceof RuleViolation) return error.code;
    throw error;
  }
}

/**
 * Every action `role` could name from where its arguments come from, in `legalActions`' order.
 * Holds no rule: anything the reducer would reject is left to `checkAction`.
 */
function candidateActions(state: GameState, role: Role, contentSet: ContentSet): GameAction[] {
  if (state.status === "setup")
    return [
      { type: "MULLIGAN", role },
      { type: "CONFIRM_HAND", role },
    ];
  const hand = state.players[role].hand.map((entry) => entry.instanceId);
  const candidates: GameAction[] = [
    ...hand.map((instanceId): GameAction => ({ type: "SIGNAL_CARD", role, instanceId })),
    { type: "CLEAR_SIGNAL", role },
    { type: "UNDO_TURN", role },
  ];
  if (state.phase === "dance") {
    for (const positionInstanceId of hand)
      for (const moveInstanceId of hand)
        candidates.push({ type: "PLAY_OPEN", role, positionInstanceId, moveInstanceId });
    for (const moveInstanceId of hand) candidates.push({ type: "PLAY_MOVE", role, moveInstanceId });
    for (const positionInstanceId of hand)
      candidates.push({ type: "TRANSITION", role, positionInstanceId });
    for (const positionInstanceId of hand)
      candidates.push({ type: "ADJUST", role, positionInstanceId });
    for (const flourishInstanceId of hand)
      candidates.push({ type: "PLAY_FLOURISH", role, flourishInstanceId });
    candidates.push({ type: "STUMBLE", role, recoveryInstanceId: null });
    for (const recoveryInstanceId of hand)
      candidates.push({ type: "STUMBLE", role, recoveryInstanceId });
    for (const recoveryInstanceId of hand)
      candidates.push({ type: "COVER_CALL", role, recoveryInstanceId });
    candidates.push({ type: "END_DANCE", role, callId: null });
    for (const option of contentSet.rules.call?.options ?? [])
      candidates.push({ type: "END_DANCE", role, callId: option.id });
  }
  if (state.phase === "lesson") {
    for (const cardId of contentSet.decks.beginnerSupply)
      candidates.push({ type: "BUY_LESSON", role, source: "beginner", cardId });
    for (const cardId of state.market.intermediateDisplay)
      candidates.push({ type: "BUY_LESSON", role, source: "intermediate", cardId });
    for (const cardId of state.market.advancedDisplay)
      candidates.push({ type: "BUY_LESSON", role, source: "advanced", cardId });
    const partnerMoves = state.moveHistory
      .filter((entry) => entry.role === otherRole(role) && entry.phrase === state.phrase.number)
      .map((entry) => entry.cardId);
    for (const cardId of new Set(partnerMoves))
      candidates.push({ type: "LEARN_FROM_PARTNER", role, cardId });
    candidates.push({ type: "END_LESSON", role });
  }
  return candidates;
}

/**
 * The reducer accepts an undo whenever a checkpoint exists; the list offers it only once the
 * turn differs from that checkpoint. This is the one sanctioned reducer/list asymmetry.
 */
function turnChanged(state: GameState): boolean {
  return hashCanonical(snapshotCheckpoint(state)) !== hashCanonical(state.checkpoint);
}

export function legalActions(
  state: GameState,
  role: Role,
  contentSet: ContentSet = defaultContent,
): GameAction[] {
  return candidateActions(state, role, contentSet).filter(
    (action) =>
      refusalCode(state, action, contentSet) === null &&
      (action.type !== "UNDO_TURN" || turnChanged(state)),
  );
}

export function replayActions(
  options: CreateGameOptions,
  actions: readonly GameAction[],
): ApplyResult {
  return replayFrom(createGame(options), actions, options.content);
}

export function replayFrom(
  origin: GameState,
  actions: readonly GameAction[],
  contentSet: ContentSet = defaultContent,
): ApplyResult {
  let state = origin;
  for (const action of actions) {
    const result = applyAction(state, action, contentSet);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}
