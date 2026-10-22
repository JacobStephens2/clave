// @vitest-environment happy-dom
import { content } from "@clave/content";
import { createGame, snapshotFor, type PlayerSnapshot } from "@clave/engine";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PhraseHistory } from "../src/components/PhraseHistory.js";
import { RulesButton, RulesProvider } from "../src/components/RulesDialog.js";
import { useAppStore } from "../src/store.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function view(): PlayerSnapshot {
  return snapshotFor(createGame({ seed: 1, content }), "lead", content);
}

describe("song length on the rules sheet and phrase choreography", () => {
  let root: Root | undefined;

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    document.body.replaceChildren();
    useAppStore.setState({ screen: "home", snapshot: null });
  });

  async function render(node: ReactNode): Promise<HTMLElement> {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(node);
    });
    return host;
  }

  async function openRules(): Promise<string> {
    const host = await render(createElement(RulesProvider, null, createElement(RulesButton)));
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="How to play"]');
    await act(async () => {
      button?.click();
    });
    return host.textContent ?? "";
  }

  it("reads the bundled song when no dance is on screen", async () => {
    const text = await openRules();
    expect(text).toContain("finish all 16 8-counts together.");
    expect(text).toContain("two phrases of 8 8-counts: the Cuerpo, then the Montuno.");
  });

  it("reads the dance snapshot instead of dividing the bundled song", async () => {
    const dance = view();
    dance.rules.songLength = 18;
    dance.rules.phraseLength = 5;
    dance.rules.phrases = [
      { number: 1, section: "Montuno" },
      { number: 2, section: "Cuerpo" },
    ];
    useAppStore.setState({ screen: "game", snapshot: dance });

    const text = await openRules();
    expect(text).toContain("finish all 18 8-counts together.");
    expect(text).not.toContain("finish all 16 8-counts together.");
    expect(text).toContain("two phrases of 5 8-counts: the Montuno, then the Cuerpo.");
    expect(text).not.toContain("two phrases of 8 8-counts");
  });

  it("names phrase choreography from the snapshot phrase list", async () => {
    const dance = view();
    dance.phrase.number = 2;
    dance.rules.phrases = [
      { number: 1, section: "Montuno" },
      { number: 2, section: "Cuerpo" },
    ];
    const host = await render(
      createElement(PhraseHistory, { view: dance, onInspect: () => undefined }),
    );
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(tabs).toEqual(["Montuno", "Cuerpo"]);
    expect(host.querySelector(".phrase-history")?.getAttribute("aria-label")).toContain("Cuerpo");
    expect(host.querySelector(".phrase-live-label")).toBeNull();
    expect(host.querySelectorAll(".phrase-combo")).toHaveLength(dance.rules.phraseLength);
  });
});
