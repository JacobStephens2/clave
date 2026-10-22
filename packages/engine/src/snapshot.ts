import {
  content as defaultContent,
  type ContentSet,
  type DanceCard,
  type SongCard,
} from "@clave/content";
import { legalActions, refusalCode } from "./game.js";
import type { CardInstance, GameAction, GameState, LogEntry, Role } from "./schemas.js";

export interface CardView extends CardInstance {
  card: DanceCard;
}

export interface DanceComboView {
  sequence: number;
  phrase: number;
  count: number;
  role: Role;
  outcome: GameState["danceHistory"][number]["outcome"];
  move: DanceCard | null;
  position: DanceCard | null;
  flourish: DanceCard | null;
  fromPosition: GameState["danceHistory"][number]["fromPosition"];
  endingPosition: GameState["danceHistory"][number]["endingPosition"];
}

export interface PlayerSnapshot {
  engineVersion: number;
  contentHash: string;
  gameId: string;
  sequence: number;
  status: GameState["status"];
  terminalReason: string | null;
  viewerRole: Role;
  activeRole: Role;
  setupRole: Role;
  phase: GameState["phase"];
  songIndex: number;
  currentSong: SongCard | null;
  shared: GameState["shared"];
  rules: {
    maximumConnection: number;
    lessonCosts: ContentSet["rules"]["lessonCosts"];
    songLength: number;
    phraseLength: number;
    ratings: ContentSet["rules"]["ratings"];
  };
  cardCatalog: DanceCard[];
  phrase: {
    number: number;
    count: number;
    stumbled: boolean;
    positionsDancedFrom: GameState["phrase"]["positionsDancedFrom"];
    flourishedBy: GameState["phrase"]["flourishedBy"];
    learnedBy: GameState["phrase"]["learnedBy"];
  };
  danceHistory: DanceComboView[];
  self: {
    role: Role;
    hand: CardView[];
    discard: CardView[];
    drawCount: number;
    discardCount: number;
    money: number;
    mulliganUsed: boolean;
    ready: boolean;
  };
  partner: {
    role: Role;
    handCount: number;
    drawCount: number;
    discardCount: number;
    money: number;
    ready: boolean;
  };
  table: {
    position: CardView | null;
    move: (CardView & { dancedFrom: string }) | null;
    flourish: CardView | null;
  };
  market: {
    beginner: DanceCard[];
    intermediate: DanceCard[];
    advanced: DanceCard[];
    intermediateDeckCount: number;
    advancedDeckCount: number;
    privateLessonAvailable: boolean;
  };
  turn: GameState["turnDance"];
  signal: { role: Role; card: CardView } | null;
  legalActions: GameAction[];
  /** Empty unless it is this viewer's dance step. Omitted means the chosen action is legal. */
  floorRefusals: { instanceId: string; code: string }[];
  /** Published on every snapshot. Omitted means that buy is legal. */
  lessonRefusals: {
    source: "beginner" | "intermediate" | "advanced";
    cardId: string;
    code: string;
  }[];
  log: LogEntry[];
  finalScore: number | null;
  rating: { name: string; description: string } | null;
}

function viewersDanceStep(state: GameState, role: Role): boolean {
  return state.status === "playing" && state.phase === "dance" && state.activeRole === role;
}

/**
 * The one floor action a card attempts once a Position is on the table,
 * and for a Flourish or Recovery on an empty floor.
 */
function establishedFloorAction(
  role: Role,
  instanceId: string,
  type: DanceCard["type"],
): GameAction {
  switch (type) {
    case "move":
      return { type: "PLAY_MOVE", role, moveInstanceId: instanceId };
    case "position":
      return { type: "TRANSITION", role, positionInstanceId: instanceId };
    case "flourish":
      return { type: "PLAY_FLOURISH", role, flourishInstanceId: instanceId };
    case "recovery":
      return { type: "STUMBLE", role, recoveryInstanceId: instanceId };
  }
}

/**
 * Empty-floor Position or Move: `PLAY_OPEN` with each opposite card.
 * A passing pair omits the card. A shared non-mismatch failure (turn and phase fail first)
 * wins over `POSITION_MISMATCH`. No opposite card is a mismatch.
 */
function openingRefusal(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  hand: readonly CardInstance[],
  instance: CardInstance,
  cards: Record<string, DanceCard>,
): string | null {
  const card = cards[instance.cardId]!;
  const opposite = card.type === "position" ? "move" : "position";
  const oppositeCards = hand.filter((other) => cards[other.cardId]?.type === opposite);
  if (oppositeCards.length === 0) return "POSITION_MISMATCH";
  let shared: string | null = null;
  for (const oppositeCard of oppositeCards) {
    const action: GameAction =
      card.type === "position"
        ? {
            type: "PLAY_OPEN",
            role,
            positionInstanceId: instance.instanceId,
            moveInstanceId: oppositeCard.instanceId,
          }
        : {
            type: "PLAY_OPEN",
            role,
            positionInstanceId: oppositeCard.instanceId,
            moveInstanceId: instance.instanceId,
          };
    const code = refusalCode(state, action, contentSet);
    if (code === null) return null;
    if (code !== "POSITION_MISMATCH") shared ??= code;
  }
  return shared ?? "POSITION_MISMATCH";
}

function floorRefusalList(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  cards: Record<string, DanceCard>,
): { instanceId: string; code: string }[] {
  if (!viewersDanceStep(state, role)) return [];
  const hand = state.players[role].hand;
  const floorHasPosition = state.table.position !== null;
  const refusals: { instanceId: string; code: string }[] = [];
  for (const instance of hand) {
    const card = cards[instance.cardId];
    if (!card) throw new Error(`Missing content for ${instance.cardId}.`);
    const code =
      !floorHasPosition && (card.type === "position" || card.type === "move")
        ? openingRefusal(state, role, contentSet, hand, instance, cards)
        : refusalCode(
            state,
            establishedFloorAction(role, instance.instanceId, card.type),
            contentSet,
          );
    if (code) refusals.push({ instanceId: instance.instanceId, code });
  }
  return refusals;
}

function lessonRefusalList(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
): PlayerSnapshot["lessonRefusals"] {
  const offered: { source: PlayerSnapshot["lessonRefusals"][number]["source"]; cardId: string }[] =
    [
      ...contentSet.decks.beginnerSupply.map((cardId) => ({
        source: "beginner" as const,
        cardId,
      })),
      ...state.market.intermediateDisplay.map((cardId) => ({
        source: "intermediate" as const,
        cardId,
      })),
      ...state.market.advancedDisplay.map((cardId) => ({
        source: "advanced" as const,
        cardId,
      })),
    ];
  const refusals: PlayerSnapshot["lessonRefusals"] = [];
  for (const entry of offered) {
    const code = refusalCode(
      state,
      { type: "BUY_LESSON", role, source: entry.source, cardId: entry.cardId },
      contentSet,
    );
    if (code) refusals.push({ source: entry.source, cardId: entry.cardId, code });
  }
  return refusals;
}

function lookup(contentSet: ContentSet): Record<string, DanceCard> {
  return Object.fromEntries(contentSet.cards.map((card) => [card.id, card]));
}

function cardView(
  instance: CardInstance | null,
  cards: Record<string, DanceCard>,
): CardView | null {
  if (!instance) return null;
  const definition = cards[instance.cardId];
  if (!definition) throw new Error(`Missing content for ${instance.cardId}.`);
  return { ...instance, card: definition };
}

export function snapshotFor(
  state: GameState,
  role: Role,
  contentSet: ContentSet = defaultContent,
): PlayerSnapshot {
  const cards = lookup(contentSet);
  const partnerRole = role === "lead" ? "follow" : "lead";
  const self = state.players[role];
  const partner = state.players[partnerRole];
  const signaledInstance = state.signal
    ? (state.players[state.signal.role].hand.find(
        (entry) => entry.instanceId === state.signal!.instanceId,
      ) ?? null)
    : null;
  const ratingDefinition = state.rating
    ? (contentSet.rules.ratings.find((entry) => entry.name === state.rating) ?? null)
    : null;

  return {
    engineVersion: state.engineVersion,
    contentHash: state.contentHash,
    gameId: state.gameId,
    sequence: state.sequence,
    status: state.status,
    terminalReason: state.terminalReason,
    viewerRole: role,
    activeRole: state.activeRole,
    setupRole: state.setupRole,
    phase: state.phase,
    songIndex: state.songIndex,
    currentSong: state.songIndex >= 0 ? (contentSet.song.cards[state.songIndex] ?? null) : null,
    shared: { ...state.shared },
    rules: {
      maximumConnection: contentSet.rules.maximumConnection,
      lessonCosts: { ...contentSet.rules.lessonCosts },
      songLength: contentSet.song.cards.length,
      phraseLength: contentSet.song.cards.length / 2,
      ratings: contentSet.rules.ratings.map((rating) => ({ ...rating })),
    },
    cardCatalog: contentSet.cards.map((entry) => ({ ...entry })),
    phrase: {
      number: state.phrase.number,
      count: state.songIndex < 0 ? 0 : (state.songIndex % (contentSet.song.cards.length / 2)) + 1,
      stumbled: state.phrase.stumbled,
      positionsDancedFrom: [...state.phrase.positionsDancedFrom],
      flourishedBy: { ...state.phrase.flourishedBy },
      learnedBy: { ...state.phrase.learnedBy },
    },
    danceHistory: state.danceHistory.map((entry) => ({
      sequence: entry.sequence,
      phrase: entry.phrase,
      count: (entry.songIndex % (contentSet.song.cards.length / 2)) + 1,
      role: entry.role,
      outcome: entry.outcome,
      move: entry.moveCardId ? (cards[entry.moveCardId] ?? null) : null,
      position: entry.positionCardId ? (cards[entry.positionCardId] ?? null) : null,
      flourish: entry.flourishCardId ? (cards[entry.flourishCardId] ?? null) : null,
      fromPosition: entry.fromPosition,
      endingPosition: entry.endingPosition,
    })),
    self: {
      role,
      hand: self.hand.map((entry) => cardView(entry, cards)!),
      discard: self.discardPile.map((entry) => cardView(entry, cards)!),
      drawCount: self.drawPile.length,
      discardCount: self.discardPile.length,
      money: self.money,
      mulliganUsed: self.mulliganUsed,
      ready: self.ready,
    },
    partner: {
      role: partnerRole,
      handCount: partner.hand.length,
      drawCount: partner.drawPile.length,
      discardCount: partner.discardPile.length,
      money: partner.money,
      ready: partner.ready,
    },
    table: {
      position: cardView(state.table.position, cards),
      move: state.table.move
        ? { ...cardView(state.table.move.card, cards)!, dancedFrom: state.table.move.dancedFrom }
        : null,
      flourish: cardView(state.table.flourish, cards),
    },
    market: {
      beginner: contentSet.decks.beginnerSupply.map((id) => cards[id]!),
      intermediate: state.market.intermediateDisplay.map((id) => cards[id]!),
      advanced: state.market.advancedDisplay.map((id) => cards[id]!),
      intermediateDeckCount: state.market.intermediateDeck.length,
      advancedDeckCount: state.market.advancedDeck.length,
      privateLessonAvailable: !state.phrase.privateLessonTakenThisRound,
    },
    turn: { ...state.turnDance },
    signal:
      state.signal && signaledInstance
        ? { role: state.signal.role, card: cardView(signaledInstance, cards)! }
        : null,
    legalActions: legalActions(state, role, contentSet),
    floorRefusals: floorRefusalList(state, role, contentSet, cards),
    lessonRefusals: lessonRefusalList(state, role, contentSet),
    log: state.log.slice(-80),
    finalScore: state.finalScore,
    rating: ratingDefinition
      ? { name: ratingDefinition.name, description: ratingDefinition.description }
      : null,
  };
}
