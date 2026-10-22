// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MusicButton, MusicProvider } from "../src/components/MusicPlayer.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SPOTIFY_SCRIPT = "https://open.spotify.com/embed/iframe-api/v1";
const LLORARAS_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

describe("Llorarás music player", () => {
  let root: Root | undefined;

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    document.body.replaceChildren();
  });

  it("does not append the Spotify iframe script and keeps the Open in Spotify link", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(MusicProvider, null, createElement(MusicButton)));
    });

    expect(document.querySelector(`script[src="${SPOTIFY_SCRIPT}"]`)).toBeNull();
    expect(host.textContent).toContain(
      "The embedded player could not load. Open the recording in Spotify.",
    );
    const link = host.querySelector<HTMLAnchorElement>(`a[href="${LLORARAS_URL}"]`);
    expect(link?.textContent).toContain("Open in Spotify");
  });
});
