import { content, type SongCard } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction, createGame, readSongPlace, snapshotFor } from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

const MONTUNO_LOG = "The montuno begins. Advanced lessons are now open.";

const shipped = content.song.cards;

describe("song reading", () => {
  it("reads Llorarás as 16 8-counts, phrase length 8, Cuerpo then Montuno, with no count before the first card", () => {
    expect(readSongPlace(shipped, -1)).toEqual({
      songLength: 16,
      phraseLength: 8,
      phrases: [
        { number: 1, section: "Cuerpo" },
        { number: 2, section: "Montuno" },
      ],
      at: null,
    });
  });

  it("places index 0 on count 1 of the Cuerpo", () => {
    expect(readSongPlace(shipped, 0).at).toEqual({
      phraseNumber: 1,
      count: 1,
      section: "Cuerpo",
      phraseEnded: false,
      songEnded: false,
    });
  });

  it("places index 7 on count 8, ending the Cuerpo without ending the song", () => {
    expect(readSongPlace(shipped, 7).at).toEqual({
      phraseNumber: 1,
      count: 8,
      section: "Cuerpo",
      phraseEnded: true,
      songEnded: false,
    });
  });

  it("places index 8 on count 1 of the Montuno without ending the phrase", () => {
    expect(readSongPlace(shipped, 8).at).toEqual({
      phraseNumber: 2,
      count: 1,
      section: "Montuno",
      phraseEnded: false,
      songEnded: false,
    });
  });

  it("places index 15 on count 8, ending the Montuno and the song", () => {
    expect(readSongPlace(shipped, 15).at).toEqual({
      phraseNumber: 2,
      count: 8,
      section: "Montuno",
      phraseEnded: true,
      songEnded: true,
    });
  });

  it("rejects a song that is not eight Cuerpo cards followed by eight Montuno cards", () => {
    const swapped: SongCard[] = shipped.map((card) => ({ ...card }));
    swapped[0] = { ...swapped[0]!, section: "Montuno" };
    const longer: SongCard[] = [
      ...shipped.slice(0, 8),
      ...shipped.slice(0, 2),
      ...shipped.slice(8),
      ...shipped.slice(8, 10),
    ];
    expect(() => readSongPlace(swapped, -1)).toThrow(
      "A song must be eight Cuerpo cards followed by eight Montuno cards.",
    );
    expect(() => readSongPlace(longer, -1)).toThrow(
      "A song must be eight Cuerpo cards followed by eight Montuno cards.",
    );
  });

  it("publishes the reading's phrase length, count, and phrase names on the snapshot", () => {
    const opening = createGame({ seed: 42, content });
    const before = readSongPlace(shipped, opening.songIndex);
    let view = snapshotFor(opening, "lead", content);
    expect(before.at).toBeNull();
    expect(view.rules.songLength).toBe(before.songLength);
    expect(view.rules.phraseLength).toBe(before.phraseLength);
    expect(view.rules.phrases).toEqual(before.phrases);
    expect(view.phrase.count).toBe(0);

    const state = readyGame();

    for (const songIndex of [0, 7, 8, 15]) {
      state.songIndex = songIndex;
      state.danceHistory = [
        {
          sequence: 1,
          phrase: 1,
          songIndex,
          role: "lead",
          outcome: "basic",
          moveCardId: null,
          positionCardId: null,
          flourishCardId: null,
          fromPosition: "Open",
          endingPosition: "Open",
        },
      ];
      view = snapshotFor(state, "lead", content);
      const place = readSongPlace(shipped, songIndex);
      expect(view.rules.songLength).toBe(place.songLength);
      expect(view.rules.phraseLength).toBe(place.phraseLength);
      expect(view.rules.phrases).toEqual(place.phrases);
      expect(view.phrase.count).toBe(place.at?.count);
      expect(view.danceHistory[0]?.count).toBe(place.at?.count);
    }
  });
});

describe("phrase end through the song reading", () => {
  function playPose(songIndex: number): boolean {
    let state = readyGame();
    state.songIndex = songIndex;
    setHand(state, "lead", ["pos_002", "mov_013", "flo_004", "rec_001"]);
    const [closed, move, dip] = state.players.lead.hand;
    state = applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: closed!.instanceId,
      moveInstanceId: move!.instanceId,
    });
    state = applyOk(state, {
      type: "PLAY_FLOURISH",
      role: "lead",
      flourishInstanceId: dip!.instanceId,
    });
    return state.phrase.poseOnFinalCount;
  }

  it("marks a Pose on the 8th 8-count and not on the 7th", () => {
    expect(playPose(6)).toBe(false);
    expect(playPose(7)).toBe(true);
  });

  it("refuses an advanced lesson through the 8th 8-count and accepts it once the 9th has begun", () => {
    let state = readyGame();
    state.songIndex = 7;
    state.phase = "lesson";
    state.players.lead.money = 10;
    state.market.advancedDisplay = ["flo_004"];
    const refused = applyAction(
      state,
      { type: "BUY_LESSON", role: "lead", source: "advanced", cardId: "flo_004" },
      content,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("ADVANCED_CLOSED");
    expect(state.log.some((entry) => entry.message === MONTUNO_LOG)).toBe(false);

    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    expect(state.songIndex).toBe(8);
    expect(state.phrase.number).toBe(2);
    expect(state.log.some((entry) => entry.message === MONTUNO_LOG)).toBe(true);

    const role = state.activeRole;
    state = applyOk(state, { type: "END_DANCE", role });
    state.players[role].money = 10;
    const accepted = applyAction(
      state,
      { type: "BUY_LESSON", role, source: "advanced", cardId: "flo_004" },
      content,
    );
    expect(accepted.ok).toBe(true);
  });
});
