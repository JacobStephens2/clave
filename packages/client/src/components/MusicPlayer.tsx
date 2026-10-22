import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const LLORARAS_SPOTIFY_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

interface MusicContextValue {
  openPlayer: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<MusicContextValue>(() => ({ openPlayer: () => setOpen(true) }), []);

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
        <p role="status">The embedded player could not load. Open the recording in Spotify.</p>
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

  return (
    <button
      type="button"
      className={`music-button ${compact ? "compact" : ""}`}
      onClick={music.openPlayer}
      aria-label="Open Llorarás"
    >
      <span className="music-button-icon" aria-hidden="true">
        ♪
      </span>
      <span>Open Llorarás</span>
    </button>
  );
}
