import {
  canonicalStringify,
  content,
  contentBytes,
  sha256Hex,
  type ContentSet,
} from "@clave/content";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  applyEnvelopeAction,
  createEnvelope,
  createGame,
  envelopeSnapshot,
  rehydrateEnvelope,
  type GameAction,
  type ResumeEnvelope,
  type Role,
} from "../src/index.js";

const roles: Role[] = ["lead", "follow"];
const INVALID = "Stored resume envelope is invalid.";
const CONTENT_MISMATCH = "Stored content does not match its hash.";
const UNREADABLE = "Stored state cannot be read by this release.";

// What a store hands back: the envelope as JSON, read again.
function stored(envelope: unknown): unknown {
  return JSON.parse(JSON.stringify(envelope));
}

// `steps` more actions on a game: both hands kept, then basic dances and finished lessons.
function played(
  steps: number,
  envelope: ResumeEnvelope = createEnvelope({ seed: 11, gameId: "ROOM11" }),
): ResumeEnvelope {
  for (let step = 0; step < steps; step += 1) {
    const { state } = envelope;
    const role = state.status === "setup" ? state.setupRole : state.activeRole;
    envelope = applied(
      envelope,
      state.status === "setup"
        ? { type: "CONFIRM_HAND", role }
        : state.phase === "dance"
          ? { type: "END_DANCE", role }
          : { type: "END_LESSON", role },
    );
  }
  return envelope;
}

// The envelope as an older release would have stored it.
function storedByEngine(engineVersion: number, envelope: ResumeEnvelope): ResumeEnvelope {
  return { ...envelope, engineVersion, state: { ...envelope.state, engineVersion } };
}

// An engine 1 game: its log holds FRESHEN, which engine 3 removed.
function freshenedEngineOneGame(): ResumeEnvelope {
  const old = storedByEngine(1, played(6));
  (old.actions as unknown[]).splice(4, 0, {
    type: "FRESHEN",
    role: "lead",
    discardInstanceIds: [],
  });
  return old;
}

// The bundled content with some rules changed, as bytes and hash a stored envelope could carry.
function ownContent(rules: Partial<ContentSet["rules"]>) {
  const set: ContentSet = { ...content, rules: { ...content.rules, ...rules } };
  const contentBytes = canonicalStringify(set);
  return { set, contentBytes, contentHash: sha256Hex(contentBytes) };
}

function applied(envelope: ResumeEnvelope, ...actions: GameAction[]): ResumeEnvelope {
  for (const action of actions) {
    const result = applyEnvelopeAction(envelope, action);
    if (!result.ok) throw new Error(result.error.message);
    envelope = result.envelope;
  }
  return envelope;
}

describe("resume envelope", () => {
  it("resumes a new envelope round-tripped through JSON unchanged", () => {
    const envelope: ResumeEnvelope = createEnvelope({ seed: 7, gameId: "ROOM7" });
    expect(rehydrateEnvelope(stored(envelope))).toEqual({
      kind: "resumed",
      envelope,
      detail: null,
    });
  });

  it("plays and shows a stored game by its own content, not the bundled content", () => {
    const own = ownContent({ incomePerTurn: 5 });
    const state = createGame({ seed: 3, content: own.set, contentHash: own.contentHash });
    const resumed = rehydrateEnvelope(
      stored({
        engineVersion: ENGINE_VERSION,
        contentHash: own.contentHash,
        contentBytes: own.contentBytes,
        seed: state.seed,
        actions: [],
        state,
      }),
    );
    expect(resumed.kind).toBe("resumed");
    const started = applied(
      resumed.envelope,
      { type: "CONFIRM_HAND", role: "lead" },
      { type: "CONFIRM_HAND", role: "follow" },
    );
    expect(envelopeSnapshot(started, "lead").self.money).toBe(5);
  });

  it("resumes an envelope stored before replay origins, replaying its log from the seed", () => {
    const envelope = played(6);
    expect(envelope).not.toHaveProperty("origin");
    expect(rehydrateEnvelope(stored(envelope))).toEqual({
      kind: "resumed",
      envelope,
      detail: null,
    });
  });

  describe("a same-version log that does not verify the stored state", () => {
    const corruptions: [string, (envelope: ResumeEnvelope) => void][] = [
      ["drift in the stored state", (envelope) => (envelope.state.shared.style += 3)],
      [
        "a log action the reducer rejects",
        (envelope) => (envelope.actions[2] = { type: "END_DANCE", role: "follow" }),
      ],
      [
        "a log that does not parse",
        (envelope) =>
          ((envelope.actions as unknown[])[3] = {
            type: "FRESHEN",
            role: "lead",
            discardInstanceIds: [],
          }),
      ],
    ];

    it.each(corruptions)("%s is a replay mismatch that keeps the stored state", (_, corrupt) => {
      const envelope = played(6);
      corrupt(envelope);
      const result = rehydrateEnvelope(stored(envelope));
      expect(result.kind).toBe("replay-mismatch");
      expect(result.detail).toEqual(expect.any(String));
      expect(result.envelope.state).toEqual(envelope.state);
      expect(result.envelope.actions).toEqual([]);
      expect(result.envelope.origin).toEqual({
        state: envelope.state,
        retiredLogs: [
          { engineVersion: ENGINE_VERSION, reason: "replay-mismatch", actions: envelope.actions },
        ],
      });
      expect(rehydrateEnvelope(stored(result.envelope)).kind).toBe("resumed");
    });

    it("is a replay mismatch when its content cannot build the game its log replays from", () => {
      const own = ownContent({ startingPosition: "Half-Open" });
      const envelope = {
        ...played(6),
        contentHash: own.contentHash,
        contentBytes: own.contentBytes,
      };
      const result = rehydrateEnvelope(stored(envelope));
      expect(result.kind).toBe("replay-mismatch");
      expect(result.envelope.state).toEqual(envelope.state);
      expect(rehydrateEnvelope(stored(result.envelope)).kind).toBe("resumed");
    });
  });

  describe("an envelope stored by another engine version", () => {
    it("upgrades: the stored state becomes the replay origin and its log retires pre-upgrade", () => {
      const old = storedByEngine(3, played(6));
      const result = rehydrateEnvelope(stored(old));
      const upgradedState = { ...old.state, engineVersion: ENGINE_VERSION };
      expect(result.kind).toBe("upgraded");
      expect(result.detail).toEqual(expect.any(String));
      expect(result.envelope).toEqual({
        engineVersion: ENGINE_VERSION,
        contentHash: old.contentHash,
        contentBytes: old.contentBytes,
        seed: old.seed,
        actions: [],
        state: upgradedState,
        origin: {
          state: upgradedState,
          retiredLogs: [{ engineVersion: 3, reason: "pre-upgrade", actions: old.actions }],
        },
      });
    });

    it("resumes the actions played after an upgrade", () => {
      const upgraded = rehydrateEnvelope(stored(storedByEngine(3, played(6)))).envelope;
      const continued = applied(
        upgraded,
        { type: "END_DANCE", role: "lead" },
        { type: "END_LESSON", role: "lead" },
      );
      expect(rehydrateEnvelope(stored(continued))).toEqual({
        kind: "resumed",
        envelope: continued,
        detail: null,
      });
    });

    it("upgrades an old log holding an action type this release does not know", () => {
      const old = freshenedEngineOneGame();
      const result = rehydrateEnvelope(stored(old));
      expect(result.kind).toBe("upgraded");
      expect(result.envelope.origin?.retiredLogs).toEqual([
        { engineVersion: 1, reason: "pre-upgrade", actions: old.actions },
      ]);
    });
  });

  it("reports a log stamped by the old upgrade path once, then resumes clean", () => {
    // The old upgrade path stamped the running version over a log that ran under engine 1,
    // kept no origin, and appended later actions to that same log.
    const old = freshenedEngineOneGame();
    const stamped = applied(
      storedByEngine(ENGINE_VERSION, old),
      { type: "END_DANCE", role: "lead" },
      { type: "END_LESSON", role: "lead" },
    );
    const first = rehydrateEnvelope(stored(stamped));
    expect(first.kind).toBe("replay-mismatch");
    expect(first.envelope.state).toEqual(stamped.state);
    const second = rehydrateEnvelope(stored(first.envelope));
    expect(second.kind).toBe("resumed");
    const continued = applied(second.envelope, { type: "END_DANCE", role: "follow" });
    expect(rehydrateEnvelope(stored(continued)).kind).toBe("resumed");
  });

  describe("an envelope this release cannot safely resume", () => {
    const tamperedBytes = contentBytes.replace('"initialConnection":4', '"initialConnection":9');
    const cases: [string, () => unknown, string][] = [
      ["a value that is not an envelope", () => "not an envelope", INVALID],
      [
        "a same-version state that does not read",
        () => ({ ...played(6), state: { ...played(6).state, phase: "freshen" } }),
        INVALID,
      ],
      [
        "tampered content bytes under the bundled content's hash",
        () => ({ ...played(6), contentBytes: tamperedBytes }),
        CONTENT_MISMATCH,
      ],
      [
        "another engine version's state that does not read",
        () => {
          const old = storedByEngine(1, played(6));
          return { ...old, state: { ...old.state, phase: "freshen" } };
        },
        UNREADABLE,
      ],
    ];

    it.each(cases)("%s is unresumable with its reason on view", (_, value, reason) => {
      expect(tamperedBytes).not.toBe(contentBytes);
      const result = rehydrateEnvelope(stored(value()));
      expect(result.kind).toBe("unresumable");
      expect(result.detail).toBe(reason);
      for (const role of roles)
        expect(envelopeSnapshot(result.envelope, role)).toMatchObject({
          status: "unresumable",
          terminalReason: reason,
        });
      expect(rehydrateEnvelope(stored(result.envelope)).kind).toBe("resumed");
    });

    it("keeps a readable stored state, marked unresumable, inside an invalid envelope", () => {
      const envelope = played(6);
      const result = rehydrateEnvelope(stored({ ...envelope, engineVersion: undefined }));
      expect(result.kind).toBe("unresumable");
      expect(result.envelope.state).toEqual({
        ...envelope.state,
        status: "unresumable",
        phase: "terminal",
        terminalReason: INVALID,
      });
    });

    it("retires the live log of an unresumable envelope whose envelope engineVersion does not parse", () => {
      const envelope = played(6);
      const result = rehydrateEnvelope(stored({ ...envelope, engineVersion: undefined }));
      expect(result.kind).toBe("unresumable");
      expect(result.envelope.origin?.retiredLogs).toContainEqual(
        expect.objectContaining({
          engineVersion: envelope.state.engineVersion,
          reason: "unresumable",
          actions: envelope.actions,
        }),
      );
    });

    it("ends a stored state holding a card its content lacks as unresumable, and shows it", () => {
      const envelope = played(6);
      envelope.state.players.lead.hand.push({
        instanceId: "lead-99",
        cardId: "mov_999",
        owner: "lead",
      });
      const result = rehydrateEnvelope(stored(envelope));
      expect(result.kind).toBe("unresumable");
      expect(result.detail).toBe(INVALID);
      for (const role of roles)
        expect(envelopeSnapshot(result.envelope, role)).toMatchObject({
          status: "unresumable",
          terminalReason: INVALID,
        });
    });
  });
});

type JsonPath = (string | number)[];

// Every path into a JSON value, the value itself first.
function pathsOf(value: unknown, path: JsonPath = []): JsonPath[] {
  if (typeof value !== "object" || value === null) return [path];
  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((entry, index) => [index, entry])
    : Object.entries(value);
  return [path, ...entries.flatMap(([key, entry]) => pathsOf(entry, [...path, key]))];
}

// A copy of `base` with the value at each path replaced, or removed when `value` is undefined.
function corrupted(base: unknown, corruptions: { path: JsonPath; value: unknown }[]): unknown {
  let root = structuredClone(base);
  for (const { path, value } of corruptions) {
    if (path.length === 0) {
      root = value;
      continue;
    }
    const parent = path
      .slice(0, -1)
      .reduce<unknown>((node, key) => (node as Record<string | number, unknown>)?.[key], root);
    if (typeof parent !== "object" || parent === null) continue;
    const key = path.at(-1)!;
    if (value !== undefined) (parent as Record<string | number, unknown>)[key] = value;
    else if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete (parent as Record<string | number, unknown>)[key];
  }
  return root;
}

describe("rehydrating any stored value", () => {
  // A game stored before replay origins, and an upgraded one with an origin and a retired log.
  const realEnvelopes = [
    stored(played(9)),
    stored(played(3, rehydrateEnvelope(stored(storedByEngine(3, played(9)))).envelope)),
  ];
  const replacement = fc.option(fc.oneof(fc.jsonValue(), fc.integer({ min: -1, max: 12 })), {
    nil: undefined,
  });
  // Half of them stored by another engine version, so upgrades are corrupted too.
  const storedBy = fc.oneof(
    fc.constant([]),
    fc
      .integer({ min: 1, max: 9 })
      .map((engineVersion) => [{ path: ["engineVersion"], value: engineVersion }]),
  );
  const corruptedEnvelope = fc.constantFrom(...realEnvelopes).chain((base) =>
    fc
      .tuple(
        storedBy,
        fc.array(fc.record({ path: fc.constantFrom(...pathsOf(base)), value: replacement }), {
          maxLength: 3,
        }),
      )
      .map(([version, corruptions]) => corrupted(base, [...version, ...corruptions])),
  );

  it("never throws, shows both roles, and resumes clean the second time", () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue(), corruptedEnvelope), (value) => {
        const first = rehydrateEnvelope(value);
        expect(first.detail === null).toBe(first.kind === "resumed");
        for (const role of roles)
          expect(envelopeSnapshot(first.envelope, role).viewerRole).toBe(role);
        expect(rehydrateEnvelope(stored(first.envelope)).kind).toBe("resumed");
      }),
      { numRuns: 400 },
    );
  }, 60_000);
});
