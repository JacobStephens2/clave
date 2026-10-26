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
import type { PlayerSnapshot } from "@clave/engine";
import {
  FADE_SECONDS,
  bandState,
  createHouseBand,
  cueFor,
  loadLoop,
  rememberMusicPreference,
  savedMusicPreference,
  type HouseBand,
  type HouseBandCue,
} from "../house-band.js";

const LLORARAS_SPOTIFY_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

/** The other cue: fetched and decoded behind the one playing, so the handover is silent. */
const otherCue = (cue: HouseBandCue): HouseBandCue => (cue === "cuerpo" ? "montuno" : "cuerpo");

interface MusicContextValue {
  openPlayer: () => void;
  enabled: boolean;
}

const MusicContext = createContext<MusicContextValue | null>(null);

/**
 * The house band, and the drawer it is switched on from. The band is off until a player
 * asks for it: the AudioContext is built inside that gesture and never before, which is
 * both what iOS Safari requires and what keeps a game that wants no music silent.
 *
 * Everything the band plays comes from the snapshot — {@link cueFor} reads the song card's
 * section and nothing else — so both devices in an online dance follow their own copy of
 * the same song without a note of sync between them.
 */
export function MusicProvider({
  view,
  children,
}: {
  view: PlayerSnapshot | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(savedMusicPreference);
  /** True once a gesture has given us a running context: before that nothing can sound. */
  const [awake, setAwake] = useState(false);
  const [playing, setPlaying] = useState<HouseBandCue | null>(null);
  const [failed, setFailed] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const band = useRef<HouseBand | null>(null);
  const loops = useRef(new Map<HouseBandCue, Promise<AudioBuffer>>());

  const wanted = enabled ? cueFor(view) : null;
  const state = bandState({ enabled, failed, wanted, playing });

  /** Called from inside a user gesture, which is the only place a context may be built. */
  const wake = useCallback(() => {
    audio.current ??= new AudioContext();
    band.current ??= createHouseBand(audio.current);
    // Suspended before a gesture, or "interrupted" on iOS after a call or the lock screen.
    if (audio.current.state !== "running") {
      audio.current.resume().catch(() => {
        // A gesture the browser did not count; the next one tries again.
      });
    }
    setAwake(true);
  }, []);

  const loop = useCallback((cue: HouseBandCue): Promise<AudioBuffer> => {
    const context = audio.current;
    if (!context) return Promise.reject(new Error("The band has no audio context yet."));
    const held = loops.current.get(cue);
    if (held) return held;
    const loading = loadLoop(context, cue);
    loops.current.set(cue, loading);
    // A loop that failed is forgotten, so turning the band on again tries it afresh.
    void loading.catch(() => loops.current.delete(cue));
    return loading;
  }, []);

  const toggleEnabled = useCallback(() => {
    const next = !enabled;
    if (next) wake();
    else setFailed(false);
    setEnabled(next);
    rememberMusicPreference(next);
  }, [enabled, wake]);

  // The band itself: one cue at a time, crossfading when the snapshot asks for the other.
  useEffect(() => {
    const current = band.current;
    if (!current || !awake) return;
    if (!wanted) {
      if (current.playing()) current.stop(enabled ? FADE_SECONDS.out : FADE_SECONDS.off);
      setPlaying(null);
      return;
    }
    let dropped = false;
    void loop(wanted).then(
      (buffer) => {
        if (dropped || !band.current) return;
        band.current.play(wanted, buffer);
        setPlaying(wanted);
        setFailed(false);
      },
      (error: unknown) => {
        if (dropped) return;
        console.warn("[clave] the house band did not load", error);
        setFailed(true);
      },
    );
    return () => {
      dropped = true;
    };
  }, [awake, enabled, loop, wanted]);

  // The cue after this one, warmed while the first is playing: the handover waits on nothing.
  useEffect(() => {
    if (!awake || !playing) return;
    void loop(otherCue(playing)).catch(() => {
      // The cue that is sounding is the one that matters; the other is fetched again in turn.
    });
  }, [awake, loop, playing]);

  // A preference saved as on cannot start the band by itself, so the next gesture does. A
  // phone counts the end of a touch rather than its start, so every gesture gets to try.
  useEffect(() => {
    if (!enabled) return;
    const gestures = ["pointerdown", "pointerup", "keydown"] as const;
    const start = () => wake();
    for (const gesture of gestures) window.addEventListener(gesture, start);
    return () => {
      for (const gesture of gestures) window.removeEventListener(gesture, start);
    };
  }, [enabled, wake]);

  // A backgrounded tab holds its place in the loop instead of playing to an empty room.
  useEffect(() => {
    const onVisibility = () => {
      const context = audio.current;
      if (!context || context.state === "closed") return;
      if (document.hidden) void context.suspend();
      else if (enabled) {
        context.resume().catch(() => {
          // Some browsers want a gesture for this too, and the next one wakes the band.
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  useEffect(
    () => () => {
      band.current?.dispose();
      band.current = null;
      const context = audio.current;
      audio.current = null;
      loops.current.clear();
      if (context) void context.close();
    },
    [],
  );

  const value = useMemo<MusicContextValue>(
    () => ({ openPlayer: () => setOpen(true), enabled }),
    [enabled],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
      <aside
        className={`music-player-drawer ${open ? "open" : ""}`}
        aria-label="Music"
        aria-hidden={!open}
        data-music={state}
        data-cue={playing ?? undefined}
      >
        <header>
          <div>
            <small>Music for this dance</small>
            <strong>Clave’s house band</strong>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Hide music player">
            ×
          </button>
        </header>
        <button
          type="button"
          className={`music-toggle ${enabled ? "on" : ""}`}
          onClick={toggleEnabled}
          aria-pressed={enabled}
        >
          <span className={`music-toggle-light ${state}`} aria-hidden="true" />
          <span>House band {enabled ? "on" : "off"}</span>
        </button>
        <p>
          The band plays the cuerpo through the first phrase and swaps to the montuno when the
          campana comes in. Each device plays its own copy.
        </p>
        {state === "failed" && (
          <p className="music-failed" role="status">
            The band didn’t load. Switch it on again to try once more.
          </p>
        )}
        <small className="music-credit">Original music made for Clave with Suno</small>
        <footer>
          <span>Or dance to the record</span>
          <a href={LLORARAS_SPOTIFY_URL} target="_blank" rel="noreferrer">
            Llorarás in Spotify ↗
          </a>
        </footer>
      </aside>
    </MusicContext.Provider>
  );
}

export function MusicButton({ compact = false }: { compact?: boolean }) {
  const music = useContext(MusicContext);
  if (!music) throw new Error("MusicButton must be rendered inside MusicProvider.");

  return (
    <button
      type="button"
      className={`music-button ${compact ? "compact" : ""}`}
      onClick={music.openPlayer}
      // The state is in the name as well as in the glow: "Music" alone is what is on screen.
      aria-label={music.enabled ? "Open music, house band on" : "Open music, house band off"}
    >
      <span className={`music-button-icon ${music.enabled ? "on" : ""}`} aria-hidden="true">
        ♪
      </span>
      <span>Music</span>
    </button>
  );
}
