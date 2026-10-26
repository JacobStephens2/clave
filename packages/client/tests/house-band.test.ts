// @vitest-environment happy-dom
import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  snapshotFor,
  type GameState,
  type PlayerSnapshot,
} from "@clave/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BAND_GAIN,
  FADE_SECONDS,
  LOOPS,
  MUSIC_KEY,
  bandState,
  createHouseBand,
  cueFor,
  equalPowerCurve,
  rememberMusicPreference,
  savedMusicPreference,
} from "../src/house-band.js";
import { FakeAudioContext, asAudioContext, installLocalStorage } from "./fake-audio.js";

const buffers = {
  cuerpo: { duration: 53.06 } as AudioBuffer,
  montuno: { duration: 74.54 } as AudioBuffer,
};

function applyOk(state: GameState, role: "lead" | "follow"): GameState {
  const result = applyAction(state, { type: "CONFIRM_HAND", role }, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** A real game, dealt and confirmed, at the top of the cuerpo. */
function playingView(): PlayerSnapshot {
  const state = applyOk(applyOk(createGame({ seed: 42, content }), "lead"), "follow");
  return snapshotFor(state, "lead", content);
}

/** The same game once the song reaches the montuno: the card the engine deals there. */
function montunoView(): PlayerSnapshot {
  const card = content.song.cards.find((song) => song.section === "Montuno");
  return { ...playingView(), currentSong: card ?? null };
}

describe("the cue a snapshot asks for", () => {
  it("plays nothing without a dance, so the home screen stays quiet", () => {
    expect(cueFor(null)).toBeNull();
  });

  it("opens with the cuerpo through setup and the first phrase", () => {
    const setup = snapshotFor(createGame({ seed: 42, content }), "lead", content);
    expect(setup.status).toBe("setup");
    expect(cueFor(setup)).toBe("cuerpo");
    expect(cueFor(playingView())).toBe("cuerpo");
  });

  it("swaps to the montuno when the song card changes section", () => {
    expect(montunoView().currentSong?.section).toBe("Montuno");
    expect(cueFor(montunoView())).toBe("montuno");
  });

  it("stops when the dance is over, whichever way it ended", () => {
    const view = playingView();
    for (const status of ["completed", "lost", "unresumable"] as const) {
      expect(cueFor({ ...view, status })).toBeNull();
    }
  });
});

describe("what the drawer says about the band", () => {
  const reading = { enabled: true, failed: false, wanted: null, playing: null } as const;

  it("reads off the preference, the dance and what is actually sounding", () => {
    expect(bandState({ ...reading, enabled: false, wanted: "cuerpo" })).toBe("off");
    expect(bandState({ ...reading })).toBe("idle");
    expect(bandState({ ...reading, wanted: "cuerpo" })).toBe("loading");
    expect(bandState({ ...reading, wanted: "cuerpo", playing: "cuerpo" })).toBe("playing");
    expect(bandState({ ...reading, failed: true, wanted: "cuerpo" })).toBe("failed");
    // A failure while the band is off is nothing to report: the drawer offers it again.
    expect(bandState({ ...reading, enabled: false, failed: true })).toBe("off");
  });
});

describe("the music preference", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is off until this device says otherwise", () => {
    expect(savedMusicPreference()).toBe(false);
    rememberMusicPreference(true);
    expect(storage.getItem(MUSIC_KEY)).toBe("on");
    expect(savedMusicPreference()).toBe(true);
    rememberMusicPreference(false);
    expect(storage.getItem(MUSIC_KEY)).toBe("off");
    expect(savedMusicPreference()).toBe(false);
  });

  it("survives storage that refuses to answer", () => {
    const blocked = () => {
      throw new Error("storage is blocked");
    };
    vi.spyOn(storage, "getItem").mockImplementation(blocked);
    vi.spyOn(storage, "setItem").mockImplementation(blocked);
    expect(savedMusicPreference()).toBe(false);
    expect(() => rememberMusicPreference(true)).not.toThrow();
  });
});

describe("the fade curve", () => {
  it("starts and ends where it was asked to", () => {
    expect(equalPowerCurve(0, 1).at(0)).toBe(0);
    expect(equalPowerCurve(0, 1).at(-1)).toBe(1);
    expect(equalPowerCurve(1, 0).at(0)).toBe(1);
    expect(equalPowerCurve(1, 0).at(-1)).toBe(0);
  });

  it("holds the level steady across a crossfade, which two straight lines would not", () => {
    const up = equalPowerCurve(0, 1, 33);
    const down = equalPowerCurve(1, 0, 33);
    for (let index = 0; index < up.length; index += 1) {
      const rising = up[index] ?? 0;
      const falling = down[index] ?? 0;
      expect(rising * rising + falling * falling).toBeCloseTo(1, 6);
    }
    // Halfway through, both voices are up at 0.707: a linear pair would sum to 1 and dip.
    expect((up[16] ?? 0) + (down[16] ?? 0)).toBeCloseTo(Math.SQRT2, 6);
  });
});

describe("the band on one audio context", () => {
  it("sits under the game's own cues", () => {
    const context = new FakeAudioContext();
    createHouseBand(asAudioContext(context));
    expect(context.gains[0]?.gain.value).toBe(BAND_GAIN);
    expect(context.gains[0]?.connectedTo).toBe(context.destination);
  });

  it("starts a loop at the loop body and leaves it looping there", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);

    const source = context.sources[0];
    expect(source?.buffer).toBe(buffers.cuerpo);
    expect(source?.loop).toBe(true);
    expect(source?.loopStart).toBe(LOOPS.cuerpo.loopStart);
    expect(source?.loopEnd).toBe(LOOPS.cuerpo.loopEnd);
    expect(source?.startedAt).toBe(0);
    expect(source?.startedFrom).toBe(LOOPS.cuerpo.loopStart);
    expect(band.playing()).toBe("cuerpo");

    const voice = context.gains[1];
    expect(voice?.gain.ramps).toEqual([
      { curve: [...equalPowerCurve(0, 1)], start: 0, seconds: FADE_SECONDS.in },
    ]);
    expect(source?.connectedTo).toBe(voice);
    expect(voice?.connectedTo).toBe(context.gains[0]);
  });

  it("asks nothing of the band when the cue has not changed", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);
    band.play("cuerpo", buffers.cuerpo);
    expect(context.sources).toHaveLength(1);
  });

  it("crossfades the montuno in over the cuerpo going out", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);
    context.currentTime = 12;
    band.play("montuno", buffers.montuno);

    expect(band.playing()).toBe("montuno");
    const [, leaving, arriving] = context.gains;
    expect(leaving?.gain.ramps.at(-1)).toEqual({
      curve: [...equalPowerCurve(1, 0)],
      start: 12,
      seconds: FADE_SECONDS.cross,
    });
    expect(arriving?.gain.ramps).toEqual([
      { curve: [...equalPowerCurve(0, 1)], start: 12, seconds: FADE_SECONDS.cross },
    ]);
    // The cuerpo is let go of once it is inaudible, not while it is still fading.
    expect(context.sources[0]?.stoppedAt).toBeGreaterThan(12 + FADE_SECONDS.cross);
    expect(context.sources[1]?.loopEnd).toBe(LOOPS.montuno.loopEnd);
    expect(context.sources[1]?.startedFrom).toBe(LOOPS.montuno.loopStart);
  });

  it("fades out over the time it is given and lets the voice go", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);
    context.currentTime = 30;
    band.stop(FADE_SECONDS.off);

    expect(band.playing()).toBeNull();
    expect(context.gains[1]?.gain.ramps.at(-1)).toEqual({
      curve: [...equalPowerCurve(1, 0)],
      start: 30,
      seconds: FADE_SECONDS.off,
    });
    expect(context.sources[0]?.stoppedAt).toBeCloseTo(30 + FADE_SECONDS.off + 0.05, 6);
    // Stopping twice is the end screen arriving after the player switched it off.
    expect(() => band.stop(FADE_SECONDS.out)).not.toThrow();
    expect(context.sources).toHaveLength(1);
  });

  it("cuts off and lets go of the graph when the context is closing", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);
    // Halfway through the fade-in, where a browser refuses a plain write to the gain.
    context.currentTime = FADE_SECONDS.in / 2;
    band.dispose();

    expect(band.playing()).toBeNull();
    expect(context.sources[0]?.stoppedAt).toBe(0);
    expect(context.gains[0]?.disconnected).toBe(true);
  });

  it("closes cleanly in the middle of a crossfade", () => {
    const context = new FakeAudioContext();
    const band = createHouseBand(asAudioContext(context));
    band.play("cuerpo", buffers.cuerpo);
    context.currentTime = 12;
    band.play("montuno", buffers.montuno);
    context.currentTime = 12 + FADE_SECONDS.cross / 2;

    expect(() => band.dispose()).not.toThrow();
    expect(context.sources[1]?.stoppedAt).toBe(0);
    expect(context.gains[0]?.disconnected).toBe(true);
  });
});
