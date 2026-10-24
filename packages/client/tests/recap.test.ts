import { readFileSync } from "node:fs";
import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  legalActions,
  snapshotFor,
  type GameAction,
  type GameState,
  type PlayerSnapshot,
} from "@clave/engine";
import { describe, expect, it } from "vitest";
import { readSongRecap, type SongRecap } from "../src/recap.js";
import { LADDER_RUNGS } from "../src/rungs.js";

/** The engine's own replays of whole games: the cheapest way to a real terminal snapshot. */
interface GoldenReplay {
  id: string;
  seed: number;
  ending: string;
  actions: GameAction[];
}

const replays = JSON.parse(
  readFileSync(new URL("../../engine/fixtures/golden-replays.json", import.meta.url), "utf8"),
) as GoldenReplay[];

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function replayed(id: string): GameState {
  const replay = replays.find((entry) => entry.id === id);
  if (!replay) throw new Error(`No golden replay ${id}. Regenerate with npm run golden:write.`);
  let state = createGame({ seed: replay.seed, content });
  for (const action of replay.actions) {
    const result = applyAction(state, action, content);
    if (!result.ok)
      throw new Error(
        `Golden replay ${id} no longer replays (${result.error.code}). Regenerate with npm run golden:write.`,
      );
    state = result.state;
  }
  return state;
}

const viewOf = (state: GameState, role: "lead" | "follow" = "lead") =>
  snapshotFor(state, role, content);

function recapOf(view: PlayerSnapshot): SongRecap {
  const recap = readSongRecap(view);
  if (!recap) throw new Error(`A ${view.status} snapshot has no recap.`);
  return recap;
}

/** How many log lines of a finished game say a given thing, in the engine's own words. */
const logLines = (view: PlayerSnapshot, says: (message: string) => boolean) =>
  view.log.filter((entry) => entry.kind === "call" && says(entry.message)).length;

const tallyFor = (recap: SongRecap, rung: string) =>
  recap.ladder.find((entry) => entry.rung === rung)?.count ?? -1;

describe("a song danced all the way through", () => {
  const view = viewOf(replayed("call-and-answer-606"));
  const recap = recapOf(view);

  it("leads with the whole song and the rating it earned", () => {
    expect(recap.outcome).toBe("completed");
    expect(recap.eyebrow).toBe("You danced the whole song");
    expect(recap.headline).toBe(view.rating?.name);
    expect(recap.blurb).toBe(view.rating?.description);
    const band = [...view.rules.ratings]
      .sort((left, right) => left.minimum - right.minimum)
      .findIndex((rating) => rating.name === view.rating?.name);
    expect(recap.rating?.place).toBe(`Rating ${band + 1} of ${view.rules.ratings.length}`);
    expect(recap.illustration.src).toBe("/art/finale-complete.webp");
    expect(recap.illustration.alt).toMatch(/couple/);
    expect(recap.endedOn).toBeNull();
    expect(recap.announcement).toContain(String(view.finalScore));
  });

  it("tallies every rung of the ladder, keeping the empty ones", () => {
    expect(recap.ladder.map((entry) => entry.rung)).toEqual([...LADDER_RUNGS]);
    expect(recap.ladder.reduce((total, entry) => total + entry.count, 0)).toBe(recap.countsDanced);
    expect(recap.countsDanced).toBe(view.rules.songLength);
    for (const rung of LADDER_RUNGS)
      expect(tallyFor(recap, rung)).toBe(
        view.danceHistory.filter((entry) => entry.rung === rung).length,
      );
    // The tallest rung fills its bar; every other one is read from the same count.
    expect(Math.max(...recap.ladder.map((entry) => entry.share))).toBe(1);
    expect(recap.ladder.every((entry) => entry.label.length > 0 && entry.meaning.length > 0)).toBe(
      true,
    );
  });

  it("breaks the score into lines that add up to it", () => {
    expect(recap.score).toBe(view.finalScore);
    expect(recap.breakdown.reduce((total, line) => total + line.value, 0)).toBe(recap.score);
    expect(recap.style).toBe(view.shared.style);
    expect(recap.connection).toBe(view.shared.connection);
  });

  it("splits the Style the two phrases earned and quotes their scoring", () => {
    expect(recap.phrases.map((phrase) => phrase.name)).toEqual(["Cuerpo", "Montuno"]);
    for (const phrase of recap.phrases) expect(phrase.counts).toBe(view.rules.phraseLength);
    const danced = recap.phrases.reduce((total, phrase) => total + phrase.style, 0);
    const [counts, bonuses] = recap.breakdown;
    expect(counts?.value).toBe(danced);
    expect(danced + (bonuses?.value ?? 0)).toBe(view.shared.style);
    // The phrase line is the game's own sentence, with its own numbers, minus the prefix.
    const scored = view.log.find((entry) => entry.message.startsWith("Phrase 1: "));
    expect(recap.phrases[0]?.bonuses).toBe(
      scored?.message.slice("Phrase 1: ".length).replace(/\.$/, ""),
    );
    expect(recap.phrases[0]?.bonuses).toMatch(/\+\d/);
  });

  it("counts the calls the same way the dance log tells them", () => {
    const calls = recap.calls;
    expect(calls).not.toBeNull();
    expect(calls?.made).toBe(logLines(view, (message) => / calls /.test(message)));
    expect(calls?.answered).toBe(logLines(view, (message) => / answers /.test(message)));
    expect(calls?.covered).toBe(logLines(view, (message) => / covers /.test(message)));
    expect(calls?.dropped).toBe(logLines(view, (message) => message.startsWith("The call drops")));
    // Every call made stands over one 8-count, so no more can resolve than were made; a call
    // made as the song's last 8-count ends never stands over anything and resolves nowhere.
    expect(
      (calls?.answered ?? 0) + (calls?.covered ?? 0) + (calls?.dropped ?? 0),
    ).toBeLessThanOrEqual(calls?.made ?? 0);
    expect(calls?.answered).toBe(tallyFor(recap, "perfect"));
    expect(calls?.covered).toBe(tallyFor(recap, "recovered"));
    expect(calls?.longestRun).toBe(
      Math.max(...view.danceHistory.map((entry) => entry.afinqueAfter)),
    );
    expect(calls?.runCap).toBe(view.afinque.cap);
  });

  it("picks the 8-count that paid the most Style", () => {
    const best = Math.max(...view.danceHistory.map((entry) => entry.styleGained));
    expect(recap.highlight?.entry.styleGained).toBe(best);
    expect(recap.highlight?.songCount).toBe(
      (recap.highlight!.entry.phrase - 1) * view.rules.phraseLength + recap.highlight!.entry.count,
    );
  });

  it("reads the same for both dancers", () => {
    expect(readSongRecap(viewOf(replayed("call-and-answer-606"), "follow"))).toEqual(recap);
  });

  it("counts the song-card bonuses that landed", () => {
    expect(recap.songMoments).toBe(
      view.log.filter((entry) => entry.kind === "score" && entry.role !== null).length,
    );
  });
});

describe("a song danced on the basic", () => {
  const view = viewOf(replayed("basic-101"));
  const recap = recapOf(view);

  it("ends every 8-count on Awkward without calling it a failure", () => {
    expect(tallyFor(recap, "awkward")).toBe(view.rules.songLength);
    expect(recap.ladder.filter((entry) => entry.count > 0)).toHaveLength(1);
    expect(recap.highlight).toBeNull();
  });

  it("credits the whole score to the phrase bonuses", () => {
    expect(recap.breakdown[0]?.value).toBe(0);
    expect(recap.breakdown[1]?.value).toBe(view.shared.style);
    expect(recap.phrases.every((phrase) => phrase.style === 0)).toBe(true);
    expect(recap.phrases[0]?.bonuses).toMatch(/^clean \+\d+$/);
  });

  it("reports a song where nobody called", () => {
    expect(recap.calls).toEqual({
      made: 0,
      answered: 0,
      covered: 0,
      dropped: 0,
      longestRun: 0,
      runCap: view.afinque.cap,
    });
    expect(recap.songMoments).toBe(
      view.log.filter((entry) => entry.kind === "score" && entry.role !== null).length,
    );
  });
});

describe("a dance that lost the connection", () => {
  const view = viewOf(replayed("connection-loss-404"));
  const recap = recapOf(view);

  it("says which 8-count it slipped on, and that it is part of the dance", () => {
    const last = view.danceHistory.at(-1)!;
    const expected = (last.phrase - 1) * view.rules.phraseLength + last.count;
    expect(recap.outcome).toBe("lost");
    expect(recap.endedOn).toBe(expected);
    expect(recap.eyebrow).toBe(
      `The connection slipped on 8-count ${expected} of ${view.rules.songLength}`,
    );
    expect(recap.headline).toBe("The dance ends here");
    expect(recap.blurb).toMatch(/part of the dance/);
    expect(recap.illustration.src).toBe("/art/finale-lost.webp");
  });

  it("scores the Style they kept and no Connection", () => {
    expect(recap.rating).toBeNull();
    expect(recap.connection).toBe(0);
    expect(recap.score).toBe(view.shared.style);
    expect(recap.breakdown.reduce((total, line) => total + line.value, 0)).toBe(recap.score);
    expect(recap.breakdown[2]?.detail).toBe("it ran out");
  });
});

describe("snapshots with nothing to recap", () => {
  it("has no recap while the dance is still going", () => {
    let state = createGame({ seed: 7, content });
    expect(readSongRecap(viewOf(state))).toBeNull();
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    expect(readSongRecap(viewOf(state))).toBeNull();
  });

  it("leaves a saved game this release cannot read to its own screen", () => {
    const view = viewOf(replayed("basic-101"));
    expect(readSongRecap({ ...view, status: "unresumable" })).toBeNull();
  });
});

describe("a game stored before the call", () => {
  it("recaps the score without a call tally", () => {
    const rules = { ...content.rules };
    delete rules.call;
    const recap = recapOf(snapshotFor(replayed("basic-101"), "lead", { ...content, rules }));
    expect(recap.calls).toBeNull();
    expect(recap.score).toBeGreaterThan(0);
  });
});

describe("a published log the call tally no longer reads", () => {
  it("counts every call from the 8-counts themselves, log or no log", () => {
    const view = viewOf(replayed("call-and-answer-606"));
    const full = recapOf(view);
    // The worst a window can do: a long song, a reconnect, a release that trims the log.
    const recap = recapOf({ ...view, log: [] } satisfies PlayerSnapshot);
    expect(recap.calls).toEqual(full.calls);
    expect(full.calls?.made).toBeGreaterThan(0);
    // The phrase sentence is the game's own words, and only those are the log's to lose.
    expect(recap.phrases[0]?.bonuses).toBeNull();
    expect(full.phrases[0]?.bonuses).toMatch(/\+\d/);
  });

  it("counts the song-card bonuses from the 8-counts they paid", () => {
    const view = viewOf(replayed("basic-101"));
    const landed = view.log.filter((entry) => entry.kind === "score" && entry.role !== null).length;
    expect(landed).toBeGreaterThan(0);
    expect(recapOf(view).songMoments).toBe(landed);
    expect(recapOf({ ...view, log: [] } satisfies PlayerSnapshot).songMoments).toBe(landed);
  });
});

describe("a call a stumble dropped", () => {
  it("counts the call and the drop the log never names", () => {
    let state = createGame({ seed: 606, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    const opening = legalActions(state, "lead", content).find(
      (action) => action.type === "PLAY_OPEN",
    );
    state = applyOk(state, opening!);
    state = applyOk(state, { type: "END_DANCE", role: "lead", callId: "call_007" });
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    // The Follow stumbles with the call standing: it drops with the stumble, for free, and
    // the engine logs the stumble alone — there is no "The call drops" line to count.
    state = applyOk(state, { type: "STUMBLE", role: "follow", recoveryInstanceId: null });
    while (state.status === "playing") {
      const role = state.activeRole;
      state = applyOk(state, { type: "END_LESSON", role });
      if (state.status !== "playing") break;
      state = applyOk(state, { type: "END_DANCE", role: state.activeRole, callId: null });
    }
    const view = viewOf(state);
    expect(logLines(view, (message) => message.startsWith("The call drops"))).toBe(0);
    expect(view.danceHistory[1]).toMatchObject({ rung: "break", callOutcome: "dropped" });

    const recap = recapOf(view);
    expect(recap.calls?.made).toBe(1);
    expect(recap.calls?.dropped).toBe(1);
    expect(recap.calls?.answered).toBe(0);
    expect(recap.calls?.covered).toBe(0);
  });
});

describe("a turn the couple reset", () => {
  it("counts the dropped call once, not once per attempt", () => {
    let state = createGame({ seed: 606, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    const opening = legalActions(state, "lead", content).find(
      (action) => action.type === "PLAY_OPEN",
    );
    state = applyOk(state, opening!);
    // "Show me something" asks for a Move worth 3 Style, which no starter hand can answer.
    state = applyOk(state, { type: "END_DANCE", role: "lead", callId: "call_007" });
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    state = applyOk(state, { type: "END_DANCE", role: "follow", callId: null });
    expect(state.shared.connection).toBe(3);
    state = applyOk(state, { type: "UNDO_TURN", role: "follow" });
    expect(state.shared.connection).toBe(4);
    state = applyOk(state, { type: "END_DANCE", role: "follow", callId: null });
    while (state.status === "playing") {
      const role = state.activeRole;
      state = applyOk(state, { type: "END_LESSON", role });
      if (state.status !== "playing") break;
      state = applyOk(state, { type: "END_DANCE", role: state.activeRole, callId: null });
    }
    const view = viewOf(state);
    expect(logLines(view, (message) => message.startsWith("The call drops"))).toBe(2);
    expect(recapOf(view).calls?.dropped).toBe(1);
    expect(recapOf(view).calls?.made).toBe(1);
  });
});
