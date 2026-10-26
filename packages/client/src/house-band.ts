import type { PlayerSnapshot } from "@clave/engine";
import loops from "./house-band-loops.json" with { type: "json" };

/**
 * Clave's house band: two loops made for the game, one for each phrase of the song. The
 * cuerpo plays through phrase 1 and hands over to the montuno when the campana comes in —
 * the same moment the snapshot's song card changes section, so the band follows the dance
 * rather than a clock of its own.
 *
 * Each file in `public/audio/` is [pre-roll | loop body | post-roll], and
 * `house-band-loops.json` says where the body sits. A looping AudioBufferSourceNode set to
 * those edges never plays a seam; the rolls are there for a decoder that trims or keeps a
 * few samples of its own.
 */

/** The two cues the band knows, named after the phrases they belong to. */
export type HouseBandCue = "cuerpo" | "montuno";

export interface HouseBandLoop {
  /** The loop as the client serves it, from `public/audio/`. */
  readonly file: string;
  /** The loop body's edges in the file, in seconds. */
  readonly loopStart: number;
  readonly loopEnd: number;
  /** The loop's own average tempo, and the whole number of bars that makes it exact. */
  readonly bpm: number;
  readonly bars: number;
}

export const LOOPS: Readonly<Record<HouseBandCue, HouseBandLoop>> = loops;

export const MUSIC_KEY = "clave.music.v1";

/** The band sits under the synthesized cues, so a call still cuts through it. */
export const BAND_GAIN = 0.5;

/** Every fade the band makes, in seconds. */
export const FADE_SECONDS = {
  /** The band arriving. */
  in: 1.2,
  /** Cuerpo into montuno: long enough to be a handover rather than a cut. */
  cross: 3,
  /** The band leaving at the end of the song. */
  out: 3,
  /** The player switching it off — quicker, because they asked for quiet. */
  off: 0.8,
} as const;

/** What the band is doing: the drawer reads it as copy, a test reads it as an attribute. */
export type BandState = "off" | "idle" | "loading" | "playing" | "failed";

/** Off unless this device has been told otherwise: nobody is opted into music. */
export function savedMusicPreference(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) === "on";
  } catch {
    return false;
  }
}

export function rememberMusicPreference(enabled: boolean): void {
  try {
    localStorage.setItem(MUSIC_KEY, enabled ? "on" : "off");
  } catch {
    // The band still plays when storage is unavailable; only the preference is temporary.
  }
}

/**
 * The cue a snapshot asks for, or null for silence. Nothing plays before a dance (the home
 * screen has no snapshot at all) or after one: a finished song fades out instead of looping
 * under the end screen. In a dance the song card's own section picks the cue, which is the
 * reading `SnapshotCues` plays the campana from.
 */
export function cueFor(view: PlayerSnapshot | null): HouseBandCue | null {
  if (!view) return null;
  if (view.status !== "setup" && view.status !== "playing") return null;
  return view.currentSong?.section === "Montuno" ? "montuno" : "cuerpo";
}

/** What the drawer says about the band, from the preference and what is actually sounding. */
export function bandState(reading: {
  readonly enabled: boolean;
  readonly failed: boolean;
  readonly wanted: HouseBandCue | null;
  readonly playing: HouseBandCue | null;
}): BandState {
  if (!reading.enabled) return "off";
  if (reading.failed) return "failed";
  if (reading.playing) return "playing";
  return reading.wanted ? "loading" : "idle";
}

/**
 * A fade shaped so that two of them, run against each other, sum to a steady level: the
 * squares add up to one all the way across, which a pair of straight lines does not do.
 */
export function equalPowerCurve(from: number, to: number, steps = 64): Float32Array {
  const curve = new Float32Array(steps);
  for (let index = 0; index < steps; index += 1) {
    const through = index / (steps - 1);
    curve[index] = Math.sqrt(from * from * (1 - through) + to * to * through);
  }
  return curve;
}

export interface HouseBand {
  /** The cue the band is on, or null when it is not playing. */
  readonly playing: () => HouseBandCue | null;
  /** Takes the band to `cue`, crossfading from whatever it was playing. */
  readonly play: (cue: HouseBandCue, buffer: AudioBuffer) => void;
  /** Fades the band out over `seconds`. */
  readonly stop: (seconds: number) => void;
  /** Cuts the band off and lets go of the graph, for a context about to close. */
  readonly dispose: () => void;
}

interface Voice {
  readonly cue: HouseBandCue;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

function fade(param: AudioParam, from: number, to: number, start: number, seconds: number): void {
  param.cancelScheduledValues(start);
  param.setValueCurveAtTime(equalPowerCurve(from, to), start, seconds);
}

/** Starts, swaps and stops the loops on one AudioContext. Each cue plays on its own voice. */
export function createHouseBand(context: AudioContext): HouseBand {
  const master = context.createGain();
  master.gain.value = BAND_GAIN;
  master.connect(context.destination);
  let voice: Voice | null = null;

  /** Fades a voice out, then stops it: a stopped source releases its buffer by itself. */
  const retire = (leaving: Voice, seconds: number): void => {
    const now = context.currentTime;
    fade(leaving.gain.gain, leaving.gain.gain.value, 0, now, seconds);
    leaving.source.stop(now + seconds + 0.05);
  };

  return {
    playing: () => voice?.cue ?? null,

    play(cue, buffer) {
      if (voice?.cue === cue) return;
      const loop = LOOPS[cue];
      const now = context.currentTime;
      const seconds = voice ? FADE_SECONDS.cross : FADE_SECONDS.in;
      if (voice) retire(voice, seconds);

      const gain = context.createGain();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = loop.loopStart;
      source.loopEnd = loop.loopEnd;
      source.connect(gain).connect(master);
      fade(gain.gain, 0, 1, now, seconds);
      // In at the body, not at the pre-roll: the roll before the body is the seam again.
      source.start(now, loop.loopStart);
      voice = { cue, source, gain };
    },

    stop(seconds) {
      if (voice) retire(voice, seconds);
      voice = null;
    },

    dispose() {
      // A stop with no time is silence now. Zeroing the gain as well would throw inside a
      // fade: a browser refuses a plain write that lands in the middle of a curve.
      voice?.source.stop();
      voice = null;
      master.disconnect();
    },
  };
}

/** The loop, fetched and decoded. Decoding a minute of music takes a moment, so it is held. */
export async function loadLoop(context: AudioContext, cue: HouseBandCue): Promise<AudioBuffer> {
  const { file } = LOOPS[cue];
  const response = await fetch(file);
  if (!response.ok) throw new Error(`${file} answered ${response.status}.`);
  return await context.decodeAudioData(await response.arrayBuffer());
}
