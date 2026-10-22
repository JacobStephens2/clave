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
    expect(
      left.players.lead.hand.length +
        left.players.lead.drawPile.length +
        Number(left.table.position?.owner === "lead"),
    ).toBe(8);
    expect(left.table.position).toBeNull();
    expect(left.shared).toEqual({ connection: 4, style: 0 });
    expect(left.market.intermediateDisplay).toHaveLength(3);
    expect(left.market.advancedDisplay).toHaveLength(0);
    expect(left.songIndex).toBe(-1);
  });

  it("permits one mulligan only when no Position and Move in hand match", () => {
    let state = createGame({ seed: 8, content });
    setHand(state, "lead", ["pos_001", "mov_013", "flo_001", "rec_001"]);
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
    expect(state.table.position).toBeNull();
    const openingActions = legalActions(state, "lead", content);
    expect(openingActions.some((action) => action.type === "PLAY_MOVE")).toBe(false);
    expect(openingActions.some((action) => action.type === "PLAY_OPEN")).toBe(true);
  });

  it("keeps a Closed opening pair for either role without requiring an Open Move", () => {
    let state = createGame({ seed: 8, content });
    for (const role of ["lead", "follow"] as const) {
      setHand(state, role, ["pos_002", "mov_013", "flo_001", "rec_001"]);
      expect(legalActions(state, role, content).some((action) => action.type === "MULLIGAN")).toBe(
        false,
      );
      expect(applyAction(state, { type: "MULLIGAN", role }, content)).toMatchObject({
        ok: false,
        error: { code: "MULLIGAN_NOT_ALLOWED" },
      });
      state = applyOk(state, { type: "CONFIRM_HAND", role });
    }
  });

  it("lets the Lead choose Closed first and rejects a Move without an opening Position", () => {
    let state = createGame({ seed: 9, content });
    setHand(state, "lead", ["pos_001", "pos_002", "mov_001", "mov_013"]);
    expect(legalActions(state, "lead", content).some((action) => action.type === "MULLIGAN")).toBe(
      false,
    );
    state = applyOk(state, { type: "CONFIRM_HAND", role: "lead" });
    state = applyOk(state, { type: "CONFIRM_HAND", role: "follow" });
    const [open, closed, basic, closedMove] = state.players.lead.hand;
    const actions = legalActions(state, "lead", content);
    expect(actions).toContainEqual({
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: open!.instanceId,
      moveInstanceId: basic!.instanceId,
    });
    expect(actions).toContainEqual({
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: closed!.instanceId,
      moveInstanceId: closedMove!.instanceId,
    });
    expect(
      applyAction(
        state,
        { type: "PLAY_MOVE", role: "lead", moveInstanceId: basic!.instanceId },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "OPEN_REQUIRED" } });
    state = applyOk(state, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: closed!.instanceId,
      moveInstanceId: closedMove!.instanceId,
    });
    expect(state.table.position?.cardId).toBe("pos_002");
    expect(state.table.move?.dancedFrom).toBe("Closed");
    expect(state.turnDance.positionsPlayed).toBe(1);
    expect(state.turnDance.cardsPlayed).toBe(2);
  });
});
