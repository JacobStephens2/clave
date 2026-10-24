import { content, type BonusCondition } from "@clave/content";
import { describe, expect, it } from "vitest";
import { bonusConditionMet } from "../src/index.js";
import { applyOk, readyGame } from "./helpers.js";

function qualify(state: ReturnType<typeof readyGame>, condition: BonusCondition): void {
  const index = state.songIndex;
  state.turnDance = {
    ...state.turnDance,
    moveCardId: "mov_005",
    moveStyle: 2,
    fromPosition: "Open",
  };
  state.table.position = { instanceId: "bonus-position", cardId: "pos_001", owner: "lead" };
  switch (condition.op) {
    case "moveStyleAtMost":
      state.turnDance.moveStyle = condition.value;
      break;
    case "moveStyleAtLeast":
      state.turnDance.moveStyle = condition.value;
      break;
    case "moveFrom":
      state.turnDance.fromPosition = condition.positions[0]!;
      break;
    case "flourishPlayed":
      state.turnDance.flourished = true;
      break;
    case "posePlayed":
      state.turnDance.flourished = true;
      state.turnDance.posePlayed = true;
      break;
    case "noPositionPlayed":
      state.turnDance.positionsPlayed = 0;
      break;
    case "samePositionAsPreviousMove":
      state.moveHistory.push({
        cardId: "mov_001",
        role: "follow",
        phrase: state.phrase.number,
        songIndex: index - 1,
        fromPosition: "Open",
      });
      break;
    case "endsInPosition":
      state.table.position.cardId = condition.position === "Closed" ? "pos_002" : "pos_001";
      break;
    case "positionChanged":
      state.turnDance.changedPosition = true;
      break;
    case "partnerPlayedMoveGame":
      state.moveHistory.push({
        cardId: "mov_005",
        role: "follow",
        phrase: 1,
        songIndex: Math.max(0, index - 1),
        fromPosition: "Open",
      });
      break;
    case "partnerPlayedMovePhrase":
      state.moveHistory.push({
        cardId: "mov_005",
        role: "follow",
        phrase: state.phrase.number,
        songIndex: index - 1,
        fromPosition: "Open",
      });
      break;
    case "cardsPlayedAtLeast":
      state.turnDance.cardsPlayed = condition.value;
      break;
    case "answeredCall":
      // The call the engine will resolve into `callAnswered` as this 8-count ends.
      state.call = { byRole: "follow", callId: "call_001", forSongIndex: index, inPocket: false };
      state.turnDance.callAnswered = true;
      break;
  }
}

describe("Llorarás song bonuses · rulebook §7", () => {
  for (const [index, song] of content.song.cards.entries()) {
    it(`${song.id} · ${song.title}`, () => {
      let state = readyGame(300 + index);
      state.songIndex = index;
      state.currentSongId = song.id;
      state.phrase.number = index < 8 ? 1 : 2;
      const branch = song.bonuses[0]!;
      qualify(state, branch.condition);
      expect(
        bonusConditionMet(branch.condition, { state, role: "lead", contentSet: content }),
      ).toBe(true);
      const before = { ...state.shared };
      state = applyOk(state, { type: "END_DANCE", role: "lead", callId: null });
      expect(state.shared.style - before.style).toBe(branch.effect.style);
      expect(state.shared.connection - before.connection).toBe(branch.effect.connection);
    });
  }

  // A stumble turns neither of the song card's faces. Count 5 asks for no Position card, which
  // a stumble leaves true: a stumble may only be declared before any card is played.
  for (const [index, song] of content.song.cards.entries()) {
    it(`${song.id} · ${song.title} · pays a stumble nothing`, () => {
      let state = readyGame(400 + index);
      state.songIndex = index;
      state.currentSongId = song.id;
      state.phrase.number = index < 8 ? 1 : 2;
      const before = { ...state.shared };
      state = applyOk(state, { type: "STUMBLE", role: "lead", recoveryInstanceId: null });
      expect(state.turnDance).toMatchObject({ bonusStyle: 0, bonusConnection: 0 });
      expect(state.shared.style).toBe(before.style);
      expect(state.shared.connection).toBe(
        before.connection - content.rules.stumble.defaultConnectionCost,
      );
    });
  }

  it("uses the Pose branch instead of also stacking the Flourish fallback on the big finish", () => {
    let state = readyGame(999);
    state.songIndex = 15;
    state.currentSongId = "song_016";
    state.phrase.number = 2;
    state.turnDance.flourished = true;
    state.turnDance.posePlayed = true;
    const before = state.shared.style;
    state = applyOk(state, { type: "END_DANCE", role: "lead", callId: null });
    expect(state.shared.style - before).toBe(7);
  });
});
