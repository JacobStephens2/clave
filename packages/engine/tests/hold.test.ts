import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction, snapshotFor, type GameState } from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

/** A dance step with `cardId` on the floor, owned by the waiting partner. */
function onFloor(cardId: string | null, seed = 42): GameState {
  const state = readyGame(seed);
  if (cardId) state.table.position = { instanceId: "floor-card", cardId, owner: "follow" };
  return state;
}

describe("the hold · rulebook §6.4", () => {
  it("takes the hold with one Position card when the floor is empty", () => {
    let state = onFloor(null);
    setHand(state, "lead", ["pos_002", "mov_013"]);
    const [position, move] = state.players.lead.hand;
    state = applyOk(state, {
      type: "ADJUST",
      role: "lead",
      positionInstanceId: position!.instanceId,
    });
    expect(state.table.position?.cardId).toBe("pos_002");
    expect(state.turnDance).toMatchObject({
      adjusted: true,
      changedPosition: false,
      cardsPlayed: 1,
      positionsPlayed: 1,
      canTransition: false,
    });
    // The new floor is dancing ground: a matching Move follows the hold as usual.
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: move!.instanceId });
    expect(state.table.move?.dancedFrom).toBe("Closed");
  });

  it("adjusts an established hold to a different position and changes the room", () => {
    let state = onFloor("pos_001");
    setHand(state, "lead", ["pos_002"]);
    const position = state.players.lead.hand[0]!;
    state = applyOk(state, {
      type: "ADJUST",
      role: "lead",
      positionInstanceId: position.instanceId,
    });
    expect(state.table.position?.cardId).toBe("pos_002");
    expect(state.turnDance.changedPosition).toBe(true);
    expect(state.players.follow.discardPile.map((entry) => entry.cardId)).toEqual(["pos_001"]);
  });

  it("forfeits the song card's bonus for the 8-count it is taken on", () => {
    let state = onFloor("pos_002");
    state.songIndex = 4;
    state.currentSongId = "song_005";
    setHand(state, "lead", ["pos_001", "mov_002"]);
    const [position, move] = state.players.lead.hand;
    state = applyOk(state, {
      type: "ADJUST",
      role: "lead",
      positionInstanceId: position!.instanceId,
    });
    state = applyOk(state, { type: "PLAY_MOVE", role: "lead", moveInstanceId: move!.instanceId });
    const before = { ...state.shared };
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    // Count 5 pays +1 Connection for playing no Position; the hold gives that up.
    expect(state.shared.connection).toBe(before.connection);
    expect(state.turnDance.bonusStyle).toBe(0);
    expect(state.turnDance.bonusConnection).toBe(0);
  });

  it("still lets the player make a call after taking the hold", () => {
    let state = onFloor(null);
    setHand(state, "lead", ["pos_001"]);
    state = applyOk(state, {
      type: "ADJUST",
      role: "lead",
      positionInstanceId: state.players.lead.hand[0]!.instanceId,
    });
    state = applyOk(state, { type: "END_DANCE", role: "lead", callId: "call_001" });
    expect(state.call?.callId).toBe("call_001");
  });

  it("refuses the same position, a hold after any card, and a third Position card", () => {
    const same = onFloor("pos_001");
    setHand(same, "lead", ["pos_001"]);
    expect(
      applyAction(
        same,
        {
          type: "ADJUST",
          role: "lead",
          positionInstanceId: same.players.lead.hand[0]!.instanceId,
        },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "SAME_POSITION" } });

    let danced = onFloor(null);
    setHand(danced, "lead", ["pos_001", "mov_002", "pos_002"]);
    const [position, move, second] = danced.players.lead.hand;
    danced = applyOk(danced, {
      type: "PLAY_OPEN",
      role: "lead",
      positionInstanceId: position!.instanceId,
      moveInstanceId: move!.instanceId,
    });
    expect(
      applyAction(
        danced,
        { type: "ADJUST", role: "lead", positionInstanceId: second!.instanceId },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "ADJUST_AFTER_PLAY" } });

    const spent = onFloor("pos_001");
    setHand(spent, "lead", ["pos_002"]);
    spent.turnDance.positionsPlayed = content.rules.danceLimits.positions;
    expect(
      applyAction(
        spent,
        {
          type: "ADJUST",
          role: "lead",
          positionInstanceId: spent.players.lead.hand[0]!.instanceId,
        },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "POSITION_LIMIT" } });
  });

  it("closes the opening pair once the hold has filled the floor", () => {
    let state = onFloor(null);
    setHand(state, "lead", ["pos_001", "mov_002"]);
    const [position, move] = state.players.lead.hand;
    state = applyOk(state, {
      type: "ADJUST",
      role: "lead",
      positionInstanceId: position!.instanceId,
    });
    expect(
      applyAction(
        state,
        {
          type: "PLAY_OPEN",
          role: "lead",
          positionInstanceId: position!.instanceId,
          moveInstanceId: move!.instanceId,
        },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "DANCE_ALREADY_OPEN" } });
    expect(
      snapshotFor(state, "lead", content).legalActions.some(
        (action) => action.type === "PLAY_OPEN",
      ),
    ).toBe(false);
  });

  it("offers the hold for every Position in hand and publishes its refusal", () => {
    const state = onFloor("pos_001");
    setHand(state, "lead", ["pos_002", "pos_001", "mov_013"]);
    const [other, same, move] = state.players.lead.hand;
    const view = snapshotFor(state, "lead", content);
    expect(view.legalActions.filter((action) => action.type === "ADJUST")).toEqual([
      { type: "ADJUST", role: "lead", positionInstanceId: other!.instanceId },
    ]);
    expect(view.floorRefusals).toEqual([
      { instanceId: same!.instanceId, code: "SAME_POSITION" },
      { instanceId: move!.instanceId, code: "POSITION_MISMATCH" },
    ]);
  });
});
