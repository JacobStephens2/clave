import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { snapshotFor } from "../src/index.js";
import { applyOk, readyGame } from "./helpers.js";

describe("visibility and signaling · rulebook §9", () => {
  it("exposes only the viewer's hand and neither deck order", () => {
    const state = readyGame();
    const discarded = state.players.lead.hand.shift()!;
    state.players.lead.discardPile.push(discarded);
    const snapshot = snapshotFor(state, "lead", content);
    expect(snapshot.self.hand.map((entry) => entry.instanceId)).toEqual(
      state.players.lead.hand.map((entry) => entry.instanceId),
    );
    expect(snapshot.self.discard.map((entry) => entry.instanceId)).toEqual([discarded.instanceId]);
    expect(snapshot.partner.handCount).toBe(state.players.follow.hand.length);
    expect(JSON.stringify(snapshot)).not.toContain(state.players.follow.hand[0]!.instanceId);
    expect(snapshot.self).not.toHaveProperty("drawPile");
    expect(snapshot.partner).not.toHaveProperty("drawPile");

    const partnerSnapshot = snapshotFor(state, "follow", content);
    expect(partnerSnapshot.partner.discardCount).toBe(1);
    expect(JSON.stringify(partnerSnapshot)).not.toContain(discarded.instanceId);
  });

  it("reveals exactly the signaled card", () => {
    const state = readyGame();
    state.signal = { role: "lead", instanceId: state.players.lead.hand[0]!.instanceId };
    const partner = snapshotFor(state, "follow", content);
    expect(partner.signal?.card.instanceId).toBe(state.signal.instanceId);
    expect(JSON.stringify(partner)).not.toContain(state.players.lead.hand[1]!.instanceId);
  });

  it("shows both players the same public phrase choreography without card instances", () => {
    let state = readyGame();
    state = applyOk(state, { type: "END_DANCE", role: "lead" });
    const lead = snapshotFor(state, "lead", content);
    const follow = snapshotFor(state, "follow", content);
    expect(lead.danceHistory).toEqual(follow.danceHistory);
    expect(lead.danceHistory).toEqual([
      expect.objectContaining({
        phrase: 1,
        count: 1,
        role: "lead",
        outcome: "basic",
        move: null,
        position: null,
        flourish: null,
      }),
    ]);
    expect(JSON.stringify(lead.danceHistory)).not.toContain("lead-");
  });
});
