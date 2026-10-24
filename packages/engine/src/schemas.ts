import { z } from "zod";
import { CallIdSchema, CardIdSchema, PositionSchema, SongIdSchema } from "@clave/content";

export const ENGINE_VERSION = 6;
export const RoleSchema = z.enum(["lead", "follow"]);
export type Role = z.infer<typeof RoleSchema>;

export const CardInstanceSchema = z.object({
  instanceId: z.string().min(1),
  cardId: CardIdSchema,
  owner: RoleSchema,
});
export type CardInstance = z.infer<typeof CardInstanceSchema>;

export const PlayerStateSchema = z.object({
  role: RoleSchema,
  hand: z.array(CardInstanceSchema),
  drawPile: z.array(CardInstanceSchema),
  discardPile: z.array(CardInstanceSchema),
  money: z.number().int().nonnegative(),
  mulliganUsed: z.boolean(),
  ready: z.boolean(),
});
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const DanceTableSchema = z.object({
  position: CardInstanceSchema.nullable(),
  move: z.object({ card: CardInstanceSchema, dancedFrom: PositionSchema }).nullable(),
  flourish: CardInstanceSchema.nullable(),
});
export type DanceTable = z.infer<typeof DanceTableSchema>;

/** Which rung of the resolution ladder an 8-count ended on; "pending" until it ends. */
export const RungSchema = z.enum(["pending", "perfect", "clean", "awkward", "recovered", "break"]);
export type Rung = z.infer<typeof RungSchema>;

export const TurnDanceSchema = z.object({
  moveCardId: CardIdSchema.nullable(),
  moveStyle: z.number().int().nonnegative().nullable(),
  fromPosition: PositionSchema.nullable(),
  cardsPlayed: z.number().int().nonnegative(),
  positionsPlayed: z.number().int().nonnegative(),
  flourished: z.boolean(),
  posePlayed: z.boolean(),
  changedPosition: z.boolean(),
  stumbled: z.boolean(),
  canTransition: z.boolean(),
  boughtLesson: z.boolean(),
  learnedFromPartner: z.boolean(),
  bonusStyle: z.number().int().nonnegative(),
  bonusConnection: z.number().int().nonnegative(),
  // The call this 8-count made, and how the call standing over it resolved.
  callMade: CallIdSchema.nullable().default(null),
  callAnswered: z.boolean().default(false),
  callDropped: z.boolean().default(false),
  callCovered: z.boolean().default(false),
  callStyle: z.number().int().nonnegative().default(0),
  adjusted: z.boolean().default(false),
  rung: RungSchema.default("pending"),
});
export type TurnDance = z.infer<typeof TurnDanceSchema>;

export const PhraseStatsSchema = z.object({
  number: z.number().int().min(1).max(2),
  stumbled: z.boolean(),
  positionsDancedFrom: z.array(PositionSchema),
  flourishedBy: z.object({ lead: z.boolean(), follow: z.boolean() }),
  poseOnFinalCount: z.boolean(),
  learnedBy: z.object({ lead: z.boolean(), follow: z.boolean() }),
  privateLessonTakenThisRound: z.boolean(),
  droppedCall: z.boolean().default(false),
});
export type PhraseStats = z.infer<typeof PhraseStatsSchema>;

export const MoveHistoryEntrySchema = z.object({
  cardId: CardIdSchema,
  role: RoleSchema,
  phrase: z.number().int().min(1).max(2),
  songIndex: z.number().int().min(0).max(15),
  fromPosition: PositionSchema,
});
export type MoveHistoryEntry = z.infer<typeof MoveHistoryEntrySchema>;

/** The rung an 8-count stored before the ladder ended on, read from its `outcome`. */
const RUNG_BY_OUTCOME = { dance: "clean", basic: "awkward", stumble: "break" } as const;

export const DanceComboHistoryEntrySchema = z
  .object({
    sequence: z.number().int().positive(),
    phrase: z.number().int().min(1).max(2),
    songIndex: z.number().int().min(0).max(15),
    role: RoleSchema,
    outcome: z.enum(["dance", "basic", "stumble"]),
    moveCardId: CardIdSchema.nullable(),
    positionCardId: CardIdSchema.nullable(),
    flourishCardId: CardIdSchema.nullable(),
    fromPosition: PositionSchema.nullable(),
    endingPosition: PositionSchema.nullable(),
    // `outcome` keeps its three values for compatibility; `rung` is the fuller one beside it.
    // Derived rather than defaulted: calling an old stumble clean would contradict its own
    // outcome in the phrase strip and the end screen's ladder.
    rung: RungSchema.optional(),
    styleGained: z.number().int().default(0),
    afinqueAfter: z.number().int().nonnegative().default(0),
  })
  .transform((entry) => ({ ...entry, rung: entry.rung ?? RUNG_BY_OUTCOME[entry.outcome] }));
export type DanceComboHistoryEntry = z.infer<typeof DanceComboHistoryEntrySchema>;

export const MarketSchema = z.object({
  intermediateDeck: z.array(CardIdSchema),
  intermediateDisplay: z.array(CardIdSchema),
  advancedDeck: z.array(CardIdSchema),
  advancedDisplay: z.array(CardIdSchema),
});
export type Market = z.infer<typeof MarketSchema>;

export const SharedScoreSchema = z.object({
  connection: z.number().int().nonnegative(),
  style: z.number().int().nonnegative(),
  // Defaulted: a score stored before the call has no run of answered calls behind it.
  afinque: z.number().int().nonnegative().default(0),
});

/** The call one player has made over the other's next 8-count, until it resolves. */
export const StandingCallSchema = z
  .object({
    byRole: RoleSchema,
    callId: CallIdSchema,
    // The 8-count the call stands over: the one after the 8-count that made it.
    forSongIndex: z.number().int().min(0).max(15),
    inPocket: z.boolean(),
  })
  .nullable();
export type StandingCall = z.infer<typeof StandingCallSchema>;

export const SignalSchema = z.object({ role: RoleSchema, instanceId: z.string() }).nullable();

export const TurnCheckpointSchema = z.object({
  players: z.object({ lead: PlayerStateSchema, follow: PlayerStateSchema }),
  table: DanceTableSchema,
  shared: SharedScoreSchema,
  market: MarketSchema,
  phrase: PhraseStatsSchema,
  moveHistory: z.array(MoveHistoryEntrySchema),
  danceHistory: z.array(DanceComboHistoryEntrySchema).default([]),
  rngState: z.number().int().nonnegative(),
  nextInstance: z.number().int().positive(),
  turnDance: TurnDanceSchema,
  signal: SignalSchema,
  call: StandingCallSchema.default(null),
});
export type TurnCheckpoint = z.infer<typeof TurnCheckpointSchema>;

export const LogEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  role: RoleSchema.nullable(),
  kind: z.enum(["song", "dance", "lesson", "score", "system", "signal", "call"]),
  message: z.string(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export const GameStateSchema = z.object({
  engineVersion: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  gameId: z.string().min(1),
  seed: z.number().int().nonnegative(),
  rngState: z.number().int().nonnegative(),
  nextInstance: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  status: z.enum(["setup", "playing", "completed", "lost", "unresumable"]),
  terminalReason: z.string().nullable(),
  activeRole: RoleSchema,
  setupRole: RoleSchema,
  phase: z.enum(["mulligan", "dance", "lesson", "terminal"]),
  songIndex: z.number().int().min(-1).max(15),
  currentSongId: SongIdSchema.nullable(),
  players: z.object({ lead: PlayerStateSchema, follow: PlayerStateSchema }),
  shared: SharedScoreSchema,
  market: MarketSchema,
  table: DanceTableSchema,
  phrase: PhraseStatsSchema,
  moveHistory: z.array(MoveHistoryEntrySchema),
  danceHistory: z.array(DanceComboHistoryEntrySchema).default([]),
  turnDance: TurnDanceSchema,
  signal: SignalSchema,
  call: StandingCallSchema.default(null),
  log: z.array(LogEntrySchema),
  checkpoint: TurnCheckpointSchema.nullable(),
  finalScore: z.number().int().nonnegative().nullable(),
  rating: z.string().nullable(),
});
export type GameState = z.infer<typeof GameStateSchema>;

const ActorSchema = z.object({ role: RoleSchema });

export const GameActionSchema = z.discriminatedUnion("type", [
  ActorSchema.extend({ type: z.literal("MULLIGAN") }),
  ActorSchema.extend({ type: z.literal("CONFIRM_HAND") }),
  ActorSchema.extend({
    type: z.literal("PLAY_OPEN"),
    positionInstanceId: z.string(),
    moveInstanceId: z.string(),
  }),
  ActorSchema.extend({ type: z.literal("PLAY_MOVE"), moveInstanceId: z.string() }),
  ActorSchema.extend({ type: z.literal("TRANSITION"), positionInstanceId: z.string() }),
  ActorSchema.extend({ type: z.literal("PLAY_FLOURISH"), flourishInstanceId: z.string() }),
  ActorSchema.extend({ type: z.literal("ADJUST"), positionInstanceId: z.string() }),
  // Defaulted: an action log stored before the call ends every 8-count by taking the song.
  ActorSchema.extend({
    type: z.literal("END_DANCE"),
    callId: CallIdSchema.nullable().default(null),
  }),
  ActorSchema.extend({ type: z.literal("COVER_CALL"), recoveryInstanceId: z.string() }),
  ActorSchema.extend({ type: z.literal("STUMBLE"), recoveryInstanceId: z.string().nullable() }),
  ActorSchema.extend({
    type: z.literal("BUY_LESSON"),
    source: z.enum(["beginner", "intermediate", "advanced"]),
    cardId: CardIdSchema,
  }),
  ActorSchema.extend({ type: z.literal("LEARN_FROM_PARTNER"), cardId: CardIdSchema }),
  ActorSchema.extend({ type: z.literal("END_LESSON") }),
  ActorSchema.extend({ type: z.literal("SIGNAL_CARD"), instanceId: z.string() }),
  ActorSchema.extend({ type: z.literal("CLEAR_SIGNAL") }),
  ActorSchema.extend({ type: z.literal("UNDO_TURN") }),
]);
export type GameAction = z.infer<typeof GameActionSchema>;

export const RetiredLogSchema = z.object({
  engineVersion: z.number().int().positive(),
  reason: z.enum(["pre-upgrade", "replay-mismatch", "unresumable"]),
  // Verbatim: never parsed with the running action schema, never replayed.
  actions: z.array(z.unknown()),
});
export type RetiredLog = z.infer<typeof RetiredLogSchema>;

export const ReplayOriginSchema = z.object({
  state: GameStateSchema,
  retiredLogs: z.array(RetiredLogSchema),
});
export type ReplayOrigin = z.infer<typeof ReplayOriginSchema>;

export const ResumeEnvelopeSchema = z.object({
  engineVersion: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  contentBytes: z.string().min(1),
  seed: z.number().int().nonnegative(),
  actions: z.array(GameActionSchema),
  state: GameStateSchema,
  // Absent: the live log replays from a new game built from the seed.
  origin: ReplayOriginSchema.optional(),
});
export type ResumeEnvelope = z.infer<typeof ResumeEnvelopeSchema>;

export interface RuleFailure {
  code: string;
  message: string;
}

export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: RuleFailure };

export function otherRole(role: Role): Role {
  return role === "lead" ? "follow" : "lead";
}
