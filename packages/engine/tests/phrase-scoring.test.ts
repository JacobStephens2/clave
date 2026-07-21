import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyOk, readyGame } from "./helpers.js";

describe("phrase scoring · rulebook §7", () => {
  it("awards clean, variety, shared flair, and pose finish from content values", () => {
    let state = readyGame();
    state.songIndex = 7;
    state.phase = "lesson";
    state.phrase = {
      ...state.phrase,
      stumbled: false,
      positionsDancedFrom: ["Open", "Closed", "Half-Open"],
      flourishedBy: { lead: true, follow: true },
      poseOnFinalCount: true,
    };
    const before = state.shared.style;
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    const expected =
      content.rules.phraseBonuses.clean +
      2 * content.rules.phraseBonuses.varietyPerExtraPosition +
      content.rules.phraseBonuses.sharedFlair +
      content.rules.phraseBonuses.poseFinish;
    expect(state.shared.style - before).toBe(expected);
    expect(state.phrase.number).toBe(2);
  });
});
