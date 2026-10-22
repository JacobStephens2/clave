import {
  canonicalStringify,
  content as bundledContent,
  contentBytes as bundledContentBytes,
  contentHash as bundledContentHash,
  verifyContentHash,
  type ContentSet,
} from "@clave/content";
import type { z } from "zod";
import { applyAction, createGame, replayFrom } from "./game.js";
import { snapshotFor, type PlayerSnapshot } from "./snapshot.js";
import {
  ENGINE_VERSION,
  GameActionSchema,
  GameStateSchema,
  ReplayOriginSchema,
  ResumeEnvelopeSchema,
  type ApplyResult,
  type GameAction,
  type GameState,
  type ResumeEnvelope,
  type RetiredLog,
  type Role,
  type RuleFailure,
} from "./schemas.js";

export type RehydrationKind = "resumed" | "replay-mismatch" | "upgraded" | "unresumable";

export type Rehydration =
  | { kind: "resumed"; envelope: ResumeEnvelope; detail: null }
  | { kind: Exclude<RehydrationKind, "resumed">; envelope: ResumeEnvelope; detail: string };

const ROLES: Role[] = ["lead", "follow"];
const INVALID = "Stored resume envelope is invalid.";
const CONTENT_MISMATCH = "Stored content does not match its hash.";
const UNREADABLE = "Stored state cannot be read by this release.";

// Read first. The rest of a stored envelope stays unknown until its turn to be read.
const StoredFrameSchema = ResumeEnvelopeSchema.pick({
  engineVersion: true,
  contentHash: true,
  contentBytes: true,
  seed: true,
}).loose();
type StoredFrame = z.infer<typeof StoredFrameSchema>;

// Verified content by hash. An entry is reused only for byte-identical bytes, so tampered
// bytes under a known hash are still verified, and fail.
const verifiedContents = new Map<string, { bytes: string; content: ContentSet }>([
  [bundledContentHash, { bytes: bundledContentBytes, content: bundledContent }],
]);

function verifiedContent(bytes: string, hash: string): ContentSet | null {
  const cached = verifiedContents.get(hash);
  if (cached?.bytes === bytes) return cached.content;
  try {
    const content = verifyContentHash(bytes, hash);
    verifiedContents.set(hash, { bytes, content });
    return content;
  } catch {
    return null;
  }
}

function contentOf(envelope: ResumeEnvelope): ContentSet {
  const content = verifiedContent(envelope.contentBytes, envelope.contentHash);
  if (!content) throw new Error("Content hash does not match content bytes.");
  return content;
}

/** A new game's envelope on the bundled content. */
export function createEnvelope(options: { seed: number; gameId?: string }): ResumeEnvelope {
  const state = createGame(options);
  return {
    engineVersion: ENGINE_VERSION,
    contentHash: bundledContentHash,
    contentBytes: bundledContentBytes,
    seed: state.seed,
    actions: [],
    state,
  };
}

export function applyEnvelopeAction(
  envelope: ResumeEnvelope,
  action: GameAction,
): { ok: true; envelope: ResumeEnvelope } | { ok: false; error: RuleFailure } {
  const result = applyAction(envelope.state, action, contentOf(envelope));
  if (!result.ok) return result;
  return {
    ok: true,
    envelope: {
      ...envelope,
      actions: [...envelope.actions, structuredClone(action)],
      state: result.state,
    },
  };
}

export function envelopeSnapshot(envelope: ResumeEnvelope, role: Role): PlayerSnapshot {
  return snapshotFor(envelope.state, role, contentOf(envelope));
}

/**
 * Turns any stored value back into a live envelope under the running engine. The stored state
 * decides; the action log only verifies it. Persist the envelope before serving it whenever the
 * kind is not `resumed`.
 */
export function rehydrateEnvelope(stored: unknown): Rehydration {
  const frame = StoredFrameSchema.safeParse(stored);
  if (!frame.success) return unresumable(stored, INVALID);
  const content = verifiedContent(frame.data.contentBytes, frame.data.contentHash);
  if (!content) return unresumable(stored, CONTENT_MISMATCH);
  const state = readableState(frame.data.state, content);
  if (frame.data.engineVersion !== ENGINE_VERSION)
    return state ? upgraded(frame.data, state) : unresumable(stored, UNREADABLE);
  return state ? verifyByReplay(frame.data, content, state) : unresumable(stored, INVALID);
}

/** The stored state, if it reads under the running schema and both roles can view it. */
function readableState(raw: unknown, content: ContentSet): GameState | null {
  const state = GameStateSchema.safeParse(raw);
  if (!state.success) return null;
  try {
    for (const role of ROLES) snapshotFor(state.data, role, content);
    return state.data;
  } catch {
    return null;
  }
}

/** Replays the live log from the replay origin; the stored state stands either way. */
function verifyByReplay(frame: StoredFrame, content: ContentSet, state: GameState): Rehydration {
  const actions = GameActionSchema.array().safeParse(frame.actions);
  if (!actions.success)
    return replayMismatch(frame, state, "The stored action log cannot be read.");
  const origin = ReplayOriginSchema.optional().safeParse(frame.origin);
  if (!origin.success)
    return replayMismatch(frame, state, "The stored replay origin cannot be read.");
  let replay: ApplyResult;
  try {
    const start =
      origin.data?.state ??
      createGame({
        seed: frame.seed,
        gameId: state.gameId,
        content,
        contentHash: frame.contentHash,
      });
    replay = replayFrom(start, actions.data, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    replay = { ok: false, error: { code: "REPLAY_FAILED", message } };
  }
  if (!replay.ok)
    return replayMismatch(
      frame,
      state,
      `The stored action log does not replay: ${replay.error.message}`,
    );
  if (canonicalStringify(replay.state) !== canonicalStringify(state))
    return replayMismatch(frame, state, "Replaying the stored action log gives a different state.");
  return {
    kind: "resumed",
    envelope: {
      engineVersion: frame.engineVersion,
      contentHash: frame.contentHash,
      contentBytes: frame.contentBytes,
      seed: frame.seed,
      actions: actions.data,
      state,
      ...(origin.data ? { origin: origin.data } : {}),
    },
    detail: null,
  };
}

function replayMismatch(frame: StoredFrame, state: GameState, detail: string): Rehydration {
  return {
    kind: "replay-mismatch",
    envelope: resumingFrom(frame, frame, state, "replay-mismatch"),
    detail,
  };
}

/** Resumes another engine version's stored state without reading or replaying its log. */
function upgraded(frame: StoredFrame, state: GameState): Rehydration {
  return {
    kind: "upgraded",
    envelope: resumingFrom(
      frame,
      frame,
      { ...state, engineVersion: ENGINE_VERSION },
      "pre-upgrade",
    ),
    detail: `Engine version ${frame.engineVersion} state resumed under engine version ${ENGINE_VERSION}.`,
  };
}

/**
 * Ends the stored game: its stored state when the content verifies and the state reads,
 * otherwise a new game on the bundled content, marked unresumable with `reason`.
 */
function unresumable(stored: unknown, reason: string): Rehydration {
  const base = readableStoredGame(stored) ?? createEnvelope(newGameOptions(stored));
  const state: GameState = {
    ...base.state,
    engineVersion: ENGINE_VERSION,
    status: "unresumable",
    phase: "terminal",
    terminalReason: reason,
  };
  return {
    kind: "unresumable",
    envelope: resumingFrom(stored, base, state, "unresumable"),
    detail: reason,
  };
}

function readableStoredGame(
  stored: unknown,
): Pick<ResumeEnvelope, "contentHash" | "contentBytes" | "state"> | null {
  const contentHash = field(stored, "contentHash");
  const contentBytes = field(stored, "contentBytes");
  if (typeof contentHash !== "string" || typeof contentBytes !== "string") return null;
  const content = verifiedContent(contentBytes, contentHash);
  const state = content && readableState(field(stored, "state"), content);
  return state ? { contentHash, contentBytes, state } : null;
}

function newGameOptions(stored: unknown): { seed: number; gameId?: string } {
  const seed = ResumeEnvelopeSchema.shape.seed.safeParse(field(stored, "seed"));
  const gameId = GameStateSchema.shape.gameId.safeParse(field(field(stored, "state"), "gameId"));
  return { seed: seed.success ? seed.data : 0, ...(gameId.success ? { gameId: gameId.data } : {}) };
}

/**
 * The stored game resuming from `state` from now on: `state` becomes the replay origin, the
 * stored live log retires verbatim with its engine version and `reason`, and the live log
 * starts empty.
 */
function resumingFrom(
  stored: unknown,
  content: Pick<ResumeEnvelope, "contentHash" | "contentBytes">,
  state: GameState,
  reason: RetiredLog["reason"],
): ResumeEnvelope {
  return {
    engineVersion: ENGINE_VERSION,
    contentHash: content.contentHash,
    contentBytes: content.contentBytes,
    seed: state.seed,
    actions: [],
    state,
    origin: { state: structuredClone(state), retiredLogs: retiredLogsAfter(stored, reason) },
  };
}

/**
 * The logs `stored` had already retired, then its live log, retired with `reason`.
 * Version is the envelope's when that parses, otherwise the state's.
 */
function retiredLogsAfter(stored: unknown, reason: RetiredLog["reason"]): RetiredLog[] {
  const earlier = ReplayOriginSchema.pick({ retiredLogs: true }).safeParse(field(stored, "origin"));
  const envelopeVersion = ResumeEnvelopeSchema.shape.engineVersion.safeParse(
    field(stored, "engineVersion"),
  );
  const stateVersion = GameStateSchema.shape.engineVersion.safeParse(
    field(field(stored, "state"), "engineVersion"),
  );
  const engineVersion = envelopeVersion.success
    ? envelopeVersion.data
    : stateVersion.success
      ? stateVersion.data
      : null;
  const actions = field(stored, "actions");
  return [
    ...(earlier.success ? earlier.data.retiredLogs : []),
    ...(engineVersion !== null
      ? [
          {
            engineVersion,
            reason,
            actions: Array.isArray(actions) ? actions : [],
          },
        ]
      : []),
  ];
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
