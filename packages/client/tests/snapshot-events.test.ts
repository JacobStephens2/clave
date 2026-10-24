// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  snapshotFor,
  type GameAction,
  type GameState,
  type PlayerSnapshot,
  type Role,
} from "@clave/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SnapshotCues } from "../src/components/SnapshotCues.js";
import { SoundEffectsProvider } from "../src/components/SoundEffects.js";
import { eventsBetween, type SnapshotEvent } from "../src/snapshot-events.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// The bare global here is Node's experimental store, which is not available in a test run.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});

const callRules = content.rules.call!;
const styleOf = (callId: string) => callRules.options.find((option) => option.id === callId)!.style;
const nameOf = (callId: string) => callRules.options.find((option) => option.id === callId)!.name;

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function readyGame(seed = 42, gameId?: string): GameState {
  let state = createGame(gameId === undefined ? { seed, content } : { seed, gameId, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  return applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
}

function setHand(state: GameState, role: Role, cardIds: string[]): void {
  state.players[role].hand = cardIds.map((cardId, index) => ({
    instanceId: `test-${role}-${index}-${cardId}`,
    cardId,
    owner: role,
  }));
}

const held = (state: GameState, role: Role, cardId: string) =>
  state.players[role].hand.find((entry) => entry.cardId === cardId)!.instanceId;

const kinds = (events: readonly SnapshotEvent[]) => events.map((event) => event.kind);
const only = <K extends SnapshotEvent["kind"]>(events: readonly SnapshotEvent[], kind: K) =>
  events.find((event): event is Extract<SnapshotEvent, { kind: K }> => event.kind === kind);

/** The viewer's own practice money is the one moment the two roles do not share. */
const sharedPart = (events: readonly SnapshotEvent[]) =>
  events.filter((event) => event.kind !== "practice-money");

/**
 * One step of a real game, read as both devices read it. Every step asserts on the way
 * through that the Lead's snapshots and the Follow's snapshots yield the same moments.
 */
function step(
  before: GameState,
  action: GameAction,
): { events: SnapshotEvent[]; state: GameState } {
  const state = applyOk(before, action);
  const lead = eventsBetween(snapshotFor(before, "lead"), snapshotFor(state, "lead"));
  const follow = eventsBetween(snapshotFor(before, "follow"), snapshotFor(state, "follow"));
  expect(sharedPart(follow)).toEqual(sharedPart(lead));
  return { events: lead, state };
}

/** The Lead opens the floor from Open, dances, and calls over the Follow's next 8-count. */
function callStands(callId: string, seed = 42): { events: SnapshotEvent[]; state: GameState } {
  let state = readyGame(seed);
  setHand(state, "lead", ["pos_001", "mov_002"]);
  state = applyOk(state, {
    type: "PLAY_OPEN",
    role: "lead",
    positionInstanceId: held(state, "lead", "pos_001"),
    moveInstanceId: held(state, "lead", "mov_002"),
  });
  const made = step(state, { type: "END_DANCE", role: "lead", callId });
  return { events: made.events, state: applyOk(made.state, { type: "END_LESSON", role: "lead" }) };
}

/** The active player dances `moveCardId` from the floor as it stands. */
function danceMove(state: GameState, moveCardId = "mov_002"): GameState {
  const role = state.activeRole;
  setHand(state, role, [moveCardId, "flo_003", "rec_001"]);
  return applyOk(state, {
    type: "PLAY_MOVE",
    role,
    moveInstanceId: held(state, role, moveCardId),
  });
}

/**
 * Counts 1 to 4 of a real game: the Lead calls, counts 2 and 3 answer and call on, and
 * count 4 answers the third call in a row. The step either side of that third answer.
 */
function thirdAnswerInARow(): { before: GameState; after: GameState } {
  let state = callStands("call_001").state;
  for (const links of [1, 2]) {
    state = danceMove(state);
    state = applyOk(state, { type: "END_DANCE", role: state.activeRole, callId: "call_001" });
    state = applyOk(state, { type: "END_LESSON", role: state.danceHistory.at(-1)!.role });
    expect(state.shared.afinque).toBe(links);
  }
  const before = danceMove(state);
  return {
    before,
    after: applyOk(before, { type: "END_DANCE", role: before.activeRole, callId: null }),
  };
}

/** Basic 8-counts until the song reaches `songIndex`: nothing danced, nothing called. */
function advanceTo(state: GameState, songIndex: number): GameState {
  while (state.songIndex < songIndex && state.status === "playing") {
    const role = state.activeRole;
    state = applyOk(state, { type: "END_DANCE", role, callId: null });
    state = applyOk(state, { type: "END_LESSON", role });
  }
  return state;
}

/** The song's last 8-count, danced to a pose: the step either side of the cierre. */
function finishedOnAPose(): { before: GameState; after: GameState } {
  let state = advanceTo(readyGame(), 15);
  const role = state.activeRole;
  setHand(state, role, ["pos_001", "mov_002", "flo_005"]);
  state = applyOk(state, {
    type: "PLAY_OPEN",
    role,
    positionInstanceId: held(state, role, "pos_001"),
    moveInstanceId: held(state, role, "mov_002"),
  });
  state = applyOk(state, {
    type: "PLAY_FLOURISH",
    role,
    flourishInstanceId: held(state, role, "flo_005"),
  });
  const before = applyOk(state, { type: "END_DANCE", role, callId: null });
  return { before, after: applyOk(before, { type: "END_LESSON", role }) };
}

describe("snapshot events · the moments both devices cue", () => {
  it("says nothing about the first snapshot a device sees, on load or on a resume", () => {
    const state = readyGame();
    expect(eventsBetween(null, snapshotFor(state, "lead"))).toEqual([]);
  });

  it("says nothing when the hot-seat screen changes hands", () => {
    const { state } = callStands("call_001");
    // The same step, read for the other viewer: the pass screen is not a new moment.
    expect(eventsBetween(snapshotFor(state, "lead"), snapshotFor(state, "follow"))).toEqual([]);
  });

  it("says nothing about a snapshot from another dance", () => {
    const mine = readyGame(42, "hot-1");
    const theirs = advanceTo(readyGame(7, "hot-2"), 3);
    expect(eventsBetween(snapshotFor(mine, "lead"), snapshotFor(theirs, "lead"))).toEqual([]);
  });

  it("says nothing about a snapshot several steps on, which is what a reconnect sends", () => {
    const stood = callStands("call_001");
    const away = danceMove(stood.state);
    const dropped = snapshotFor(away, "lead");
    // The socket is down while the Follow answers, calls back, and takes a lesson.
    let state = applyOk(away, { type: "END_DANCE", role: "follow", callId: "call_003" });
    state = applyOk(state, { type: "END_LESSON", role: "follow" });
    const resync = snapshotFor(state, "lead");
    expect(resync.sequence).toBeGreaterThan(dropped.sequence + 1);
    expect(eventsBetween(dropped, resync)).toEqual([]);

    // The step after the resync is a moment of the dance again, read from the snapshot it has.
    const danced = danceMove(state);
    const { events } = step(danced, { type: "END_DANCE", role: "lead", callId: null });
    expect(kinds(events)).toContain("rung");
  });

  it("reads a call made, with the name the song card favours", () => {
    const { events } = callStands("call_001");
    const made = only(events, "call-made");
    expect(made).toMatchObject({
      byRole: "lead",
      callId: "call_001",
      name: nameOf("call_001"),
      style: styleOf("call_001"),
      // Count 1 asks for "Stay with me": this call is in the pocket.
      favoured: true,
    });
    expect(made?.ask).toBe(callRules.options[0]!.ask);
    expect(made?.sentence).toContain("calls Stay with me");
    expect(kinds(events)).toContain("rung");
  });

  it("reads the answer, its Style, the pocket and the first link of the run", () => {
    const stood = callStands("call_001");
    const danced = danceMove(stood.state);
    const { events } = step(danced, { type: "END_DANCE", role: "follow", callId: null });

    expect(only(events, "call-answered")).toMatchObject({
      byRole: "follow",
      callId: "call_001",
      name: nameOf("call_001"),
      style: styleOf("call_001") + callRules.inPocketStyle,
      inPocket: true,
      links: 1,
      afinqueBonus: callRules.afinqueBonus[0],
    });
    expect(only(events, "afinque-link")).toMatchObject({
      links: 1,
      cap: callRules.afinqueBonus.length,
    });
    expect(only(events, "rung")).toMatchObject({ rung: "perfect", role: "follow", count: 2 });
    expect(only(events, "score")?.style).toBeGreaterThan(0);
  });

  it("counts the links of a run and the Style the afinque adds to each answer", () => {
    const { before } = thirdAnswerInARow();
    const { events } = step(before, { type: "END_DANCE", role: before.activeRole, callId: null });

    expect(only(events, "afinque-link")).toMatchObject({
      links: 3,
      bonus: callRules.afinqueBonus[2],
    });
    expect(only(events, "call-answered")?.afinqueBonus).toBe(callRules.afinqueBonus[2]);
  });

  it("reads a dropped call and the Connection the couple lost for it", () => {
    const stood = callStands("call_005");
    // Stay close asks for a Move from Closed; this one is danced from Open.
    const danced = danceMove(stood.state);
    const { events } = step(danced, { type: "END_DANCE", role: "follow", callId: null });

    expect(only(events, "call-dropped")).toMatchObject({
      byRole: "follow",
      callId: "call_005",
      name: nameOf("call_005"),
      connection: callRules.missConnectionCost,
    });
    expect(only(events, "rung")?.rung).toBe("awkward");
    expect(only(events, "score")?.connection).toBe(-callRules.missConnectionCost);
    expect(kinds(events)).not.toContain("afinque-break");
  });

  it("reads a covered call and names the Recovery card that covered it", () => {
    const stood = callStands("call_005");
    setHand(stood.state, "follow", ["rec_001", "mov_002"]);
    const { events, state } = step(stood.state, {
      type: "COVER_CALL",
      role: "follow",
      recoveryInstanceId: held(stood.state, "follow", "rec_001"),
    });

    expect(only(events, "call-covered")).toMatchObject({
      byRole: "follow",
      callId: "call_005",
      name: nameOf("call_005"),
      alreadyAnswered: false,
    });
    expect(only(events, "call-covered")?.sentence).toContain("Return to Basic");
    expect(kinds(events)).not.toContain("call-dropped");
    // The cover is cued once: finishing the 8-count afterwards is a plain, clean count.
    const finished = step(danceMove(state), {
      type: "END_DANCE",
      role: "follow",
      callId: null,
    });
    expect(kinds(finished.events)).not.toContain("call-covered");
    expect(only(finished.events, "rung")?.rung).toBe("recovered");
  });

  it("marks a cover the dance had already made unnecessary", () => {
    const stood = callStands("call_001");
    // Count 1 asks for a Move: the Follow has danced one, so the call is already met.
    const danced = danceMove(stood.state);
    const { events } = step(danced, {
      type: "COVER_CALL",
      role: "follow",
      recoveryInstanceId: held(danced, "follow", "rec_001"),
    });

    expect(only(events, "call-covered")).toMatchObject({ alreadyAnswered: true });
  });

  it("reads the run breaking when a call is dropped mid-phrase", () => {
    const stood = callStands("call_001");
    let state = danceMove(stood.state);
    state = applyOk(state, { type: "END_DANCE", role: "follow", callId: "call_005" });
    state = applyOk(state, { type: "END_LESSON", role: "follow" });
    expect(state.shared.afinque).toBe(1);

    const danced = danceMove(state);
    const { events } = step(danced, { type: "END_DANCE", role: "lead", callId: null });
    expect(only(events, "afinque-break")).toMatchObject({ links: 1, atPhraseEnd: false });
  });

  it("reads a stumble as a break, and drops the call standing over it for free", () => {
    const stood = callStands("call_005");
    const { events } = step(stood.state, {
      type: "STUMBLE",
      role: "follow",
      recoveryInstanceId: null,
    });

    expect(only(events, "rung")).toMatchObject({ rung: "break", role: "follow" });
    expect(only(events, "call-dropped")?.connection).toBe(0);
    expect(only(events, "score")?.connection).toBe(-content.rules.stumble.defaultConnectionCost);
  });

  it("reads the campana coming in when the song turns to the montuno", () => {
    const state = advanceTo(readyGame(), 7);
    const role = state.activeRole;
    const danced = applyOk(state, { type: "END_DANCE", role, callId: null });
    const { events } = step(danced, { type: "END_LESSON", role });

    expect(only(events, "section-change")).toMatchObject({
      from: "Cuerpo",
      to: "Montuno",
      phrase: 2,
    });
  });

  it("reads the cierre when the song's last 8-count ends on a pose", () => {
    const { before } = finishedOnAPose();
    const { events } = step(before, { type: "END_LESSON", role: before.activeRole });

    expect(only(events, "cierre")).toMatchObject({ finalScore: expect.any(Number) });
    expect(only(events, "cierre")?.rating).not.toBeNull();
  });

  it("leaves the cierre out when the song ends without a pose", () => {
    const state = advanceTo(readyGame(), 15);
    const role = state.activeRole;
    const danced = applyOk(state, { type: "END_DANCE", role, callId: null });
    const { events } = step(danced, { type: "END_LESSON", role });

    expect(kinds(events)).not.toContain("cierre");
  });

  it("says nothing across a reset turn, in the dance step or after the 8-count ended", () => {
    const stood = callStands("call_001");
    let state = danceMove(stood.state);
    state = applyOk(state, {
      type: "PLAY_FLOURISH",
      role: "follow",
      flourishInstanceId: held(state, "follow", "flo_003"),
    });
    const midDance = step(state, { type: "UNDO_TURN", role: "follow" });
    expect(midDance.events).toEqual([]);

    const answered = applyOk(state, { type: "END_DANCE", role: "follow", callId: "call_001" });
    const rewound = step(answered, { type: "UNDO_TURN", role: "follow" });
    expect(rewound.events).toEqual([]);
    // The reset put the call back over the Follow: the dance, not the cue, carries on.
    expect(rewound.state.call?.callId).toBe("call_001");
  });

  it("reads the same moments for both roles, down to the Style and the sentences", () => {
    const stood = callStands("call_001");
    const danced = danceMove(stood.state);
    const after = applyOk(danced, { type: "END_DANCE", role: "follow", callId: "call_003" });
    const lead = eventsBetween(snapshotFor(danced, "lead"), snapshotFor(after, "lead"));
    const follow = eventsBetween(snapshotFor(danced, "follow"), snapshotFor(after, "follow"));

    expect(follow).toEqual(lead);
    expect(kinds(lead)).toEqual(["call-answered", "afinque-link", "call-made", "rung", "score"]);
  });

  it("reports the viewer's own practice money, the one moment the roles read apart", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead", callId: null });
    // The Follow's 8-count begins, so the Follow's practice money — and only theirs — moves.
    const next = applyOk(state, { type: "END_LESSON", role: "lead" });
    const lead = eventsBetween(snapshotFor(state, "lead"), snapshotFor(next, "lead"));
    const follow = eventsBetween(snapshotFor(state, "follow"), snapshotFor(next, "follow"));

    expect(only(follow, "practice-money")?.money).toBe(content.rules.incomePerTurn);
    expect(only(lead, "practice-money")).toBeUndefined();
    expect(sharedPart(follow)).toEqual(sharedPart(lead));
  });
});

/** Enough of an AudioContext to count cues, as the e2e suite's fake does. */
function fakeAudio(): { starts: () => number } {
  let starts = 0;
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const node = () => ({ connect: (destination: unknown) => destination });
  const source = () => ({
    ...node(),
    start() {
      starts += 1;
    },
    stop() {},
  });

  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 1_000;
    state = "running";
    destination = node();
    createGain = () => ({ ...node(), gain: { ...parameter, value: 1 } });
    createOscillator = () => ({ ...source(), type: "sine", frequency: parameter });
    createBuffer = (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    });
    createBufferSource = () => ({ ...source(), buffer: null });
    createBiquadFilter = () => ({
      ...node(),
      type: "bandpass",
      frequency: parameter,
      Q: parameter,
    });
    resume = () => Promise.resolve();
    close = () => Promise.resolve();
  }

  Object.assign(globalThis, { AudioContext: FakeAudioContext });
  return { starts: () => starts };
}

describe("the cue layer", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  let audio: { starts: () => number };

  beforeEach(() => {
    audio = fakeAudio();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    document.body.replaceChildren();
  });

  const show = async (view: PlayerSnapshot | null) => {
    await act(async () => {
      root?.render(
        createElement(SoundEffectsProvider, null, createElement(SnapshotCues, { view })),
      );
    });
  };

  it("holds its tongue on the first snapshot, then cues the moment and its run", async () => {
    const { before, after } = thirdAnswerInARow();
    await show(snapshotFor(before, "follow"));
    expect(host.querySelectorAll(".snapshot-cues .cue")).toHaveLength(0);
    expect(audio.starts()).toBe(0);

    await show(snapshotFor(after, "follow"));
    const cues = host.querySelectorAll(".snapshot-cues .cue");
    expect(cues).toHaveLength(2);
    expect(cues[0]?.textContent).toContain("¡Eso! Stay with me answered");
    expect(cues[1]?.textContent).toContain("Afinque ×3");
    expect(audio.starts()).toBeGreaterThan(0);
  });

  it("announces the moment once, out of the way of the hand and of any click", async () => {
    const { before, after } = thirdAnswerInARow();
    await show(snapshotFor(before, "lead"));
    await show(snapshotFor(after, "lead"));

    const live = host.querySelector("[role='status']");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toContain("answered Stay with me");
    expect(live?.textContent).toContain("Afinque 3 links");
    // The marks themselves are decoration: the live line is what is read out.
    expect(host.querySelector(".snapshot-cues ul")?.getAttribute("aria-hidden")).toBe("true");

    const sounds = audio.starts();
    await show(snapshotFor(after, "lead"));
    expect(audio.starts()).toBe(sounds);
    expect(host.querySelectorAll(".snapshot-cues .cue")).toHaveLength(2);
  });

  /** A call stands over the Follow, who clears it with a Recovery card instead of answering. */
  const covered = () => {
    const stood = callStands("call_005");
    setHand(stood.state, "follow", ["rec_001", "mov_002"]);
    return {
      before: stood.state,
      after: applyOk(stood.state, {
        type: "COVER_CALL",
        role: "follow",
        recoveryInstanceId: held(stood.state, "follow", "rec_001"),
      }),
    };
  };

  it("tells the dancer who covered the call in their own words", async () => {
    const { before, after } = covered();
    await show(snapshotFor(before, "follow"));
    await show(snapshotFor(after, "follow"));

    expect(host.querySelector("[role='status']")?.textContent).toBe(
      `You covered ${nameOf("call_005")}.`,
    );
  });

  it("tells the other dancer whose save it was", async () => {
    const { before, after } = covered();
    await show(snapshotFor(before, "lead"));
    await show(snapshotFor(after, "lead"));

    expect(host.querySelector("[role='status']")?.textContent).toBe(
      `The Follow covered ${nameOf("call_005")}.`,
    );
  });

  it("cues the last moment of the song, and cues it only once", async () => {
    const { before, after } = finishedOnAPose();
    await show(snapshotFor(before, "lead"));
    expect(host.querySelectorAll(".snapshot-cues .cue")).toHaveLength(0);

    await show(snapshotFor(after, "lead"));
    expect(after.status).toBe("completed");
    const cues = [...host.querySelectorAll(".snapshot-cues .cue")].map((node) => node.textContent);
    expect(cues.join(" ")).toContain("¡Cierre!");
    const sounds = audio.starts();
    expect(sounds).toBeGreaterThan(0);

    // The end screen re-renders over the top of the cue; the song does not end twice.
    await show(snapshotFor(after, "lead"));
    expect(audio.starts()).toBe(sounds);
    expect(host.querySelectorAll(".snapshot-cues .cue")).toHaveLength(cues.length);
  });

  it("holds its tongue when a finished song is reloaded", async () => {
    const { after } = finishedOnAPose();
    await show(snapshotFor(after, "lead"));

    expect(host.querySelectorAll(".snapshot-cues .cue")).toHaveLength(0);
    expect(host.querySelector("[role='status']")?.textContent).toBe("");
    expect(audio.starts()).toBe(0);
  });
});
