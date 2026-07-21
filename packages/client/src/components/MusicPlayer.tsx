import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const SPOTIFY_SCRIPT_URL = "https://open.spotify.com/embed/iframe-api/v1";
const LLORARAS_SPOTIFY_URI = "spotify:track:5SsgnRkcr4ogLB9rcW61tf";
const LLORARAS_SPOTIFY_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

type SpotifyStatus = "loading" | "ready" | "unavailable";

interface SpotifyPlaybackEvent {
  data?: {
    isPaused?: boolean;
  };
}

interface SpotifyEmbedController {
  addListener: (
    event: "ready" | "playback_started" | "playback_update",
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  destroy: () => void;
  pause: () => void;
  resume: () => void;
}

interface SpotifyIFrameApi {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
}

declare global {
  interface Window {
    __claveSpotifyApi?: SpotifyIFrameApi;
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}

let spotifyApiPromise: Promise<SpotifyIFrameApi> | null = null;

function loadSpotifyApi(): Promise<SpotifyIFrameApi> {
  if (window.__claveSpotifyApi) return Promise.resolve(window.__claveSpotifyApi);
  if (spotifyApiPromise) return spotifyApiPromise;

  spotifyApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.__claveSpotifyApi = api;
      previousReady?.(api);
      resolve(api);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SPOTIFY_SCRIPT_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("error", () => reject(new Error("Spotify player failed to load.")), {
      once: true,
    });
    if (!existing) {
      script.src = SPOTIFY_SCRIPT_URL;
      script.async = true;
      document.body.append(script);
    }
  });

  return spotifyApiPromise;
}

interface MusicContextValue {
  playing: boolean;
  status: SpotifyStatus;
  toggle: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<SpotifyEmbedController | null>(null);
  const [status, setStatus] = useState<SpotifyStatus>("loading");
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let ownedController: SpotifyEmbedController | null = null;

    void loadSpotifyApi()
      .then((api) => {
        if (!active || !host.current) return;
        api.createController(
          host.current,
          { uri: LLORARAS_SPOTIFY_URI, width: "100%", height: 152 },
          (embedController) => {
            if (!active) {
              embedController.destroy();
              return;
            }
            ownedController = embedController;
            controller.current = embedController;
            setStatus("ready");
            embedController.addListener("playback_started", () => {
              if (active) setPlaying(true);
            });
            embedController.addListener("playback_update", (event) => {
              if (active && typeof event.data?.isPaused === "boolean")
                setPlaying(!event.data.isPaused);
            });
          },
        );
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
      ownedController?.destroy();
      if (controller.current === ownedController) controller.current = null;
    };
  }, []);

  const value = useMemo<MusicContextValue>(
    () => ({
      playing,
      status,
      toggle: () => {
        setOpen(true);
        if (playing) {
          controller.current?.pause();
          setPlaying(false);
        } else controller.current?.resume();
      },
    }),
    [playing, status],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
      <aside
        className={`music-player-drawer ${open ? "open" : ""}`}
        aria-label="Llorarás music player"
        aria-hidden={!open}
      >
        <header>
          <div>
            <small>Music for this dance</small>
            <strong>Llorarás · Oscar D’León</strong>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Hide music player">
            ×
          </button>
        </header>
        <div className="spotify-embed" ref={host} />
        {status === "unavailable" && (
          <p role="status">The embedded player could not load. Open the recording in Spotify.</p>
        )}
        <footer>
          <span>Ambient only · play on one speaker</span>
          <a href={LLORARAS_SPOTIFY_URL} target="_blank" rel="noreferrer">
            Open in Spotify ↗
          </a>
        </footer>
      </aside>
    </MusicContext.Provider>
  );
}

export function MusicButton({ compact = false }: { compact?: boolean }) {
  const music = useContext(MusicContext);
  if (!music) throw new Error("MusicButton must be rendered inside MusicProvider.");

  const label =
    music.status === "loading"
      ? "Loading music…"
      : music.status === "unavailable"
        ? "Open Llorarás"
        : music.playing
          ? "Pause Llorarás"
          : "Play Llorarás";

  return (
    <button
      type="button"
      className={`music-button ${compact ? "compact" : ""} ${music.playing ? "playing" : ""}`}
      onClick={music.toggle}
      disabled={music.status === "loading"}
      aria-label={label}
      aria-pressed={music.playing}
    >
      <span className="music-button-icon" aria-hidden="true">
        {music.playing ? "Ⅱ" : "♪"}
      </span>
      <span>{label}</span>
    </button>
  );
}
