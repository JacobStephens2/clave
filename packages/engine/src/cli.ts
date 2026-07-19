import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { content, contentBytes } from "@clave/content";
import {
  applyEnvelopeAction,
  createEnvelope,
  createGame,
  snapshotFor,
  type GameAction,
} from "./index.js";

const terminal = createInterface({ input: stdin, output: stdout });
let envelope = createEnvelope(createGame({ seed: 20260718, content }), contentBytes);

console.log(
  "\nCLAVE · terminal table\nChoose a legal action by number. Ctrl-C leaves the dance.\n",
);

while (envelope.state.status === "setup" || envelope.state.status === "playing") {
  const role =
    envelope.state.status === "setup" ? envelope.state.setupRole : envelope.state.activeRole;
  const view = snapshotFor(envelope.state, role, content);
  console.log(
    `\n${role.toUpperCase()} · ${view.phase} · Count ${Math.max(0, view.songIndex + 1)}/16`,
  );
  console.log(
    `Connection ${view.shared.connection} · Style ${view.shared.style} · $${view.self.money}`,
  );
  console.log(
    `Hand: ${view.self.hand.map((entry, index) => `${index + 1}. ${entry.card.name}`).join(" · ")}`,
  );
  const actions = view.legalActions.filter(
    (action) => action.type !== "SIGNAL_CARD" && action.type !== "CLEAR_SIGNAL",
  );
  actions.forEach((action, index) => console.log(`${index + 1}) ${JSON.stringify(action)}`));
  const answer = Number.parseInt(await terminal.question("> "), 10);
  const action = actions[answer - 1] as GameAction | undefined;
  if (!action) {
    console.log("Choose one of the listed actions.");
    continue;
  }
  const result = applyEnvelopeAction(envelope, action, content);
  if (!result.ok) console.log(result.error.message);
  else envelope = result.envelope;
}

console.log(
  `\n${envelope.state.status.toUpperCase()} · ${envelope.state.finalScore ?? 0} points · ${envelope.state.rating ?? "Connection lost"}\n`,
);
terminal.close();
