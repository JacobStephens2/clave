import type { LogEntry, PlayerSnapshot, Role, Rung } from "@clave/engine";

/**
 * What changed between two snapshots the same device saw, read as moments of the dance
 * rather than as fields: a call made, answered, dropped or covered, the run of answered
 * calls growing or breaking, the rung an 8-count landed on, the campana coming in, the
 * cierre, and the scoreboard moving.
 *
 * Everything but one number comes from fields both roles see, so the Lead's snapshot and
 * the Follow's snapshot of the same step yield the same events and both devices can cue
 * the same moment. The wording is the renderer's job: an event says what happened, never
 * who the viewer is.
 */

/** The section of the song a card belongs to: the verse, or the montuno. */
type Section = NonNullable<PlayerSnapshot["currentSong"]>["section"];

/** The rung an 8-count ended on once it has ended. */
type LandedRung = Exclude<Rung, "pending">;

/** The step every event was read from: the key a cue and its toast are shown under. */
interface AtSequence {
  readonly sequence: number;
}

export type SnapshotEvent =
  /** A dancer said something instead of taking the song card's bonus. */
  | (AtSequence & {
      readonly kind: "call-made";
      readonly byRole: Role;
      readonly callId: string;
      readonly name: string | null;
      readonly ask: string | null;
      readonly style: number;
      /** The song card asked for this call: answering it pays the pocket as well. */
      readonly favoured: boolean;
      readonly sentence: string | null;
    })
  /** The call standing over an 8-count was met by a Move. */
  | (AtSequence & {
      readonly kind: "call-answered";
      readonly byRole: Role;
      readonly callId: string | null;
      readonly name: string | null;
      /** Everything the answer paid: the call, the pocket, and the afinque on top. */
      readonly style: number;
      readonly inPocket: boolean;
      readonly links: number;
      readonly afinqueBonus: number;
      readonly sentence: string | null;
    })
  /** The call standing over an 8-count went unanswered. */
  | (AtSequence & {
      readonly kind: "call-dropped";
      readonly byRole: Role;
      readonly callId: string | null;
      readonly name: string | null;
      /** The Connection the couple lost, from this game's own rules. */
      readonly connection: number;
      readonly sentence: string | null;
    })
  /** A Recovery card cleared the call instead: no Connection lost, the phrase stays clean. */
  | (AtSequence & {
      readonly kind: "call-covered";
      readonly byRole: Role;
      readonly callId: string | null;
      readonly name: string | null;
      /** The engine's own sentence, which names the Recovery card that covered. */
      readonly sentence: string | null;
    })
  /** One more answer in the run, with the Style the afinque added for it. */
  | (AtSequence & {
      readonly kind: "afinque-link";
      readonly links: number;
      readonly cap: number;
      readonly bonus: number;
    })
  /** The run of answered calls ended. A phrase ending clears it by rule, not by mistake. */
  | (AtSequence & {
      readonly kind: "afinque-break";
      readonly links: number;
      readonly atPhraseEnd: boolean;
    })
  /** An 8-count finished, on one rung of the ladder. */
  | (AtSequence & {
      readonly kind: "rung";
      readonly rung: LandedRung;
      readonly role: Role;
      readonly phrase: number;
      readonly count: number;
      readonly styleGained: number;
    })
  /** The song moved from the verse into the montuno: the campana comes in. */
  | (AtSequence & {
      readonly kind: "section-change";
      readonly from: Section;
      readonly to: Section;
      readonly phrase: number;
    })
  /** The song ended on a pose: the couple hit the cierre together. */
  | (AtSequence & {
      readonly kind: "cierre";
      readonly finalScore: number | null;
      readonly rating: string | null;
    })
  /** What moved on the couple's scoreboard: shared, so both devices read it the same. */
  | (AtSequence & {
      readonly kind: "score";
      readonly style: number;
      readonly connection: number;
      /** The engine's sentences for this step, in order, for the announcement. */
      readonly causes: readonly string[];
    })
  /**
   * The viewer's own practice money. The one viewer-relative event in the differ: it is
   * emitted on the device whose player earned or spent, and nowhere else.
   */
  | (AtSequence & { readonly kind: "practice-money"; readonly money: number });

/**
 * What this game prints for a call, read against the song card on screen. A call made as
 * an 8-count ends does not stand until the next one begins, so the options are the source
 * for it, not `view.call`: `favoured` is still the caller's own song card.
 */
function callCopy(
  view: PlayerSnapshot,
  callId: string,
): { name: string | null; ask: string | null; style: number; favoured: boolean } {
  const option = view.calls.find((entry) => entry.id === callId);
  if (option)
    return { name: option.name, ask: option.ask, style: option.style, favoured: option.favoured };
  const printed = view.rules.call?.options.find((entry) => entry.id === callId);
  return {
    name: printed?.name ?? null,
    ask: printed?.ask ?? null,
    style: printed?.style ?? 0,
    favoured: false,
  };
}

/** The sentences the engine logged for this step: public, polished, and in resolution order. */
function newSentences(
  previous: PlayerSnapshot,
  next: PlayerSnapshot,
  kinds: readonly LogEntry["kind"][],
): string[] {
  return next.log
    .filter((entry) => entry.sequence > previous.sequence && kinds.includes(entry.kind))
    .map((entry) => entry.message);
}

/**
 * Whether the step between these snapshots was a reset turn (UNDO_TURN) rather than a dance.
 * A reset rewinds the whole 8-count, so the pair reads like a dance running backwards, and
 * nothing about it is worth a cue. Any one of these is proof on its own: Style only ever
 * rises while a dance is played, the dance history only ever grows, and no legal step ever
 * hands the same player the same 8-count back.
 */
function isRewind(previous: PlayerSnapshot, next: PlayerSnapshot): boolean {
  if (next.shared.style < previous.shared.style) return true;
  if (next.danceHistory.length < previous.danceHistory.length) return true;
  const sameStep = next.activeRole === previous.activeRole && next.songIndex === previous.songIndex;
  if (!sameStep) return false;
  if (previous.phase === "lesson" && next.phase === "dance") return true;
  if (previous.turn.rung !== "pending" && next.turn.rung === "pending") return true;
  return next.turn.cardsPlayed < previous.turn.cardsPlayed;
}

/**
 * The moments between two snapshots, in the order the rules resolve them.
 *
 * Empty for the first snapshot a device sees (a reload or a resume walks into a dance
 * already in progress), for a snapshot of another game, for a reset turn, and for the
 * hot-seat handoff, which re-reads the same step for the other viewer.
 */
export function eventsBetween(
  previous: PlayerSnapshot | null,
  next: PlayerSnapshot,
): SnapshotEvent[] {
  if (!previous || previous.gameId !== next.gameId) return [];
  if (next.sequence <= previous.sequence) return [];
  if (isRewind(previous, next)) return [];

  const sequence = next.sequence;
  const events: SnapshotEvent[] = [];
  const callSentences = newSentences(previous, next, ["call"]);
  // A call answered and a call made back land in one step, in that order.
  const resolution = callSentences[0] ?? null;
  const madeSentence = callSentences.at(-1) ?? null;
  const standing = previous.call;
  const callRules = next.rules.call;
  // The 8-counts that finished in this step. The call a dance answered, dropped or made is
  // settled by the same step that records the combo, so one asks the other's question.
  const finished = next.danceHistory.slice(previous.danceHistory.length);
  const ended = finished.length > 0;
  const dancer = finished.at(-1)?.role ?? next.activeRole;

  if (next.turn.callCovered && !previous.turn.callCovered) {
    events.push({
      kind: "call-covered",
      sequence,
      byRole: next.activeRole,
      callId: standing?.callId ?? null,
      name: standing?.name ?? null,
      sentence: resolution,
    });
  }

  if (ended && next.turn.callAnswered) {
    const links = next.shared.afinque;
    const bonus = callRules?.afinqueBonus[links - 1] ?? 0;
    events.push({
      kind: "call-answered",
      sequence,
      byRole: dancer,
      callId: standing?.callId ?? null,
      name: standing?.name ?? null,
      style: next.turn.callStyle,
      inPocket: standing?.inPocket ?? false,
      links,
      afinqueBonus: bonus,
      sentence: resolution,
    });
    if (links > 0)
      events.push({ kind: "afinque-link", sequence, links, cap: next.afinque.cap, bonus });
  }

  if (ended && next.turn.callDropped) {
    events.push({
      kind: "call-dropped",
      sequence,
      byRole: dancer,
      callId: standing?.callId ?? null,
      name: standing?.name ?? null,
      // A stumble drops the call without the dropped call's own cost.
      connection: next.turn.stumbled ? 0 : (callRules?.missConnectionCost ?? 0),
      sentence: resolution,
    });
  }

  if (previous.shared.afinque > 0 && next.shared.afinque === 0) {
    events.push({
      kind: "afinque-break",
      sequence,
      links: previous.shared.afinque,
      atPhraseEnd: next.phrase.number !== previous.phrase.number || next.status === "completed",
    });
  }

  const made = next.turn.callMade;
  if (ended && made !== null) {
    const copy = callCopy(next, made);
    events.push({
      kind: "call-made",
      sequence,
      byRole: dancer,
      callId: made,
      name: copy.name,
      ask: copy.ask,
      style: copy.style,
      favoured: copy.favoured,
      sentence: madeSentence,
    });
  }

  for (const combo of finished) {
    if (combo.rung === "pending") continue;
    events.push({
      kind: "rung",
      sequence,
      rung: combo.rung,
      role: combo.role,
      phrase: combo.phrase,
      count: combo.count,
      styleGained: combo.styleGained,
    });
  }

  const from = previous.currentSong?.section;
  const to = next.currentSong?.section;
  if (from && to && from !== to)
    events.push({ kind: "section-change", sequence, from, to, phrase: next.phrase.number });

  // The cierre is the band's full stop: the song's last 8-count ended on a pose.
  if (next.status === "completed" && previous.status !== "completed") {
    const finish = next.danceHistory.at(-1)?.flourish;
    if (finish?.type === "flourish" && finish.pose)
      events.push({
        kind: "cierre",
        sequence,
        finalScore: next.finalScore,
        rating: next.rating?.name ?? null,
      });
  }

  const style = next.shared.style - previous.shared.style;
  const connection = next.shared.connection - previous.shared.connection;
  if (style || connection) {
    events.push({
      kind: "score",
      sequence,
      style,
      connection,
      causes: newSentences(previous, next, ["dance", "call", "score"]),
    });
  }

  const money = next.self.money - previous.self.money;
  if (money) events.push({ kind: "practice-money", sequence, money });

  return events;
}
