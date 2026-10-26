import { useEffect } from "react";
import { GameScreen } from "./components/GameScreen.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { MusicProvider } from "./components/MusicPlayer.js";
import { RulesProvider } from "./components/RulesDialog.js";
import { SoundEffectsProvider } from "./components/SoundEffects.js";
import { useAppStore } from "./store.js";

export function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const screen = useAppStore((state) => state.screen);
  const error = useAppStore((state) => state.error);
  const clearError = useAppStore((state) => state.clearError);
  // The band's only instruction: the snapshot, which says which phrase of the song this is.
  const snapshot = useAppStore((state) => state.snapshot);

  useEffect(() => hydrate(), [hydrate]);

  return (
    <RulesProvider>
      <SoundEffectsProvider>
        <MusicProvider view={snapshot}>
          <div className="app-shell">
            {screen === "home" ? <HomeScreen /> : <GameScreen />}
            {error && (
              <div className="toast" role="alert">
                <span>{error}</span>
                <button type="button" onClick={clearError} aria-label="Dismiss message">
                  ×
                </button>
              </div>
            )}
          </div>
        </MusicProvider>
      </SoundEffectsProvider>
    </RulesProvider>
  );
}
