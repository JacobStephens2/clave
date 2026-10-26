import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const SOUND_EFFECTS_KEY = "clave.soundEffects.v1";

export type SoundEffect =
  | "card-select"
  | "card-position"
  | "card-move"
  | "card-flourish"
  | "discard"
  | "lesson"
  | "stumble"
  | "success"
  | "turn"
  | "undo"
  // The call and the answer: the moments the snapshot differ reads off a new snapshot.
  | "call"
  | "answer"
  | "drop"
  | "cover"
  | "afinque-break"
  | "perfect"
  | "montuno"
  | "cierre";

/** How a cue is coloured. Today only the answer, which rises with the run behind it. */
export interface SoundEffectOptions {
  /** The afinque links an answer lands on: each one lifts the response a semitone. */
  readonly links?: number;
}

interface SoundEffectsContextValue {
  enabled: boolean;
  play: (effect: SoundEffect, options?: SoundEffectOptions) => void;
  toggleEnabled: () => void;
}

const SoundEffectsContext = createContext<SoundEffectsContextValue | null>(null);
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function savedPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_EFFECTS_KEY) !== "off";
  } catch {
    return true;
  }
}

function rememberPreference(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_EFFECTS_KEY, enabled ? "on" : "off");
  } catch {
    // Sound still works when storage is unavailable; only the preference is temporary.
  }
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.45), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let state = 0x6d2b79f5;
  for (let index = 0; index < samples.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    samples[index] = ((state >>> 0) / 0xffff_ffff) * 2 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

function tone(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "triangle",
  endFrequency = frequency,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.008, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function paper(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  volume: number,
  frequency = 1_900,
): void {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noiseBuffer(context);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(0.8, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function clave(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  pitch = 1_180,
  volume = 0.055,
): void {
  tone(context, destination, start, pitch, 0.045, volume, "triangle", pitch * 0.72);
  tone(context, destination, start, pitch * 2.04, 0.018, volume * 0.32, "sine");
}

/** One strike of the campana: the bell's mouth rings high, its body low. */
function campana(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  mouth: boolean,
  volume = 0.03,
): void {
  const pitch = mouth ? 1_050 : 790;
  tone(context, destination, start, pitch, 0.07, volume, "square");
  tone(context, destination, start, pitch * 1.45, 0.045, volume * 0.5, "square");
}

/** A semitone lift per link, so a long run of answers climbs. Four steps, then it holds. */
function afinqueLift(links: number | undefined): number {
  return 2 ** (Math.min(Math.max((links ?? 1) - 1, 0), 4) / 12);
}

function renderEffect(
  context: AudioContext,
  effect: SoundEffect,
  options: SoundEffectOptions = {},
): void {
  const master = context.createGain();
  master.gain.value = 0.72;
  master.connect(context.destination);
  const now = context.currentTime + 0.006;
  const lift = afinqueLift(options.links);

  switch (effect) {
    case "card-select":
      paper(context, master, now, 0.035, 0.018, 2_800);
      clave(context, master, now + 0.012, 1_350, 0.038);
      break;
    case "card-position":
      paper(context, master, now, 0.18, 0.062, 1_150);
      tone(context, master, now + 0.075, 190, 0.11, 0.052, "triangle", 115);
      clave(context, master, now + 0.1, 780, 0.046);
      break;
    case "card-move":
      paper(context, master, now, 0.17, 0.056, 1_850);
      clave(context, master, now + 0.055, 1_180, 0.072);
      clave(context, master, now + 0.14, 1_480, 0.046);
      break;
    case "card-flourish":
      paper(context, master, now, 0.15, 0.05, 2_400);
      tone(context, master, now + 0.035, 520, 0.18, 0.044, "sine", 820);
      clave(context, master, now + 0.12, 1_620, 0.056);
      break;
    case "discard":
      paper(context, master, now, 0.23, 0.045, 1_350);
      tone(context, master, now + 0.17, 260, 0.09, 0.035, "triangle", 150);
      break;
    case "lesson":
      clave(context, master, now, 1_280, 0.04);
      tone(context, master, now + 0.04, 523, 0.16, 0.034, "sine");
      tone(context, master, now + 0.1, 659, 0.17, 0.032, "sine");
      tone(context, master, now + 0.16, 784, 0.19, 0.03, "sine");
      break;
    case "stumble":
      paper(context, master, now, 0.18, 0.042, 760);
      tone(context, master, now + 0.02, 230, 0.2, 0.05, "sawtooth", 105);
      break;
    case "success":
      clave(context, master, now, 1_200, 0.05);
      clave(context, master, now + 0.1, 1_450, 0.05);
      tone(context, master, now + 0.08, 523, 0.32, 0.036, "sine");
      tone(context, master, now + 0.16, 659, 0.31, 0.034, "sine");
      tone(context, master, now + 0.24, 784, 0.3, 0.032, "sine");
      break;
    case "turn":
      clave(context, master, now, 1_200, 0.05);
      clave(context, master, now + 0.13, 920, 0.05);
      break;
    case "undo":
      tone(context, master, now, 620, 0.08, 0.028, "triangle", 440);
      tone(context, master, now + 0.07, 440, 0.1, 0.026, "triangle", 310);
      break;
    // Two notes rising, like a voice asking for something.
    case "call":
      clave(context, master, now, 1_250, 0.04);
      tone(context, master, now + 0.01, 587, 0.1, 0.032, "sine");
      tone(context, master, now + 0.09, 784, 0.15, 0.03, "sine");
      break;
    // The answer comes back bright, and a step higher for every link in the run.
    case "answer":
      clave(context, master, now, 1_480 * lift, 0.048);
      tone(context, master, now + 0.02, 784 * lift, 0.15, 0.034, "sine");
      tone(context, master, now + 0.1, 988 * lift, 0.2, 0.03, "sine");
      break;
    // Gentle on the way down: a dropped call is part of the dance, not a buzzer.
    case "drop":
      paper(context, master, now, 0.12, 0.026, 900);
      tone(context, master, now, 440, 0.16, 0.03, "triangle", 300);
      tone(context, master, now + 0.1, 330, 0.18, 0.026, "triangle", 220);
      break;
    case "cover":
      paper(context, master, now, 0.1, 0.02, 1_500);
      tone(context, master, now + 0.03, 392, 0.2, 0.026, "sine", 523);
      break;
    case "afinque-break":
      clave(context, master, now, 900, 0.03);
      tone(context, master, now + 0.05, 294, 0.13, 0.024, "triangle", 196);
      break;
    case "perfect":
      clave(context, master, now, 1_560, 0.042);
      tone(context, master, now + 0.02, 1_047, 0.12, 0.026, "sine");
      tone(context, master, now + 0.08, 1_319, 0.13, 0.024, "sine");
      tone(context, master, now + 0.14, 1_568, 0.17, 0.022, "sine");
      break;
    // The campana enters: the bell figure that turns the verse into the montuno.
    case "montuno":
      campana(context, master, now, true, 0.032);
      campana(context, master, now + 0.12, false, 0.026);
      campana(context, master, now + 0.2, true, 0.03);
      campana(context, master, now + 0.32, false, 0.026);
      break;
    // The whole band stops together.
    case "cierre":
      paper(context, master, now, 0.09, 0.046, 1_200);
      tone(context, master, now, 196, 0.24, 0.052, "triangle", 98);
      tone(context, master, now, 392, 0.17, 0.028, "sawtooth", 196);
      clave(context, master, now, 1_320, 0.05);
      campana(context, master, now, true, 0.028);
      break;
  }
}

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const context = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(savedPreference);

  const getContext = useCallback(() => {
    context.current ??= new AudioContext();
    return context.current;
  }, []);

  const play = useCallback(
    (effect: SoundEffect, options?: SoundEffectOptions) => {
      if (!enabled) return;
      const audio = getContext();
      if (audio.state === "suspended") void audio.resume();
      renderEffect(audio, effect, options);
    },
    [enabled, getContext],
  );

  const toggleEnabled = useCallback(() => {
    const next = !enabled;
    const audio = getContext();
    if (audio.state === "suspended") void audio.resume();
    renderEffect(audio, next ? "turn" : "card-select");
    setEnabled(next);
    rememberPreference(next);
  }, [enabled, getContext]);

  useEffect(
    () => () => {
      if (context.current) void context.current.close();
    },
    [],
  );

  const value = useMemo(() => ({ enabled, play, toggleEnabled }), [enabled, play, toggleEnabled]);

  return <SoundEffectsContext.Provider value={value}>{children}</SoundEffectsContext.Provider>;
}

export function useSoundEffects(): SoundEffectsContextValue {
  const soundEffects = useContext(SoundEffectsContext);
  if (!soundEffects) throw new Error("useSoundEffects must be used inside SoundEffectsProvider.");
  return soundEffects;
}

export function SoundEffectsButton({ compact = false }: { compact?: boolean }) {
  const soundEffects = useSoundEffects();
  const label = soundEffects.enabled ? "Turn sound effects off" : "Turn sound effects on";
  return (
    <button
      type="button"
      className={`sound-effects-button ${compact ? "compact" : ""} ${soundEffects.enabled ? "enabled" : ""}`}
      onClick={soundEffects.toggleEnabled}
      aria-label={label}
      aria-pressed={soundEffects.enabled}
      data-sound-effects={soundEffects.enabled ? "on" : "off"}
    >
      <span aria-hidden="true">{soundEffects.enabled ? "♪" : "×"}</span>
      <span>SFX {soundEffects.enabled ? "on" : "off"}</span>
    </button>
  );
}
