// @vitest-environment happy-dom
import { content } from "@clave/content";
import {
  applyAction,
  createGame,
  snapshotFor,
  type GameAction,
  type GameState,
  type PlayerSnapshot,
} from "@clave/engine";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AfinqueMeter } from "../src/components/AfinqueMeter.js";
import { CallBanner } from "../src/components/CallBanner.js";
import { CallPickerTrigger, CallSheet } from "../src/components/CallPicker.js";
import { PhraseHistory, comboSummary } from "../src/components/PhraseHistory.js";
import { rungLabel } from "../src/rungs.js";
import { NO_INTENT, readDanceStep } from "../src/turn-intent.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function applyOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, content);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** The Lead's dance step on an established floor, optionally with a call standing over it. */
function danceView(callId?: string): PlayerSnapshot {
  let state = createGame({ seed: 42, content });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
  state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
  state.players.lead.hand = ["pos_002", "mov_002", "rec_001"].map((cardId) => ({
    instanceId: `lead-hand-${cardId}`,
    cardId,
    owner: "lead" as const,
  }));
  state.table.position = { instanceId: "previous-position", cardId: "pos_001", owner: "follow" };
  if (callId)
    state.call = { byRole: "follow", callId, forSongIndex: state.songIndex, inPocket: true };
  return snapshotFor(state, "lead", content);
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactNode): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
  return host;
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
  host = undefined;
  document.body.replaceChildren();
});

describe("the call sheet", () => {
  it("lists every call, says the whole option, and moves focus into the sheet", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const element = await render(
      createElement(CallSheet, { picker, onChoose: () => undefined, onClose: () => undefined }),
    );

    const options = [...element.querySelectorAll<HTMLButtonElement>(".call-option")];
    expect(options).toHaveLength(picker.options.length);
    expect(options[0]?.getAttribute("aria-label")).toBe(picker.options[0]?.sentence);
    expect(document.activeElement).toBe(options[0]);
    expect(element.querySelector(".call-sheet")?.getAttribute("role")).toBe("dialog");
    expect(element.querySelector(".call-option.favoured")?.textContent).toContain("Stay with me");
  });

  it("prints the standing call's price, which the open sheet has covered up", async () => {
    // The sheet is the other way out of an 8-count with a call standing: it has to name the
    // same price the banner behind it does, because the banner is hidden and made inert.
    const view = danceView("call_005");
    const step = readDanceStep(view, NO_INTENT);
    const element = await render(
      createElement(CallSheet, {
        picker: step.telling!.picker!,
        onChoose: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(element.querySelector(".call-sheet-price")?.textContent).toBe(step.call?.price);
    expect(element.querySelector(".call-sheet-price")?.textContent).toBe(
      "Unanswered: −1 Connection, and the phrase loses its clean +3",
    );
  });

  it("prints no price in the sheet when no call stands over the player holding it", async () => {
    const picker = readDanceStep(danceView(), NO_INTENT).telling!.picker!;
    const element = await render(
      createElement(CallSheet, { picker, onChoose: () => undefined, onClose: () => undefined }),
    );
    expect(element.querySelector(".call-sheet-price")).toBeNull();
  });

  it("dispatches the END_DANCE the snapshot made legal for the chosen call", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const chosen: GameAction[] = [];
    const element = await render(
      createElement(CallSheet, {
        picker,
        onChoose: (action: GameAction) => chosen.push(action),
        onClose: () => undefined,
      }),
    );

    const option = [...element.querySelectorAll<HTMLButtonElement>(".call-option")].find((button) =>
      button.textContent?.includes("Style it"),
    );
    await act(async () => option?.click());
    expect(chosen).toEqual([{ type: "END_DANCE", role: "lead", callId: "call_006" }]);
  });

  it("closes on Escape and gives focus back to whatever opened it", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    let closes = 0;
    await render(
      createElement(CallSheet, {
        picker,
        onChoose: () => undefined,
        onClose: () => {
          closes += 1;
        },
      }),
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(closes).toBe(1);

    await act(async () => {
      root?.unmount();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves the focus to the new step when a call is chosen, not to the gone trigger", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    // The trigger unmounts with the dance step the call ends, as it does in the game.
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const element = await render(
      createElement(CallSheet, {
        picker,
        onChoose: () => trigger.remove(),
        onClose: () => undefined,
      }),
    );
    await act(async () => element.querySelector<HTMLButtonElement>(".call-option")?.click());
    await act(async () => {
      root?.unmount();
    });
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps the focus off a trigger that has left the page on an Escape", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    await render(
      createElement(CallSheet, { picker, onChoose: () => undefined, onClose: () => undefined }),
    );
    trigger.remove();
    await act(async () => {
      root?.unmount();
    });
    expect(document.activeElement).toBe(document.body);
  });
});

describe("the call picker trigger", () => {
  it("is a disclosure for the sheet it controls", async () => {
    const view = danceView();
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const element = await render(
      createElement(CallPickerTrigger, { picker, open: false, onOpen: () => undefined }),
    );
    const button = element.querySelector<HTMLButtonElement>(".call-picker-trigger")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("call-sheet");
    expect(button.disabled).toBe(false);
    expect(element.querySelector(".call-picker-closed")).toBeNull();
  });

  it("is disabled and described by the reason when no call can be made", async () => {
    let state = createGame({ seed: 42, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    const view = snapshotFor(state, "lead", content);
    const picker = readDanceStep(view, NO_INTENT).telling!.picker!;
    const element = await render(
      createElement(CallPickerTrigger, { picker, open: false, onOpen: () => undefined }),
    );
    const button = element.querySelector<HTMLButtonElement>(".call-picker-trigger")!;
    expect(button.disabled).toBe(true);
    // The button itself carries the reason: the line beside it is printed only on a phone.
    expect(button.textContent).toBe("No call · open the floor first");
    expect(element.querySelector(`#${button.getAttribute("aria-describedby")}`)?.textContent).toBe(
      "Leave a Position on the floor to make a call.",
    );
  });
});

describe("the standing-call banner", () => {
  it("says in words that the call is not answered yet", async () => {
    const call = readDanceStep(danceView("call_005"), NO_INTENT).call!;
    const element = await render(createElement(CallBanner, { call }));
    const banner = element.querySelector(".call-banner")!;
    expect(banner.className).toContain("unmet");
    expect(banner.querySelector(".call-state")?.textContent).toContain("Not answered yet");
    expect(banner.textContent).toContain("Follow calls Stay close");
    expect(banner.querySelector(".call-reward")?.textContent).toBe("4 Style · ★ +1 in the pocket");
    // What letting it go costs, printed beside what answering it pays.
    expect(banner.querySelector(".call-price")?.textContent).toBe(
      "Unanswered: −1 Connection, and the phrase loses its clean +3",
    );
  });

  it("drops the price once the call is answered", async () => {
    let state = createGame({ seed: 42, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    state.players.lead.hand = [
      { instanceId: "lead-hand-mov_002", cardId: "mov_002", owner: "lead" },
    ];
    state.table.position = { instanceId: "previous-position", cardId: "pos_001", owner: "follow" };
    state.call = {
      byRole: "follow",
      callId: "call_002",
      forSongIndex: state.songIndex,
      inPocket: false,
    };
    state = applyOk(state, {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: "lead-hand-mov_002",
    });
    const call = readDanceStep(snapshotFor(state, "lead", content), NO_INTENT).call!;
    const element = await render(createElement(CallBanner, { call }));
    expect(element.querySelector(".call-price")).toBeNull();
  });

  it("says the call is answered once the dance meets it, in a live region", async () => {
    let state = createGame({ seed: 42, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    state.players.lead.hand = [
      { instanceId: "lead-hand-mov_002", cardId: "mov_002", owner: "lead" },
    ];
    state.table.position = { instanceId: "previous-position", cardId: "pos_001", owner: "follow" };
    state.call = {
      byRole: "follow",
      callId: "call_002",
      forSongIndex: state.songIndex,
      inPocket: false,
    };
    state = applyOk(state, {
      type: "PLAY_MOVE",
      role: "lead",
      moveInstanceId: "lead-hand-mov_002",
    });
    const call = readDanceStep(snapshotFor(state, "lead", content), NO_INTENT).call!;
    const element = await render(createElement(CallBanner, { call }));
    const state_ = element.querySelector(".call-state")!;
    expect(element.querySelector(".call-banner")?.className).toContain("met");
    expect(state_.getAttribute("role")).toBe("status");
    expect(state_.textContent).toContain("Answered");
  });

  it("carries no buttons of its own: covering sits with the dance controls", async () => {
    const call = readDanceStep(danceView("call_005"), NO_INTENT).call!;
    expect(call.covers).toHaveLength(1);
    const element = await render(createElement(CallBanner, { call }));
    expect(element.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("the afinque meter", () => {
  it("reads out the links and what the next answer adds", async () => {
    const view = danceView();
    view.afinque = { links: 3, cap: 5, nextBonus: 1, ifCalledNow: { links: 3, nextBonus: 1 } };
    const element = await render(createElement(AfinqueMeter, { view }));
    expect(element.querySelector(".visually-hidden")?.textContent).toBe(
      "Afinque: 3 of 5 links. The next answer adds 1 Style.",
    );
    expect(element.querySelectorAll(".afinque-pips i")).toHaveLength(5);
    expect(element.querySelectorAll(".afinque-pips i.filled")).toHaveLength(3);
    expect(element.querySelector(".afinque-next")?.textContent).toBe("next +1");
  });

  it("stays off the HUD in a game whose content prints no calls", async () => {
    const view = danceView();
    view.afinque = { links: 0, cap: 0, nextBonus: 0, ifCalledNow: { links: 0, nextBonus: 0 } };
    const element = await render(createElement(AfinqueMeter, { view }));
    expect(element.querySelector(".afinque")).toBeNull();
  });
});

describe("rung marks in the phrase strip", () => {
  it("shows each rung as a word and says it to a screen reader", async () => {
    const view = danceView();
    view.danceHistory = [
      { ...danceEntry(1, "lead"), rung: "perfect", styleGained: 5, afinqueAfter: 2 },
      { ...danceEntry(2, "follow"), rung: "awkward" },
      { ...danceEntry(3, "lead"), rung: "recovered" },
      { ...danceEntry(4, "follow"), outcome: "stumble", rung: "break" },
    ];
    const element = await render(
      createElement(PhraseHistory, { view, onInspect: () => undefined }),
    );

    const marks = [...element.querySelectorAll(".combo-rung")].map((mark) => mark.textContent);
    expect(marks).toEqual(["★Perfect••", "∼Awkward", "↺Recovered", "×Break"]);
    const first = element
      .querySelector('.phrase-combo[data-count="1"]')
      ?.getAttribute("aria-label");
    expect(first).toContain("Perfect: the call answered. +5 Style. Afinque 2 links.");
    expect(rungLabel("clean")).toBe("Clean");
  });

  it("names the hold rather than the basic, which is a different play", async () => {
    const view = danceView();
    view.danceHistory = [
      { ...danceEntry(1, "lead"), outcome: "basic", rung: "awkward", endingPosition: "Closed" },
      {
        ...danceEntry(2, "follow"),
        outcome: "basic",
        rung: "awkward",
        endingPosition: "Closed",
        hold: "taken",
      },
      {
        ...danceEntry(3, "lead"),
        outcome: "basic",
        rung: "awkward",
        endingPosition: "Open",
        hold: "adjusted",
      },
    ];
    const element = await render(
      createElement(PhraseHistory, { view, onInspect: () => undefined }),
    );

    const said = (count: number) =>
      element.querySelector(`.phrase-combo[data-count="${count}"]`)?.getAttribute("aria-label");
    const footer = (count: number) =>
      element.querySelector(`.phrase-combo[data-count="${count}"] .combo-footer p`)?.textContent;
    expect(said(1)).toContain("Lead danced the basic in Closed");
    expect(footer(1)).toBe("Basic · Closed");
    expect(said(2)).toContain("Follow took the hold in Closed");
    expect(footer(2)).toBe("Hold · Closed");
    expect(said(3)).toContain("Lead adjusted the hold to Open");
    expect(footer(3)).toBe("Hold · Open");
    expect(comboSummary(view.danceHistory[1]!)).toBe("Follow took the hold in Closed");
  });
});

/** One danced 8-count in the first phrase, as the snapshot publishes it. */
function danceEntry(
  count: number,
  role: "lead" | "follow",
): PlayerSnapshot["danceHistory"][number] {
  return {
    sequence: count,
    phrase: 1,
    count,
    role,
    outcome: "dance",
    rung: "clean",
    styleGained: 0,
    afinqueAfter: 0,
    move: null,
    position: null,
    flourish: null,
    fromPosition: null,
    endingPosition: null,
    callMade: null,
    callOutcome: null,
    songBonus: null,
    hold: null,
  };
}
