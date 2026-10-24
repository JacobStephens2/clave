// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { content, type ContentSet } from "@clave/content";
import { createGame, snapshotFor } from "@clave/engine";
import { afterEach, describe, expect, it } from "vitest";
import { RulesButton, RulesProvider } from "../src/components/RulesDialog.js";
import { useAppStore } from "../src/store.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const calls = content.rules.call;
if (!calls) throw new Error("The bundled content prints no calls.");

describe("rulebook", () => {
  let root: Root | undefined;

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    document.body.replaceChildren();
    useAppStore.setState({ snapshot: null });
  });

  /** The rulebook as a player opens it: the button mounted, then pressed. */
  async function openRulebook(): Promise<HTMLElement> {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(RulesProvider, null, createElement(RulesButton)));
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>(".rules-button")?.click();
    });
    return host;
  }

  it("prints the calls, the pocket, the drop, and the afinque table from the content", async () => {
    const host = await openRulebook();
    const text = host.textContent ?? "";

    expect(text).toContain("Call and answer");
    for (const option of calls.options) {
      expect(text).toContain(option.name);
      expect(text).toContain(option.ask);
      expect(text).toContain(`${option.style} Style`);
    }
    expect(text).toContain(`+${calls.inPocketStyle} Style in the pocket`);
    expect(text).toContain(`the couple loses ${calls.missConnectionCost} Connection`);
    for (const bonus of calls.afinqueBonus) expect(text).toContain(`+${bonus} Style`);
    expect(text).toContain(`${calls.afinqueBonus.length} links is the most it holds`);
    expect(text).toContain("resets at every phrase ending");
  });

  it("names every rung of the ladder and the order they are checked in", async () => {
    const host = await openRulebook();
    const text = host.textContent ?? "";

    expect(text).toContain("Every 8-count lands somewhere");
    for (const rung of ["Perfect", "Clean", "Awkward", "Recovered", "Break"]) {
      expect(text).toContain(rung);
    }
    expect(text).toContain("break, recovered, perfect, awkward, clean");
  });

  it("leaves the call out, and the numbering unbroken, for a game that prints no calls", async () => {
    // A game stored before the call existed: its own content set has no calls in it.
    const rules = { ...content.rules };
    delete rules.call;
    const plainContent: ContentSet = { ...content, rules };
    const state = createGame({ seed: 7, content: plainContent });
    useAppStore.setState({ snapshot: snapshotFor(state, "lead", plainContent) });

    const host = await openRulebook();
    const text = host.textContent ?? "";
    const numbers = [...host.querySelectorAll(".rules-section-number")].map(
      (node) => node.textContent,
    );

    expect(text).not.toContain("Call and answer");
    expect(text).not.toContain("afinque");
    expect(text).toContain("Every 8-count lands somewhere");
    expect(text).not.toContain("Recovered");
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
    expect(host.querySelectorAll(".rules-nav button")).toHaveLength(numbers.length);
  });
});
