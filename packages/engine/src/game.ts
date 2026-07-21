import {
  cardsById as defaultCardsById,
  content as defaultContent,
  contentHash as defaultContentHash,
  hashCanonical,
  type BonusCondition,
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
  type PlayerState,
  type ResumeEnvelope,
  type Role,
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
  const definitions = cardsFor(contentSet);
  const resolvedHash =
    options.contentHash ??
    (contentSet === defaultContent ? defaultContentHash : hashCanonical(contentSet));
  let rngState = options.seed >>> 0;
  let nextInstance = 1;
  let startingPosition: CardInstance | null = null;

  const makeInstances = (role: Role, ids: readonly string[]): CardInstance[] =>
    ids.map((cardId) => ({ instanceId: `${role}-${nextInstance++}`, cardId, owner: role }));

  const makePlayer = (role: Role): PlayerState => {
    const instances = makeInstances(role, expanded(contentSet.decks.starter));
    if (role === "lead") {
      const positionIndex = instances.findIndex((instance) => {
        const definition = definitions[instance.cardId];
        return (
          definition?.type === "position" &&
          definition.position === contentSet.rules.startingPosition
        );
      });
      fail(
        positionIndex >= 0,
        "STARTING_POSITION_MISSING",
        `The Lead starter deck needs a ${contentSet.rules.startingPosition} Position card.`,
      );
      startingPosition = instances.splice(positionIndex, 1)[0]!;
    }
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
  fail(startingPosition, "STARTING_POSITION_MISSING", "The starting Position was not placed.");
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
    },
    market,
    table: { position: startingPosition, move: null, flourish: null },
    phrase: {
      number: 1,
      stumbled: false,
      positionsDancedFrom: [],
      flourishedBy: { lead: false, follow: false },
      poseOnFinalCount: false,
      learnedBy: { lead: false, follow: false },
      privateLessonTakenThisRound: false,
    },
    moveHistory: [],
    turnDance: emptyTurnDance(),
    signal: null,
    log: [
      {
        sequence: 0,
        role: null,
        kind: "system",
        message: `${contentSet.rules.startingPosition} Position is on the floor. Lead checks their opening hand first.`,
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

function removeFromHand(player: PlayerState, instanceId: string): CardInstance {
  const index = player.hand.findIndex((candidate) => candidate.instanceId === instanceId);
  fail(index >= 0, "CARD_NOT_IN_HAND", "That card is not in your hand.");
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

function snapshotCheckpoint(state: GameState): TurnCheckpoint {
  return clone({
    players: state.players,
    table: state.table,
    shared: state.shared,
    market: state.market,
    phrase: state.phrase,
    moveHistory: state.moveHistory,
    rngState: state.rngState,
    nextInstance: state.nextInstance,
    turnDance: state.turnDance,
    signal: state.signal,
  });
}

function startTurn(state: GameState, role: Role, contentSet: ContentSet): void {
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
  if (state.songIndex === contentSet.song.cards.length / 2) {
    state.market.advancedDisplay.push(...takeDisplay(state.market.advancedDeck, 2));
    log(state, "system", "The montuno begins. Advanced lessons are now open.");
  }
  log(state, "song", `${song.number} · ${song.section} · ${song.title}: ${song.description}`, role);
  state.checkpoint = snapshotCheckpoint(state);
}

function canMulligan(
  player: PlayerState,
  contentSet: ContentSet,
  currentPosition: CardInstance | null,
): boolean {
  const moves = player.hand.filter((entry) => card(contentSet, entry.cardId).type === "move");
  if (currentPosition) {
    const position = positionFor(contentSet, currentPosition);
    return !moves.some((move) => moveMatches(moveFor(contentSet, move), position));
  }
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
  state.shared.style += definition.style;
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
    `${role === "lead" ? "Lead" : "Follow"} danced ${definition.name} for ${definition.style} Style.`,
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
  }
  return false;
}

function applySongBonus(state: GameState, role: Role, contentSet: ContentSet): void {
  const song = contentSet.song.cards[state.songIndex];
  fail(song, "NO_SONG_CARD", "No current song card.");
  const branch = song.bonuses.find(({ condition }) =>
    bonusConditionMet(condition, { state, role, contentSet }),
  );
  if (!branch) return;
  state.shared.style += branch.effect.style;
  addConnection(state, branch.effect.connection, contentSet);
  state.turnDance.bonusStyle = branch.effect.style;
  state.turnDance.bonusConnection = branch.effect.connection;
  const rewards = [
    branch.effect.style > 0 ? `+${branch.effect.style} Style` : null,
    branch.effect.connection > 0 ? `+${branch.effect.connection} Connection` : null,
  ].filter(Boolean);
  log(state, "score", `${song.title} lands: ${rewards.join(" and ")}.`, role);
}

function finishDance(state: GameState, role: Role, contentSet: ContentSet): void {
  applySongBonus(state, role, contentSet);
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
  if (!state.phrase.stumbled) {
    state.shared.style += contentSet.rules.phraseBonuses.clean;
    rewards.push(`clean +${contentSet.rules.phraseBonuses.clean}`);
  }
  const extraPositions = Math.max(0, state.phrase.positionsDancedFrom.length - 1);
  if (extraPositions > 0) {
    const value = extraPositions * contentSet.rules.phraseBonuses.varietyPerExtraPosition;
    state.shared.style += value;
    rewards.push(`variety +${value}`);
  }
  if (state.phrase.flourishedBy.lead && state.phrase.flourishedBy.follow) {
    state.shared.style += contentSet.rules.phraseBonuses.sharedFlair;
    rewards.push(`shared flair +${contentSet.rules.phraseBonuses.sharedFlair}`);
  }
  if (state.phrase.poseOnFinalCount) {
    state.shared.style += contentSet.rules.phraseBonuses.poseFinish;
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
  log(state, "system", `The song ends at ${state.finalScore} — ${state.rating}.`);
}

function endPhraseOrTurn(state: GameState, role: Role, contentSet: ContentSet): void {
  const phraseLength = contentSet.song.cards.length / 2;
  const phraseEnd = (state.songIndex + 1) % phraseLength === 0;
  if (phraseEnd) scorePhrase(state, contentSet);
  if (state.songIndex === contentSet.song.cards.length - 1) {
    finishGame(state, contentSet);
    return;
  }
  if (phraseEnd) {
    state.phrase = {
      number: 2,
      stumbled: false,
      positionsDancedFrom: [],
      flourishedBy: { lead: false, follow: false },
      poseOnFinalCount: false,
      learnedBy: { lead: false, follow: false },
      privateLessonTakenThisRound: false,
    };
  }
  startTurn(state, otherRole(role), contentSet);
}

function newOwnedInstance(state: GameState, role: Role, cardId: string): CardInstance {
  return { instanceId: `${role}-${state.nextInstance++}`, cardId, owner: role };
}

function restoreCheckpoint(state: GameState): void {
  fail(state.checkpoint, "NOTHING_TO_UNDO", "Nothing has been played this turn.");
  const checkpoint = clone(state.checkpoint);
  state.players = checkpoint.players;
  state.table = checkpoint.table;
  state.shared = checkpoint.shared;
  state.market = checkpoint.market;
  state.phrase = checkpoint.phrase;
  state.moveHistory = checkpoint.moveHistory;
  state.rngState = checkpoint.rngState;
  state.nextInstance = checkpoint.nextInstance;
  state.turnDance = checkpoint.turnDance;
  state.signal = null;
  state.phase = "dance";
}

function handleAction(state: GameState, action: GameAction, contentSet: ContentSet): void {
  const role = action.role;
  const player = state.players[role];

  if (action.type === "MULLIGAN" || action.type === "CONFIRM_HAND") {
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
    if (action.type === "MULLIGAN") {
      fail(!player.mulliganUsed, "MULLIGAN_USED", "The one-time mulligan has already been used.");
      fail(
        canMulligan(player, contentSet, state.table.position),
        "MULLIGAN_NOT_ALLOWED",
        "This hand has a Move for the current Position.",
      );
      const shuffled = shuffle([...player.hand, ...player.drawPile], state.rngState);
      state.rngState = shuffled.state;
      player.hand = shuffled.items.splice(0, contentSet.rules.handSize);
      player.drawPile = shuffled.items;
      player.mulliganUsed = true;
      log(
        state,
        "system",
        `${role === "lead" ? "Lead" : "Follow"} takes their one mulligan.`,
        role,
      );
      return;
    }
    player.ready = true;
    log(state, "system", `${role === "lead" ? "Lead" : "Follow"} keeps their opening hand.`, role);
    if (role === "lead") {
      state.setupRole = "follow";
      state.activeRole = "follow";
    } else {
      state.status = "playing";
      state.setupRole = "lead";
      startTurn(state, "lead", contentSet);
    }
    return;
  }

  fail(state.status === "playing", "GAME_NOT_PLAYING", "The dance is not active.");
  fail(state.activeRole === role, "NOT_YOUR_TURN", "It is your partner's turn.");

  if (action.type === "SIGNAL_CARD") {
    instanceFromHand(player, action.instanceId);
    state.signal = { role, instanceId: action.instanceId };
    log(
      state,
      "signal",
      `${role === "lead" ? "Lead" : "Follow"} reveals one card as a signal.`,
      role,
    );
    return;
  }
  if (action.type === "CLEAR_SIGNAL") {
    fail(state.signal?.role === role, "NO_SIGNAL", "There is no signal to clear.");
    state.signal = null;
    return;
  }
  if (action.type === "UNDO_TURN") {
    restoreCheckpoint(state);
    log(state, "system", `${role === "lead" ? "Lead" : "Follow"} resets their turn.`, role);
    return;
  }

  if (action.type === "PLAY_OPEN") {
    fail(
      state.phase === "dance",
      "WRONG_PHASE",
      "Dance cards can only be played during the dance step.",
    );
    fail(state.table.position === null, "DANCE_ALREADY_OPEN", "The dance already has a position.");
    fail(
      state.turnDance.cardsPlayed === 0,
      "OPEN_FIRST",
      "An opening Position and Move must be played together.",
    );
    const positionInstance = instanceFromHand(player, action.positionInstanceId);
    const moveInstance = instanceFromHand(player, action.moveInstanceId);
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
    state.table.position = removeFromHand(player, action.positionInstanceId);
    state.turnDance.positionsPlayed += 1;
    state.turnDance.cardsPlayed += 1;
    recordMove(state, role, removeFromHand(player, action.moveInstanceId), position, move);
    return;
  }

  if (action.type === "PLAY_MOVE") {
    fail(
      state.phase === "dance",
      "WRONG_PHASE",
      "Dance cards can only be played during the dance step.",
    );
    fail(state.table.position, "OPEN_REQUIRED", "Open with a matching Position and Move first.");
    fail(
      state.turnDance.moveCardId === null,
      "MOVE_LIMIT",
      "Only one Move may be played per turn.",
    );
    const moveInstance = instanceFromHand(player, action.moveInstanceId);
    const move = moveFor(contentSet, moveInstance);
    const fromPosition = positionFor(contentSet, state.table.position);
    fail(
      moveMatches(move, fromPosition),
      "POSITION_MISMATCH",
      `${move.name} cannot be danced from ${fromPosition}.`,
    );
    recordMove(state, role, removeFromHand(player, action.moveInstanceId), fromPosition, move);
    return;
  }

  if (action.type === "TRANSITION") {
    fail(
      state.phase === "dance",
      "WRONG_PHASE",
      "Dance cards can only be played during the dance step.",
    );
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
    const nextInstance = instanceFromHand(player, action.positionInstanceId);
    const nextPosition = positionFor(contentSet, nextInstance);
    const previousPosition = state.table.position
      ? positionFor(contentSet, state.table.position)
      : null;
    if (state.table.position)
      state.players[state.table.position.owner].discardPile.push(state.table.position);
    state.table.position = removeFromHand(player, action.positionInstanceId);
    state.turnDance.cardsPlayed += 1;
    state.turnDance.positionsPlayed += 1;
    state.turnDance.changedPosition ||= previousPosition !== nextPosition;
    state.turnDance.canTransition = false;
    log(
      state,
      "dance",
      `${role === "lead" ? "Lead" : "Follow"} carries the dance to ${nextPosition}.`,
      role,
    );
    return;
  }

  if (action.type === "PLAY_FLOURISH") {
    fail(
      state.phase === "dance",
      "WRONG_PHASE",
      "Dance cards can only be played during the dance step.",
    );
    fail(
      state.turnDance.moveCardId !== null,
      "MOVE_REQUIRED",
      "A Flourish belongs on the Move you played this turn.",
    );
    fail(
      !state.turnDance.flourished,
      "FLOURISH_LIMIT",
      "Only one Flourish may be played per turn.",
    );
    const flourishInstance = instanceFromHand(player, action.flourishInstanceId);
    const flourish = flourishFor(contentSet, flourishInstance);
    const fromPosition = state.turnDance.fromPosition!;
    fail(
      flourish.positions === "any" || flourish.positions.includes(fromPosition),
      "FLOURISH_MISMATCH",
      `${flourish.name} does not match ${fromPosition}.`,
    );
    state.table.flourish = removeFromHand(player, action.flourishInstanceId);
    state.shared.style += flourish.style;
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
      `${role === "lead" ? "Lead" : "Follow"} adds ${flourish.name} for ${flourish.style} Style.`,
      role,
    );
    return;
  }

  if (action.type === "END_DANCE") {
    fail(state.phase === "dance", "WRONG_PHASE", "The dance step is already complete.");
    finishDance(state, role, contentSet);
    return;
  }

  if (action.type === "STUMBLE") {
    fail(state.phase === "dance", "WRONG_PHASE", "A stumble replaces the dance step.");
    fail(
      state.turnDance.cardsPlayed === 0,
      "ALREADY_DANCED",
      "You cannot stumble after playing dance cards.",
    );
    let connectionCost = contentSet.rules.stumble.defaultConnectionCost;
    if (action.recoveryInstanceId !== null) {
      const recoveryInstance = instanceFromHand(player, action.recoveryInstanceId);
      const recovery = card(contentSet, recoveryInstance.cardId);
      fail(recovery.type === "recovery", "NOT_RECOVERY", "Choose a Recovery card.");
      connectionCost = recovery.connectionCost;
      player.discardPile.push(removeFromHand(player, action.recoveryInstanceId));
    }
    discardTable(state);
    addConnection(state, -connectionCost, contentSet);
    state.turnDance.stumbled = true;
    state.phrase.stumbled = true;
    log(
      state,
      "dance",
      `${role === "lead" ? "Lead" : "Follow"} stumbles and loses ${connectionCost} Connection.`,
      role,
    );
    if (state.shared.connection === 0) {
      state.status = "lost";
      state.phase = "terminal";
      state.terminalReason = "Connection reached 0.";
      state.finalScore = state.shared.style;
      state.rating = null;
      state.checkpoint = null;
      log(state, "system", "The connection breaks. The dance is over.");
      return;
    }
    finishDance(state, role, contentSet);
    return;
  }

  if (action.type === "BUY_LESSON") {
    fail(state.phase === "lesson", "WRONG_PHASE", "Lessons come after the dance step.");
    fail(!state.turnDance.boughtLesson, "LESSON_LIMIT", "Only one lesson may be bought per turn.");
    const costs = contentSet.rules.lessonCosts;
    const cost = costs[action.source];
    fail(player.money >= cost, "NOT_ENOUGH_MONEY", `This lesson costs $${cost}.`);
    if (action.source === "beginner") {
      fail(
        contentSet.decks.beginnerSupply.includes(action.cardId),
        "NOT_IN_SUPPLY",
        "That Beginner card is not available.",
      );
    } else {
      fail(
        !state.phrase.privateLessonTakenThisRound,
        "PRIVATE_LESSON_TAKEN",
        "The private lesson is already taken this round.",
      );
      if (action.source === "advanced")
        fail(
          state.songIndex >= contentSet.song.cards.length / 2,
          "ADVANCED_CLOSED",
          "Advanced lessons open in the montuno.",
        );
      const display =
        action.source === "intermediate"
          ? state.market.intermediateDisplay
          : state.market.advancedDisplay;
      const deck =
        action.source === "intermediate"
          ? state.market.intermediateDeck
          : state.market.advancedDeck;
      const index = display.indexOf(action.cardId);
      fail(index >= 0, "NOT_IN_MARKET", "That card is no longer in the market.");
      display.splice(index, 1);
      refillDisplay(deck, display, action.source === "intermediate" ? 3 : 2);
      state.phrase.privateLessonTakenThisRound = true;
    }
    player.money -= cost;
    player.discardPile.push(newOwnedInstance(state, role, action.cardId));
    state.turnDance.boughtLesson = true;
    log(
      state,
      "lesson",
      `${role === "lead" ? "Lead" : "Follow"} learns ${card(contentSet, action.cardId).name}.`,
      role,
    );
    return;
  }

  if (action.type === "LEARN_FROM_PARTNER") {
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
        entry.cardId === action.cardId &&
        entry.songIndex < state.songIndex,
    );
    fail(
      available,
      "PARTNER_DID_NOT_PLAY",
      "Your partner has not played that Move earlier this phrase.",
    );
    player.discardPile.push(newOwnedInstance(state, role, action.cardId));
    state.phrase.learnedBy[role] = true;
    state.turnDance.learnedFromPartner = true;
    log(
      state,
      "lesson",
      `${role === "lead" ? "Lead" : "Follow"} learns ${card(contentSet, action.cardId).name} from their partner.`,
      role,
    );
    return;
  }

  if (action.type === "END_LESSON") {
    fail(state.phase === "lesson", "WRONG_PHASE", "The lesson step is already complete.");
    player.discardPile.push(...player.hand);
    player.hand = [];
    drawToHand(state, role, contentSet);
    state.signal = null;
    endPhraseOrTurn(state, role, contentSet);
    return;
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
    const next = clone(state);
    handleAction(next, parsed.data, contentSet);
    next.sequence = state.sequence + 1;
    return { ok: true, state: next };
  } catch (error) {
    if (error instanceof RuleViolation)
      return { ok: false, error: { code: error.code, message: error.message } };
    throw error;
  }
}

export function legalActions(
  state: GameState,
  role: Role,
  contentSet: ContentSet = defaultContent,
): GameAction[] {
  if (state.status === "setup") {
    if (state.setupRole !== role) return [];
    const actions: GameAction[] = [{ type: "CONFIRM_HAND", role }];
    if (
      !state.players[role].mulliganUsed &&
      canMulligan(state.players[role], contentSet, state.table.position)
    )
      actions.unshift({ type: "MULLIGAN", role });
    return actions;
  }
  if (state.status !== "playing" || state.activeRole !== role) return [];
  const actions: GameAction[] = [];
  const player = state.players[role];
  const definitions = cardsFor(contentSet);

  for (const entry of player.hand)
    actions.push({ type: "SIGNAL_CARD", role, instanceId: entry.instanceId });
  if (state.signal?.role === role) actions.push({ type: "CLEAR_SIGNAL", role });
  if (
    state.checkpoint &&
    hashCanonical(snapshotCheckpoint(state)) !== hashCanonical(state.checkpoint)
  )
    actions.push({ type: "UNDO_TURN", role });

  if (state.phase === "dance") {
    const positions = player.hand.filter((entry) => definitions[entry.cardId]?.type === "position");
    const moves = player.hand.filter((entry) => definitions[entry.cardId]?.type === "move");
    if (!state.table.position) {
      for (const position of positions) {
        const positionName = positionFor(contentSet, position);
        for (const move of moves) {
          if (moveMatches(moveFor(contentSet, move), positionName)) {
            actions.push({
              type: "PLAY_OPEN",
              role,
              positionInstanceId: position.instanceId,
              moveInstanceId: move.instanceId,
            });
          }
        }
      }
    } else if (state.turnDance.moveCardId === null) {
      const currentPosition = positionFor(contentSet, state.table.position);
      for (const move of moves) {
        if (moveMatches(moveFor(contentSet, move), currentPosition))
          actions.push({ type: "PLAY_MOVE", role, moveInstanceId: move.instanceId });
      }
    }
    if (
      state.turnDance.canTransition &&
      state.turnDance.positionsPlayed < contentSet.rules.danceLimits.positions
    ) {
      for (const position of positions)
        actions.push({ type: "TRANSITION", role, positionInstanceId: position.instanceId });
    }
    if (state.turnDance.moveCardId !== null && !state.turnDance.flourished) {
      for (const entry of player.hand) {
        const definition = definitions[entry.cardId];
        if (
          definition?.type === "flourish" &&
          (definition.positions === "any" ||
            definition.positions.includes(state.turnDance.fromPosition!))
        ) {
          actions.push({ type: "PLAY_FLOURISH", role, flourishInstanceId: entry.instanceId });
        }
      }
    }
    if (state.turnDance.cardsPlayed === 0) {
      actions.push({ type: "STUMBLE", role, recoveryInstanceId: null });
      for (const entry of player.hand) {
        if (definitions[entry.cardId]?.type === "recovery")
          actions.push({ type: "STUMBLE", role, recoveryInstanceId: entry.instanceId });
      }
    }
    actions.push({ type: "END_DANCE", role });
  }

  if (state.phase === "lesson") {
    if (!state.turnDance.boughtLesson) {
      const costs = contentSet.rules.lessonCosts;
      if (player.money >= costs.beginner) {
        for (const cardId of contentSet.decks.beginnerSupply)
          actions.push({ type: "BUY_LESSON", role, source: "beginner", cardId });
      }
      if (!state.phrase.privateLessonTakenThisRound && player.money >= costs.intermediate) {
        for (const cardId of state.market.intermediateDisplay)
          actions.push({ type: "BUY_LESSON", role, source: "intermediate", cardId });
        if (state.songIndex >= contentSet.song.cards.length / 2 && player.money >= costs.advanced) {
          for (const cardId of state.market.advancedDisplay)
            actions.push({ type: "BUY_LESSON", role, source: "advanced", cardId });
        }
      }
    }
    if (!state.phrase.learnedBy[role]) {
      const learnable = new Set(
        state.moveHistory
          .filter(
            (entry) =>
              entry.role === otherRole(role) &&
              entry.phrase === state.phrase.number &&
              entry.songIndex < state.songIndex,
          )
          .map((entry) => entry.cardId),
      );
      for (const cardId of learnable) actions.push({ type: "LEARN_FROM_PARTNER", role, cardId });
    }
    actions.push({ type: "END_LESSON", role });
  }

  return actions;
}

export function createEnvelope(
  state: GameState,
  contentBytes: string,
  actions: GameAction[] = [],
): ResumeEnvelope {
  return {
    engineVersion: state.engineVersion,
    contentHash: state.contentHash,
    contentBytes,
    seed: state.seed,
    actions: clone(actions),
    state: clone(state),
  };
}

export function applyEnvelopeAction(
  envelope: ResumeEnvelope,
  action: GameAction,
  contentSet: ContentSet = defaultContent,
):
  { ok: true; envelope: ResumeEnvelope } | { ok: false; error: { code: string; message: string } } {
  const result = applyAction(envelope.state, action, contentSet);
  if (!result.ok) return result;
  return {
    ok: true,
    envelope: { ...envelope, actions: [...envelope.actions, clone(action)], state: result.state },
  };
}

export function replayActions(
  options: CreateGameOptions,
  actions: readonly GameAction[],
): ApplyResult {
  let state = createGame(options);
  for (const action of actions) {
    const result = applyAction(state, action, options.content);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}
