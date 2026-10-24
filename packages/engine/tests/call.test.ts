import { content, type ContentSet } from "@clave/content";
import { describe, expect, it } from "vitest";
import { applyAction, snapshotFor, type GameState } from "../src/index.js";
import { applyOk, readyGame, setHand } from "./helpers.js";

const callRules = content.rules.call!;
const styleOf = (callId: string) => callRules.options.find((option) => option.id === callId)!.style;

/** The content a game stored before the call was printed plays under. */
function withoutCalls(): ContentSet {
  const rules = { ...content.rules };
  delete rules.call;
  return { ...content, rules };
}

/** The Lead opens the floor from Open, dances `moveCardId`, calls `callId`, and hands over. */
function callStands(callId: string, moveCardId = "mov_002", seed = 42): GameState {
  let state = readyGame(seed);
  setHand(state, "lead", ["pos_001", moveCardId]);
  const [position, move] = state.players.lead.hand;
  state = applyOk(state, {
    type: "PLAY_OPEN",
    role: "lead",
    positionInstanceId: position!.instanceId,
    moveInstanceId: move!.instanceId,
  });
  state = applyOk(state, { type: "END_DANCE", role: "lead", callId });
  return applyOk(state, { type: "END_LESSON", role: "lead" });
}

/** The active player dances the first Move of `cardIds` their floor accepts. */
function danceMove(state: GameState, cardIds: string[]): GameState {
  const role = state.activeRole;
  setHand(state, role, cardIds);
  const move = state.players[role].hand[0]!;
  return applyOk(state, { type: "PLAY_MOVE", role, moveInstanceId: move.instanceId });
}

describe("the call and the answer · rulebook §7.1", () => {
  it("stands the Lead's call over the Follow's next 8-count instead of the song bonus", () => {
    const state = callStands("call_002");
    expect(state.call).toEqual({
      byRole: "lead",
      callId: "call_002",
      forSongIndex: 1,
      inPocket: false,
    });
    expect(state.activeRole).toBe("follow");
    expect(state.songIndex).toBe(1);
    // Count 1 pays +1 Connection for a Move worth 2 or less; calling gives that up.
    expect(state.shared.connection).toBe(content.rules.initialConnection);
    expect(state.turnDance.callMade).toBeNull();
    expect(state.log.some((entry) => entry.kind === "call")).toBe(true);
  });

  it("scores the call's Style when the answer meets it, and the pocket when the song asked", () => {
    let state = callStands("call_001");
    expect(state.call?.inPocket).toBe(true);
    const before = state.shared.style;
    state = danceMove(state, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state.turnDance.callAnswered).toBe(true);
    expect(state.turnDance.callStyle).toBe(styleOf("call_001") + callRules.inPocketStyle);
    // A 1-Style Move, count 2's own +1 Style from Open, and the call in the pocket.
    expect(state.shared.style - before).toBe(3);
    expect(state.turnDance.bonusStyle).toBe(1);
    expect(state.shared.afinque).toBe(1);
    expect(state.call).toBeNull();
  });

  it("drops the call when the 8-count does not meet it, costing the couple a Connection", () => {
    let state = callStands("call_005");
    const before = { ...state.shared };
    state = danceMove(state, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state.turnDance.callDropped).toBe(true);
    expect(state.turnDance.callAnswered).toBe(false);
    expect(state.shared.connection).toBe(before.connection - callRules.missConnectionCost);
    expect(state.phrase.droppedCall).toBe(true);
    expect(state.shared.afinque).toBe(0);
    expect(state.call).toBeNull();
  });

  it("drops the call when the answerer danced no Move at all", () => {
    let state = callStands("call_001");
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state.turnDance.callAnswered).toBe(false);
    expect(state.turnDance.callDropped).toBe(true);
    expect(state.shared.connection).toBe(content.rules.initialConnection - 1);
  });

  it("covers the call with a Recovery card: no Connection lost and the phrase stays clean", () => {
    let state = callStands("call_005");
    setHand(state, "follow", ["rec_001", "mov_002"]);
    const [recovery, move] = state.players.follow.hand;
    state = applyOk(state, {
      type: "COVER_CALL",
      role: "follow",
      recoveryInstanceId: recovery!.instanceId,
    });
    expect(state.call).toBeNull();
    expect(state.turnDance.callCovered).toBe(true);
    expect(state.shared.afinque).toBe(0);
    expect(state.players.follow.discardPile.some((entry) => entry.cardId === "rec_001")).toBe(true);
    // The dance step continues: the cover is not the end of the 8-count.
    state = applyOk(state, { type: "PLAY_MOVE", role: "follow", moveInstanceId: move!.instanceId });
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state.shared.connection).toBe(content.rules.initialConnection);
    expect(state.phrase.droppedCall).toBe(false);
    expect(state.turnDance.callDropped).toBe(false);
  });

  it("refuses to cover with a card that is not a Recovery, or with no call standing", () => {
    const standing = callStands("call_005");
    setHand(standing, "follow", ["mov_002"]);
    expect(
      applyAction(
        standing,
        {
          type: "COVER_CALL",
          role: "follow",
          recoveryInstanceId: standing.players.follow.hand[0]!.instanceId,
        },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "NOT_RECOVERY" } });

    const quiet = readyGame();
    setHand(quiet, "lead", ["rec_001"]);
    expect(
      applyAction(
        quiet,
        {
          type: "COVER_CALL",
          role: "lead",
          recoveryInstanceId: quiet.players.lead.hand[0]!.instanceId,
        },
        content,
      ),
    ).toMatchObject({ ok: false, error: { code: "NO_CALL_STANDING" } });
  });

  it("drops the standing call on a stumble without the dropped call's own cost", () => {
    let state = callStands("call_005");
    const before = state.shared.connection;
    state = applyOk(state, { type: "STUMBLE", role: "follow", recoveryInstanceId: null });
    expect(state.shared.connection).toBe(before - content.rules.stumble.defaultConnectionCost);
    expect(state.phrase.droppedCall).toBe(true);
    expect(state.call).toBeNull();
    expect(state.shared.afinque).toBe(0);
  });

  it("evaluates Echo me against the caller's Moves, not the answerer's own", () => {
    let state = callStands("call_004", "mov_002");
    state = danceMove(state, ["mov_002"]);
    const answered = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(answered.turnDance.callAnswered).toBe(true);

    let other = callStands("call_004", "mov_002");
    other = danceMove(other, ["mov_003"]);
    other = applyOk(other, { type: "END_DANCE", role: "follow" });
    expect(other.turnDance.callAnswered).toBe(false);
  });

  it("pays the Response song card for answering the call standing over you", () => {
    let state = readyGame(7);
    state.songIndex = 14;
    state.currentSongId = "song_015";
    state.phrase.number = 2;
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    state.call = { byRole: "follow", callId: "call_001", forSongIndex: 14, inPocket: false };
    state = danceMove(state, ["mov_002"]);
    const before = state.shared.style;
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    expect(state.turnDance.callAnswered).toBe(true);
    expect(state.turnDance.bonusStyle).toBe(4);
    expect(state.shared.style - before).toBe(4 + styleOf("call_001"));
  });

  it("offers the Response song card as soon as the dance answers the call", () => {
    let state = readyGame(7);
    state.songIndex = 14;
    state.currentSongId = "song_015";
    state.phrase.number = 2;
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    state.call = { byRole: "follow", callId: "call_001", forSongIndex: 14, inPocket: false };
    // Nothing is danced yet, so the call is unmet and the card is on offer for nothing.
    expect(snapshotFor(state, "lead", content).turn.songBonus).toBeNull();
    state = danceMove(state, ["mov_002"]);
    const view = snapshotFor(state, "lead", content);
    expect(view.call!.met).toBe(true);
    expect(view.turn.songBonus).toEqual({ style: 4, connection: 0 });
    // The same Move with no call standing answers nothing, so the card still pays nothing.
    const uncalled = { ...state, call: null };
    expect(snapshotFor(uncalled, "lead", content).turn.songBonus).toBeNull();
  });

  it("refuses a call with no floor to ask from, outside the window, or that no card prints", () => {
    const empty = readyGame();
    expect(
      applyAction(empty, { type: "END_DANCE", role: "lead", callId: "call_001" }, content),
    ).toMatchObject({ ok: false, error: { code: "NO_FLOOR" } });

    const phraseEnd = readyGame();
    phraseEnd.songIndex = 7;
    phraseEnd.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    expect(
      applyAction(phraseEnd, { type: "END_DANCE", role: "lead", callId: "call_001" }, content),
    ).toMatchObject({ ok: false, error: { code: "NO_CALL_WINDOW" } });

    const floor = readyGame();
    floor.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    expect(
      applyAction(floor, { type: "END_DANCE", role: "lead", callId: "call_099" }, content),
    ).toMatchObject({ ok: false, error: { code: "UNKNOWN_CALL" } });
    expect(
      applyAction(floor, { type: "END_DANCE", role: "lead", callId: "call_001" }, withoutCalls()),
    ).toMatchObject({ ok: false, error: { code: "NO_CALLS" } });
  });

  it("offers every call and every cover as a legal action, and only in their windows", () => {
    const standing = callStands("call_005");
    setHand(standing, "follow", ["rec_001", "mov_002"]);
    const view = snapshotFor(standing, "follow", content);
    const calls = view.legalActions.filter((action) => action.type === "END_DANCE");
    expect(calls.map((action) => action.type === "END_DANCE" && action.callId)).toEqual([
      null,
      ...callRules.options.map((option) => option.id),
    ]);
    expect(view.legalActions.filter((action) => action.type === "COVER_CALL")).toEqual([
      {
        type: "COVER_CALL",
        role: "follow",
        recoveryInstanceId: standing.players.follow.hand[0]!.instanceId,
      },
    ]);

    const phraseEnd = readyGame();
    phraseEnd.songIndex = 7;
    phraseEnd.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    setHand(phraseEnd, "lead", ["rec_001"]);
    const closed = snapshotFor(phraseEnd, "lead", content);
    expect(
      closed.legalActions.filter((action) => action.type === "END_DANCE" && action.callId !== null),
    ).toEqual([]);
    expect(closed.legalActions.filter((action) => action.type === "COVER_CALL")).toEqual([]);
  });

  it("loses the dance when a dropped call takes the last Connection, scoring no phrase", () => {
    let state = callStands("call_005");
    state.shared.connection = 1;
    state.shared.style = 9;
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state).toMatchObject({
      status: "lost",
      phase: "terminal",
      terminalReason: "Connection reached 0.",
      finalScore: 9,
      rating: null,
      checkpoint: null,
      call: null,
    });
    expect(state.shared.style).toBe(9);
    expect(state.danceHistory).toHaveLength(2);
  });

  it("clears the standing call when the song ends", () => {
    let state = readyGame(11);
    state.songIndex = 15;
    state.phrase.number = 2;
    state.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    state.call = { byRole: "follow", callId: "call_001", forSongIndex: 15, inPocket: false };
    state = danceMove(state, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    expect(state.status).toBe("completed");
    expect(state.call).toBeNull();
  });

  it("restores the call made and how the call over you resolved when the turn is reset", () => {
    const standing = callStands("call_005");
    let state = danceMove(standing, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "follow", callId: "call_001" });
    expect(state.call?.callId).toBe("call_001");
    expect(state.shared.connection).toBe(standing.shared.connection - 1);
    state = applyOk(state, { type: "UNDO_TURN", role: "follow" });
    expect(state.call).toEqual(standing.call);
    expect(state.shared).toEqual(standing.shared);
    expect(state.phase).toBe("dance");
  });
});

describe("afinque · rulebook §7.2", () => {
  /** Answer the call standing over you with a Move, then call `callId` yourself. */
  function answerAndCall(state: GameState, callId: string | null): GameState {
    const role = state.activeRole;
    const next = danceMove(state, ["mov_002"]);
    const ended = applyOk(next, { type: "END_DANCE", role, callId });
    if (ended.status !== "playing") return ended;
    return applyOk(ended, { type: "END_LESSON", role });
  }

  it("links answered calls and pays the table's bonus as the run grows", () => {
    let state = callStands("call_001");
    const links: number[] = [];
    const earned: number[] = [];
    for (let answer = 0; answer < 5; answer += 1) {
      const before = state.shared.style;
      state = answerAndCall(state, "call_001");
      links.push(state.shared.afinque);
      earned.push(state.shared.style - before);
    }
    expect(links).toEqual([1, 2, 3, 4, 5]);
    // Each answer is a 1-Style Move and a 0-Style call, the first one in the pocket; whatever
    // is left over is the afinque bonus for the link that answer reached.
    expect(
      earned.map((value, index) => value - 1 - (index === 0 ? callRules.inPocketStyle : 0)),
    ).toEqual(callRules.afinqueBonus);
  });

  it("caps the run at the length of the bonus table", () => {
    let state = callStands("call_001");
    // Counts 2 through 7: six answers in a row, one more than the table is long.
    for (let answer = 0; answer < 6; answer += 1) state = answerAndCall(state, "call_001");
    expect(state.songIndex).toBe(7);
    expect(state.shared.afinque).toBe(callRules.afinqueBonus.length);
  });

  it("breaks the run on a drop, a cover, a stumble, and an 8-count with no Move", () => {
    const dropped = applyOk(
      (() => {
        const state = callStands("call_005");
        state.shared.afinque = 3;
        return state;
      })(),
      { type: "END_DANCE", role: "follow" },
    );
    expect(dropped.shared.afinque).toBe(0);

    const covering = callStands("call_005");
    covering.shared.afinque = 3;
    setHand(covering, "follow", ["rec_001"]);
    expect(
      applyOk(covering, {
        type: "COVER_CALL",
        role: "follow",
        recoveryInstanceId: covering.players.follow.hand[0]!.instanceId,
      }).shared.afinque,
    ).toBe(0);

    const stumbling = callStands("call_005");
    stumbling.shared.afinque = 3;
    expect(
      applyOk(stumbling, { type: "STUMBLE", role: "follow", recoveryInstanceId: null }).shared
        .afinque,
    ).toBe(0);

    const quiet = readyGame();
    quiet.shared.afinque = 3;
    quiet.table.position = { instanceId: "floor-open", cardId: "pos_001", owner: "follow" };
    expect(applyOk(quiet, { type: "END_DANCE", role: "lead" }).shared.afinque).toBe(0);
  });

  it("leaves the run alone when a player says nothing and still dances", () => {
    let state = callStands("call_001");
    state = danceMove(state, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "follow" });
    expect(state.shared.afinque).toBe(1);
    state = applyOk(state, { type: "END_LESSON", role: "follow" });
    state = danceMove(state, ["mov_002"]);
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    expect(state.shared.afinque).toBe(1);
  });

  it("resets the run at the phrase ending", () => {
    let state = readyGame();
    state.songIndex = 7;
    state.shared.afinque = 4;
    state.phase = "lesson";
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    expect(state.phrase.number).toBe(2);
    expect(state.shared.afinque).toBe(0);
  });

  it("resets the run at the song's own ending, so the end screen shows no run", () => {
    let state = readyGame();
    state.songIndex = 15;
    state.shared.afinque = 4;
    state.phase = "lesson";
    state = applyOk(state, { type: "END_LESSON", role: "lead" });
    expect(state.status).toBe("completed");
    expect(state.shared.afinque).toBe(0);
  });
});

describe("what the snapshot publishes about the call", () => {
  it("publishes the standing call with the active player's progress towards it", () => {
    const standing = callStands("call_005");
    const quiet = snapshotFor(standing, "follow", content);
    expect(quiet.call).toEqual({
      byRole: "lead",
      callId: "call_005",
      name: "Stay close",
      ask: callRules.options.find((option) => option.id === "call_005")!.ask,
      style: styleOf("call_005"),
      inPocket: false,
      met: false,
    });
    // Stay close asks for a Closed floor, so the answer adjusts the hold and dances from it.
    setHand(standing, "follow", ["pos_002", "mov_013"]);
    const [position, move] = standing.players.follow.hand;
    const held = applyOk(standing, {
      type: "ADJUST",
      role: "follow",
      positionInstanceId: position!.instanceId,
    });
    const answering = applyOk(held, {
      type: "PLAY_MOVE",
      role: "follow",
      moveInstanceId: move!.instanceId,
    });
    expect(snapshotFor(answering, "follow", content).call?.met).toBe(true);
    expect(snapshotFor(answering, "lead", content).call).toEqual(
      snapshotFor(answering, "follow", content).call,
    );
  });

  it("publishes the call options with the song's favoured call marked", () => {
    const view = snapshotFor(callStands("call_001"), "follow", content);
    expect(view.calls).toEqual(
      callRules.options.map((option) => ({
        id: option.id,
        name: option.name,
        ask: option.ask,
        style: option.style,
        favoured: option.id === content.song.cards[1]!.favouredCall,
      })),
    );
    expect(view.calls.filter((option) => option.favoured)).toHaveLength(1);
  });

  it("publishes the afinque meter, the song bonus on offer, and the game's own call rules", () => {
    const state = callStands("call_001");
    state.shared.afinque = 2;
    const view = snapshotFor(state, "follow", content);
    expect(view.afinque).toEqual({
      links: 2,
      cap: callRules.afinqueBonus.length,
      nextBonus: callRules.afinqueBonus[2],
    });
    expect(view.turn.songBonus).toBeNull();
    expect(snapshotFor(danceMove(state, ["mov_002"]), "follow", content).turn.songBonus).toEqual({
      style: 1,
      connection: 0,
    });
    expect(view.rules.call).toEqual(callRules);
    expect(view.rules.phraseBonuses).toEqual(content.rules.phraseBonuses);
  });

  it("publishes no call at all to a game whose content prints none", () => {
    const callless = withoutCalls();
    const state = readyGame();
    const view = snapshotFor(state, "lead", callless);
    expect(view.call).toBeNull();
    expect(view.calls).toEqual([]);
    expect(view.afinque).toEqual({ links: 0, cap: 0, nextBonus: 0 });
    expect(view.rules.call).toBeNull();
    expect(view.legalActions.some((action) => action.type === "END_DANCE")).toBe(true);
  });
});
