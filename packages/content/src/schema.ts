import { z } from "zod";

export const CardIdSchema = z.string().regex(/^(pos|mov|flo|rec)_\d{3}$/);
export const SongIdSchema = z.string().regex(/^song_\d{3}$/);
export const TierSchema = z.enum(["B", "I", "A"]);
export const PositionSchema = z.enum(["Open", "Closed", "Half-Open", "Half-Closed"]);

const BaseCardSchema = z.object({
  id: CardIdSchema,
  name: z.string().min(1),
  tier: TierSchema,
});

export const PositionCardSchema = BaseCardSchema.extend({
  type: z.literal("position"),
  position: PositionSchema,
});

export const MoveCardSchema = BaseCardSchema.extend({
  type: z.literal("move"),
  positions: z.array(PositionSchema).min(1),
  style: z.number().int().nonnegative(),
});

export const FlourishCardSchema = BaseCardSchema.extend({
  type: z.literal("flourish"),
  positions: z.union([z.literal("any"), z.array(PositionSchema).min(1)]),
  style: z.number().int().nonnegative(),
  pose: z.boolean().default(false),
});

export const RecoveryCardSchema = BaseCardSchema.extend({
  type: z.literal("recovery"),
  connectionCost: z.number().int().min(0).max(2),
});

export const DanceCardSchema = z.discriminatedUnion("type", [
  PositionCardSchema,
  MoveCardSchema,
  FlourishCardSchema,
  RecoveryCardSchema,
]);

export const BonusConditionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("moveStyleAtMost"), value: z.number().int() }),
  z.object({ op: z.literal("moveStyleAtLeast"), value: z.number().int() }),
  z.object({ op: z.literal("moveFrom"), positions: z.array(PositionSchema).min(1) }),
  z.object({ op: z.literal("flourishPlayed") }),
  z.object({ op: z.literal("posePlayed") }),
  z.object({ op: z.literal("noPositionPlayed") }),
  z.object({ op: z.literal("samePositionAsPreviousMove") }),
  z.object({ op: z.literal("endsInPosition"), position: PositionSchema }),
  z.object({ op: z.literal("positionChanged") }),
  z.object({ op: z.literal("partnerPlayedMoveGame") }),
  z.object({ op: z.literal("partnerPlayedMovePhrase") }),
  z.object({ op: z.literal("cardsPlayedAtLeast"), value: z.number().int().positive() }),
]);

export const BonusEffectSchema = z.object({
  style: z.number().int().nonnegative().default(0),
  connection: z.number().int().nonnegative().default(0),
});

export const SongCardSchema = z.object({
  id: SongIdSchema,
  number: z.number().int().min(1).max(16),
  section: z.enum(["Cuerpo", "Montuno"]),
  moment: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  bonuses: z
    .array(
      z.object({
        condition: BonusConditionSchema,
        effect: BonusEffectSchema,
      }),
    )
    .min(1),
});

const CountedCardSchema = z.object({ cardId: CardIdSchema, count: z.number().int().positive() });

export const ContentSetSchema = z.object({
  version: z.literal(1),
  rules: z.object({
    initialConnection: z.number().int().nonnegative(),
    maximumConnection: z.number().int().positive(),
    initialStyle: z.number().int().nonnegative(),
    startingMoney: z.number().int().nonnegative(),
    incomePerTurn: z.number().int().nonnegative(),
    // Preserve older embedded content hashes when resuming saved games.
    startingPosition: PositionSchema.optional(),
    handSize: z.number().int().positive(),
    danceLimits: z.object({
      positions: z.number().int().positive(),
      moves: z.number().int().positive(),
      flourishes: z.number().int().positive(),
    }),
    stumble: z.object({ defaultConnectionCost: z.number().int().nonnegative() }),
    lessonCosts: z.object({
      beginner: z.number().int().nonnegative(),
      intermediate: z.number().int().nonnegative(),
      advanced: z.number().int().nonnegative(),
    }),
    phraseBonuses: z.object({
      clean: z.number().int().nonnegative(),
      varietyPerExtraPosition: z.number().int().nonnegative(),
      sharedFlair: z.number().int().nonnegative(),
      poseFinish: z.number().int().nonnegative(),
    }),
    ratings: z
      .array(
        z.object({
          minimum: z.number().int().nonnegative(),
          name: z.string().min(1),
          description: z.string().min(1),
        }),
      )
      .min(1),
  }),
  cards: z.array(DanceCardSchema).min(1),
  decks: z.object({
    starter: z.array(CountedCardSchema),
    beginnerSupply: z.array(CardIdSchema),
    intermediate: z.array(CountedCardSchema),
    advanced: z.array(CountedCardSchema),
    full: z.object({ lead: z.array(CountedCardSchema), follow: z.array(CountedCardSchema) }),
  }),
  song: z.object({
    id: z.literal("lloraras"),
    title: z.literal("Llorarás"),
    artist: z.literal("Oscar D'León"),
    cards: z.array(SongCardSchema).length(16),
  }),
});

export type CardId = z.infer<typeof CardIdSchema>;
export type SongId = z.infer<typeof SongIdSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type DanceCard = z.infer<typeof DanceCardSchema>;
export type MoveCard = z.infer<typeof MoveCardSchema>;
export type FlourishCard = z.infer<typeof FlourishCardSchema>;
export type SongCard = z.infer<typeof SongCardSchema>;
export type BonusCondition = z.infer<typeof BonusConditionSchema>;
export type BonusEffect = z.infer<typeof BonusEffectSchema>;
export type ContentSet = z.infer<typeof ContentSetSchema>;
