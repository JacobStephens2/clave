import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction, createGame, legalActions } from "../src/index.js";
import { applyOk, setHand } from "./helpers.js";

describe("setup · rulebook §4", () => {
  it("builds deterministic starter decks, opening hands, scores, song, and markets", () => {
    const left = createGame({ seed: 123, content });
    const right = createGame({ seed: 123, content });
    expect(left).toEqual(right);
    expect(left.activeRole).toBe("lead");
    expect(left.players.lead.hand).toHaveLength(content.rules.handSize);
    expect(left.players.follow.hand).toHaveLength(content.rules.handSize);
    expect(left.players.lead.hand.length + left.players.lead.drawPile.length).toBe(8);
    expect(left.shared).toEqual({ connection: 4, style: 0 });
    expect(left.market.intermediateDisplay).toHaveLength(3);
    expect(left.market.advancedDisplay).toHaveLength(0);
    expect(left.songIndex).toBe(-1);
  });

  it("permits one mulligan only when no Position has a matching Move", () => {
    let state = createGame({ seed: 8, content });
    setHand(state, "lead", ["mov_001", "mov_002", "mov_003", "mov_004"]);
    expect(legalActions(state, "lead", content).some((action) => action.type === "MULLIGAN")).toBe(
      true,
    );
    state = applyOk(state, { type: "MULLIGAN", role: "lead" });
    expect(state.players.lead.mulliganUsed).toBe(true);
    const repeated = applyAction(state, { type: "MULLIGAN", role: "lead" }, content);
    expect(repeated.ok).toBe(false);
  });

  it("checks opening hands privately before the Lead reveals count one", () => {
    let state = createGame({ seed: 9, content });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    expect(state.setupRole).toBe("follow");
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    expect(state.status).toBe("playing");
    expect(state.activeRole).toBe("lead");
    expect(state.songIndex).toBe(0);
    expect(state.players.lead.money).toBe(1);
  });
});
