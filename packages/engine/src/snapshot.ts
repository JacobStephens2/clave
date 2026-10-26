import {
  content as defaultContent,
  type BonusEffect,
  type CallRules,
  type ContentSet,
  type DanceCard,
  type SongCard,
} from "@clave/content";
import {
  afinqueBonus,
  afinqueCap,
  applyAction,
  callDefinition,
  callMet,
  legalActions,
  refusalCode,
  songBonusFor,
  standingCall,
} from "./game.js";
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
  rung: GameState["danceHistory"][number]["rung"];
  styleGained: number;
  afinqueAfter: number;
  move: DanceCard | null;
  position: DanceCard | null;
  flourish: DanceCard | null;
  fromPosition: GameState["danceHistory"][number]["fromPosition"];
  endingPosition: GameState["danceHistory"][number]["endingPosition"];
  /** The call this 8-count made, which stood over the next one. */
  callMade: { id: string; name: string } | null;
  /** How the call standing over this 8-count resolved; null when none stood over it. */
  callOutcome: GameState["danceHistory"][number]["callOutcome"];
  /** What the song card paid this 8-count, or null when it turned the other face or went unmet. */
  songBonus: BonusEffect | null;
  /**
   * Whether this 8-count took the hold or adjusted it: a Position played before any other
   * card, which gave up the song card's bonus. A Move may still follow it. Null when the
   * 8-count did neither.
   */
  hold: GameState["danceHistory"][number]["hold"];
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
  /** This game's own rules, so a resumed game shows the numbers it is being played with. */
  rules: {
    maximumConnection: number;
    lessonCosts: ContentSet["rules"]["lessonCosts"];
    /** Which tiers' lessons land on top of the draw pile; null when every one goes to discard. */
    lessonToDrawTop: NonNullable<ContentSet["rules"]["lessonToDrawTop"]> | null;
    songLength: number;
    phraseLength: number;
    ratings: ContentSet["rules"]["ratings"];
    phraseBonuses: ContentSet["rules"]["phraseBonuses"];
    /** What a stumble costs by default; each Recovery card's own cost is on the card. */
    stumble: ContentSet["rules"]["stumble"];
    call: CallRules | null;
  };
  cardCatalog: DanceCard[];
  phrase: {
    number: number;
    count: number;
    stumbled: boolean;
    /** Whether a call has already gone unanswered in this phrase: the clean bonus is gone. */
    droppedCall: boolean;
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
  /**
   * The call standing over the 8-count being danced, identical in both roles' snapshots.
   * `met` is whether the ACTIVE player's dance would answer it, never the viewer's.
   */
  call: {
    byRole: Role;
    callId: string;
    name: string;
    ask: string;
    style: number;
    inPocket: boolean;
    met: boolean;
  } | null;
  /** The calls this game prints, with the one the current song card favours marked. */
  calls: { id: string; name: string; ask: string; style: number; favoured: boolean }[];
  /**
   * The run of answered calls: how long it is, how long it can get, what answering the call
   * standing over this 8-count would pay, and — for a call made as this 8-count ends — the run
   * this 8-count will leave behind with what the answer to that call would then pay.
   */
  afinque: {
    links: number;
    cap: number;
    nextBonus: number;
    ifCalledNow: { links: number; nextBonus: number };
  };
  /**
   * `songBonus` is what taking the song would pay the active player right now, and
   * `ifEndedNow` what ending the 8-count here would pay in total — the song card and the call
   * standing over it together, netted and clamped as the engine applies them, with `lost` set
   * when the Connection it costs ends the dance. Null outside the active player's dance step.
   */
  turn: GameState["turnDance"] & {
    songBonus: BonusEffect | null;
    ifEndedNow: { style: number; connection: number; lost: boolean } | null;
  };
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
 * The floor actions a card attempts once a Position is on the table, and those a Flourish or
 * Recovery attempts on an empty floor, in the order the player would mean them: a Position
 * takes or adjusts the hold before the dance and carries it after, a Recovery covers the call
 * standing over the player or marks a stumble.
 */
function establishedFloorActions(
  state: GameState,
  role: Role,
  instanceId: string,
  type: DanceCard["type"],
): GameAction[] {
  switch (type) {
    case "move":
      return [{ type: "PLAY_MOVE", role, moveInstanceId: instanceId }];
    case "position":
      return state.turnDance.cardsPlayed === 0
        ? [
            { type: "ADJUST", role, positionInstanceId: instanceId },
            { type: "TRANSITION", role, positionInstanceId: instanceId },
          ]
        : [
            { type: "TRANSITION", role, positionInstanceId: instanceId },
            { type: "ADJUST", role, positionInstanceId: instanceId },
          ];
    case "flourish":
      return [{ type: "PLAY_FLOURISH", role, flourishInstanceId: instanceId }];
    case "recovery":
      return [
        { type: "STUMBLE", role, recoveryInstanceId: instanceId },
        { type: "COVER_CALL", role, recoveryInstanceId: instanceId },
      ];
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

/**
 * Why none of a card's floor actions can be played, or null when one of them can. The first
 * failure is the one published: the actions are ordered by what the player would mean.
 */
function floorRefusal(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  hand: readonly CardInstance[],
  instance: CardInstance,
  cards: Record<string, DanceCard>,
): string | null {
  const card = cards[instance.cardId]!;
  const codes: string[] = [];
  if (state.table.position === null && (card.type === "position" || card.type === "move")) {
    const opening = openingRefusal(state, role, contentSet, hand, instance, cards);
    if (opening === null) return null;
    codes.push(opening);
  }
  for (const action of establishedFloorActions(state, role, instance.instanceId, card.type)) {
    const code = refusalCode(state, action, contentSet);
    if (code === null) return null;
    codes.push(code);
  }
  return codes[0] ?? null;
}

function floorRefusalList(
  state: GameState,
  role: Role,
  contentSet: ContentSet,
  cards: Record<string, DanceCard>,
): { instanceId: string; code: string }[] {
  if (!viewersDanceStep(state, role)) return [];
  const hand = state.players[role].hand;
  const refusals: { instanceId: string; code: string }[] = [];
  for (const instance of hand) {
    if (!cards[instance.cardId]) throw new Error(`Missing content for ${instance.cardId}.`);
    const code = floorRefusal(state, role, contentSet, hand, instance, cards);
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

/** The standing call as both players see it, judged against the active player's dance. */
function callView(state: GameState, contentSet: ContentSet): PlayerSnapshot["call"] {
  const standing = standingCall(state);
  const definition = standing ? callDefinition(contentSet, standing.callId) : null;
  if (!standing || !definition) return null;
  return {
    byRole: standing.byRole,
    callId: standing.callId,
    name: definition.name,
    ask: definition.ask,
    style: definition.style,
    inPocket: standing.inPocket,
    met: callMet(state, state.activeRole, contentSet, standing),
  };
}

/**
 * The 8-count as it would stand if the active player ended it here, run through the reducer
 * rather than restated: the order the song card and the call resolve in, the Connection ceiling
 * and the loss at zero are the engine's own. Null when there is no dance step to end.
 */
function endedNow(state: GameState, contentSet: ContentSet): GameState | null {
  if (state.status !== "playing" || state.phase !== "dance") return null;
  const ended = applyAction(
    state,
    { type: "END_DANCE", role: state.activeRole, callId: null },
    contentSet,
  );
  return ended.ok ? ended.state : null;
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
  const cap = afinqueCap(contentSet);
  // Both projections read the active player's dance, so both roles' snapshots are identical.
  const ended = endedNow(state, contentSet);
  const linksAfter = ended ? ended.shared.afinque : state.shared.afinque;

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
      lessonToDrawTop: contentSet.rules.lessonToDrawTop
        ? { ...contentSet.rules.lessonToDrawTop }
        : null,
      songLength: contentSet.song.cards.length,
      phraseLength: contentSet.song.cards.length / 2,
      ratings: contentSet.rules.ratings.map((rating) => ({ ...rating })),
      phraseBonuses: { ...contentSet.rules.phraseBonuses },
      stumble: { ...contentSet.rules.stumble },
      call: contentSet.rules.call
        ? {
            ...contentSet.rules.call,
            afinqueBonus: [...contentSet.rules.call.afinqueBonus],
            options: contentSet.rules.call.options.map((option) => ({ ...option })),
          }
        : null,
    },
    cardCatalog: contentSet.cards.map((entry) => ({ ...entry })),
    phrase: {
      number: state.phrase.number,
      count: state.songIndex < 0 ? 0 : (state.songIndex % (contentSet.song.cards.length / 2)) + 1,
      stumbled: state.phrase.stumbled,
      droppedCall: state.phrase.droppedCall,
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
      rung: entry.rung,
      styleGained: entry.styleGained,
      afinqueAfter: entry.afinqueAfter,
      move: entry.moveCardId ? (cards[entry.moveCardId] ?? null) : null,
      position: entry.positionCardId ? (cards[entry.positionCardId] ?? null) : null,
      flourish: entry.flourishCardId ? (cards[entry.flourishCardId] ?? null) : null,
      fromPosition: entry.fromPosition,
      endingPosition: entry.endingPosition,
      // The id stands even when this content no longer prints the call: it was still made.
      callMade: entry.callMade
        ? {
            id: entry.callMade,
            name: callDefinition(contentSet, entry.callMade)?.name ?? entry.callMade,
          }
        : null,
      callOutcome: entry.callOutcome,
      songBonus: entry.songBonus ? { ...entry.songBonus } : null,
      hold: entry.hold,
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
    call: callView(state, contentSet),
    calls: (contentSet.rules.call?.options ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      ask: option.ask,
      style: option.style,
      favoured: contentSet.song.cards[state.songIndex]?.favouredCall === option.id,
    })),
    afinque: {
      links: state.shared.afinque,
      cap,
      nextBonus: afinqueBonus(Math.min(state.shared.afinque + 1, cap), contentSet),
      ifCalledNow: {
        links: linksAfter,
        nextBonus: afinqueBonus(Math.min(linksAfter + 1, cap), contentSet),
      },
    },
    turn: {
      ...state.turnDance,
      songBonus: songBonusFor(state, state.activeRole, contentSet),
      ifEndedNow: ended
        ? {
            style: ended.shared.style - state.shared.style,
            connection: ended.shared.connection - state.shared.connection,
            lost: ended.status === "lost",
          }
        : null,
    },
    signal:
      state.signal && signaledInstance
        ? { role: state.signal.role, card: cardView(signaledInstance, cards)! }
        : null,
    legalActions: legalActions(state, role, contentSet),
    floorRefusals: floorRefusalList(state, role, contentSet, cards),
    lessonRefusals: lessonRefusalList(state, role, contentSet),
    // A window while the dance runs: a long song logs more than any screen in play shows. The
    // end screen recaps the whole song from its own sentences, and is sent once.
    log:
      state.status === "completed" || state.status === "lost"
        ? [...state.log]
        : state.log.slice(-80),
    finalScore: state.finalScore,
    rating: ratingDefinition
      ? { name: ratingDefinition.name, description: ratingDefinition.description }
      : null,
  };
}
