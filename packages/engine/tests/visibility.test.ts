import { content } from "@clave/content";
import { describe, expect, it } from "vitest";
import { snapshotFor } from "../src/index.js";
import { readyGame } from "./helpers.js";

describe("visibility and signaling · rulebook §9", () => {
  it("exposes only the viewer's hand and neither deck order", () => {
    const state = readyGame();
    const snapshot = snapshotFor(state, "lead", content);
    expect(snapshot.self.hand.map((entry) => entry.instanceId)).toEqual(
      state.players.lead.hand.map((entry) => entry.instanceId),
    );
    expect(snapshot.partner.handCount).toBe(state.players.follow.hand.length);
    expect(JSON.stringify(snapshot)).not.toContain(state.players.follow.hand[0]!.instanceId);
    expect(snapshot.self).not.toHaveProperty("drawPile");
    expect(snapshot.partner).not.toHaveProperty("drawPile");
  });

  it("reveals exactly the signaled card", () => {
    const state = readyGame();
    state.signal = { role: "lead", instanceId: state.players.lead.hand[0]!.instanceId };
    const partner = snapshotFor(state, "follow", content);
    expect(partner.signal?.card.instanceId).toBe(state.signal.instanceId);
    expect(JSON.stringify(partner)).not.toContain(state.players.lead.hand[1]!.instanceId);
  });
});
