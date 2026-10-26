// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  snapshotFor,
  type GameState,
  type PlayerSnapshot,
} from "@clave/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicButton, MusicProvider } from "../src/components/MusicPlayer.js";
import { BAND_GAIN, FADE_SECONDS, LOOPS, MUSIC_KEY } from "../src/house-band.js";
import { FakeAudioContext, installLocalStorage } from "./fake-audio.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SPOTIFY_SCRIPT = "https://open.spotify.com/embed/iframe-api/v1";
const LLORARAS_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

function applyOk(state: GameState, role: "lead" | "follow"): GameState {
  const result = applyAction(state, { type: "CONFIRM_HAND", role }, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** A real dance to play under: dealt, confirmed, at the top of the cuerpo. */
function playingView(): PlayerSnapshot {
  const state = applyOk(applyOk(createGame({ seed: 42, content }), "lead"), "follow");
  return snapshotFor(state, "lead", content);
}

describe("the house band drawer", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  let storage: Storage;
  let contexts: FakeAudioContext[];
  let fetched: string[];
  /** A browser that does not count this gesture as one that may start audio. */
  let refuseResume: boolean;

  const render = async (view: PlayerSnapshot | null) => {
    await act(async () => {
      root?.render(createElement(MusicProvider, { view, children: createElement(MusicButton) }));
    });
  };
  const drawer = () => host.querySelector("aside")!;
  const toggle = () => host.querySelector<HTMLButtonElement>(".music-toggle")!;
  const click = async (button: HTMLButtonElement) => {
    await act(async () => {
      button.click();
    });
  };
  /** The voice gains, in the order the band built them: the master comes first. */
  const voices = () => contexts[0]?.gains.slice(1) ?? [];

  beforeEach(() => {
    storage = installLocalStorage();
    contexts = [];
    fetched = [];
    refuseResume = false;
    vi.stubGlobal(
      "AudioContext",
      class extends FakeAudioContext {
        constructor() {
          super();
          contexts.push(this);
        }

        override async resume(): Promise<void> {
          if (refuseResume) throw new DOMException("Not a gesture.", "NotAllowedError");
          await super.resume();
        }
      },
    );
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays off, silent and unloaded until a player asks for it", async () => {
    await render(playingView());

    expect(drawer().dataset.music).toBe("off");
    expect(drawer().dataset.cue).toBeUndefined();
    expect(contexts).toHaveLength(0);
    expect(fetched).toEqual([]);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(toggle().textContent).toContain("House band off");
  });

  it("says what it plays, credits it, and still points at the record", async () => {
    await render(playingView());

    expect(host.textContent).toContain("Original music made for Clave with Suno");
    expect(host.textContent).toContain("swaps to the montuno");
    // The drawer used to apologise for playing nothing. It plays something now.
    expect(host.textContent).not.toContain("doesn’t play the music");
    expect(document.querySelector(`script[src="${SPOTIFY_SCRIPT}"]`)).toBeNull();
    const link = drawer().querySelector<HTMLAnchorElement>(`a[href="${LLORARAS_URL}"]`);
    expect(link?.textContent).toContain("Llorarás in Spotify");
  });

  it("opens the drawer as a command, not as a pressed toggle", async () => {
    await render(playingView());
    const open = host.querySelector<HTMLButtonElement>(".music-button")!;
    expect(open.getAttribute("aria-pressed")).toBeNull();
    expect(open.getAttribute("aria-label")).toBe("Open music, house band off");
  });

  it("builds its own context inside the click and starts the cuerpo", async () => {
    await render(playingView());
    await click(toggle());

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.state).toBe("running");
    expect(fetched).toContain(LOOPS.cuerpo.file);
    expect(drawer().dataset.music).toBe("playing");
    expect(drawer().dataset.cue).toBe("cuerpo");
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(storage.getItem(MUSIC_KEY)).toBe("on");

    expect(contexts[0]?.gains[0]?.gain.value).toBe(BAND_GAIN);
    expect(voices()[0]?.gain.ramps[0]?.seconds).toBe(FADE_SECONDS.in);
    expect(contexts[0]?.sources[0]?.loopEnd).toBe(LOOPS.cuerpo.loopEnd);
    // The montuno is fetched behind the cuerpo, so the handover waits on nothing.
    expect(fetched).toContain(LOOPS.montuno.file);
  });

  it("crossfades to the montuno when the song changes section", async () => {
    await render(playingView());
    await click(toggle());
    const montuno = content.song.cards.find((song) => song.section === "Montuno") ?? null;
    await render({ ...playingView(), currentSong: montuno });

    expect(drawer().dataset.cue).toBe("montuno");
    expect(contexts[0]?.sources).toHaveLength(2);
    expect(contexts[0]?.sources[1]?.loopEnd).toBe(LOOPS.montuno.loopEnd);
    expect(voices()[0]?.gain.ramps.at(-1)?.seconds).toBe(FADE_SECONDS.cross);
    expect(voices()[1]?.gain.ramps.at(-1)?.seconds).toBe(FADE_SECONDS.cross);
  });

  it("lets the band leave over a few seconds when the dance ends", async () => {
    await render(playingView());
    await click(toggle());
    await render({ ...playingView(), status: "completed" });

    expect(drawer().dataset.music).toBe("idle");
    expect(drawer().dataset.cue).toBeUndefined();
    expect(voices()[0]?.gain.ramps.at(-1)).toMatchObject({ seconds: FADE_SECONDS.out });
  });

  it("goes quiet faster when the player switches it off, and remembers", async () => {
    await render(playingView());
    await click(toggle());
    await click(toggle());

    expect(drawer().dataset.music).toBe("off");
    expect(storage.getItem(MUSIC_KEY)).toBe("off");
    expect(voices()[0]?.gain.ramps.at(-1)).toMatchObject({ seconds: FADE_SECONDS.off });
  });

  it("waits for a gesture when the preference was saved as on", async () => {
    storage.setItem(MUSIC_KEY, "on");
    await render(playingView());

    expect(contexts).toHaveLength(0);
    expect(drawer().dataset.music).toBe("loading");

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(contexts).toHaveLength(1);
    expect(drawer().dataset.music).toBe("playing");
  });

  it("tries the next gesture when the browser did not count the first", async () => {
    storage.setItem(MUSIC_KEY, "on");
    await render(playingView());

    // A phone lets the end of a touch start audio, not its start.
    refuseResume = true;
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(contexts[0]?.state).toBe("suspended");

    refuseResume = false;
    await act(async () => {
      window.dispatchEvent(new Event("pointerup"));
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.state).toBe("running");
  });

  it("owns up when the loop does not load, and offers it again", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    await render(playingView());
    await click(toggle());

    expect(drawer().dataset.music).toBe("failed");
    expect(drawer().textContent).toContain("The band didn’t load");
    expect(warn).toHaveBeenCalled();

    await click(toggle());
    expect(drawer().dataset.music).toBe("off");
    expect(drawer().textContent).not.toContain("The band didn’t load");
  });
});
