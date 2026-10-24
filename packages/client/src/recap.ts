import type { DanceComboView, PlayerSnapshot } from "@clave/engine";
import { isLadderRung, LADDER_RUNGS, RUNGS, type LadderRung } from "./rungs.js";

/**
 * The end-of-song recap, read from a terminal snapshot. Everything here is public —
 * the rung each 8-count ended on, the Style each phrase earned, how the calls went —
 * and every number comes from the snapshot, so a resumed game recaps its own rules.
 */

/** How many 8-counts ended on one rung, and how tall its bar stands beside the others. */
export interface RungTally {
  readonly rung: LadderRung;
  readonly label: string;
  readonly meaning: string;
  readonly count: number;
  /** This rung's share of the tallest one, 0–1. Decoration: the count carries the meaning. */
  readonly share: number;
}

/** One phrase of the song: how much of it was danced and what it paid. */
export interface PhraseTally {
  readonly phrase: number;
  readonly name: string;
  readonly counts: number;
  readonly style: number;
  /** The game's own phrase-scoring words ("clean +3, variety +1"), while the log holds them. */
  readonly bonuses: string | null;
}

/** The song's calls, counted from the rungs they ended on. */
export interface CallTally {
  /** Null when the log window no longer reaches the start of the song. */
  readonly made: number | null;
  readonly answered: number;
  readonly covered: number;
  readonly dropped: number | null;
  /** The longest run of answered calls — the afinque the couple built up. */
  readonly longestRun: number;
  readonly runCap: number;
}

/** One line of the score breakdown. */
export interface RecapLine {
  readonly label: string;
  readonly value: number;
  readonly detail: string | null;
}

export interface SongRecap {
  readonly outcome: "completed" | "lost";
  readonly eyebrow: string;
  readonly headline: string;
  readonly blurb: string;
  /** One sentence for the screen reader when the recap arrives. */
  readonly announcement: string;
  readonly illustration: { readonly src: string; readonly alt: string };
  readonly score: number;
  readonly style: number;
  readonly connection: number;
  readonly rating: {
    readonly name: string;
    readonly description: string;
    /** Where that rating sits on this game's ladder, e.g. "Rating 2 of 6". */
    readonly place: string;
  } | null;
  readonly countsDanced: number;
  readonly songLength: number;
  /** The 8-count of the song a lost dance ended on; null when the song was danced out. */
  readonly endedOn: number | null;
  readonly ladder: readonly RungTally[];
  /** The lines that add up to the final score. */
  readonly breakdown: readonly RecapLine[];
  readonly phrases: readonly PhraseTally[];
  /** Null when this game's content prints no calls. */
  readonly calls: CallTally | null;
  /** Song-card bonuses that landed, or null when the log no longer reaches the start. */
  readonly songMoments: number | null;
  /** The 8-count that paid the most Style, with its place in the song. */
  readonly highlight: { readonly entry: DanceComboView; readonly songCount: number } | null;
}

/** The engine's own words for a dropped call, which is the only way to count drops. */
const DROPPED_CALL = "The call drops";

const phraseName = (phrase: number) => (phrase === 1 ? "Cuerpo" : "Montuno");

/** The 8-count's place in the whole song, counting from the first count of the cuerpo. */
const songCountOf = (entry: DanceComboView, phraseLength: number) =>
  (entry.phrase - 1) * phraseLength + entry.count;

/**
 * Whether the published log still reaches the start of the song. The snapshot carries a
 * window of the log, and a long game can push its first 8-counts out of it.
 */
const logReachesStart = (view: PlayerSnapshot) => view.log.some((entry) => entry.sequence === 0);

function ladderTally(history: readonly DanceComboView[]): RungTally[] {
  const counts: Record<LadderRung, number> = {
    perfect: 0,
    clean: 0,
    awkward: 0,
    recovered: 0,
    break: 0,
  };
  for (const entry of history) if (isLadderRung(entry.rung)) counts[entry.rung] += 1;
  const tallest = Math.max(1, ...Object.values(counts));
  return LADDER_RUNGS.map((rung) => ({
    rung,
    label: RUNGS[rung].word,
    meaning: RUNGS[rung].meaning,
    count: counts[rung],
    share: counts[rung] / tallest,
  }));
}

/**
 * The game's own phrase-scoring sentence, logged as "Phrase 1: clean +3, variety +1." —
 * the numbers stay the game's. Null once the log window has moved past it.
 */
function phraseScoring(view: PlayerSnapshot, phrase: number): string | null {
  const prefix = `Phrase ${phrase}: `;
  const line = view.log.find(
    (entry) => entry.kind === "score" && entry.role === null && entry.message.startsWith(prefix),
  );
  return line ? line.message.slice(prefix.length).replace(/\.$/, "") : null;
}

function phraseTallies(view: PlayerSnapshot): PhraseTally[] {
  const danced = [...new Set(view.danceHistory.map((entry) => entry.phrase))].sort(
    (left, right) => left - right,
  );
  return danced.map((phrase) => {
    const entries = view.danceHistory.filter((entry) => entry.phrase === phrase);
    return {
      phrase,
      name: phraseName(phrase),
      counts: entries.length,
      style: entries.reduce((total, entry) => total + entry.styleGained, 0),
      bonuses: phraseScoring(view, phrase),
    };
  });
}

/**
 * Log lines belonging to 8-counts that are still in the history: a turn the couple reset
 * leaves its lines in the log, but its 8-count is gone, and both carry the same sequence.
 */
function countLogLines(
  view: PlayerSnapshot,
  danced: ReadonlySet<number>,
  matches: (entry: PlayerSnapshot["log"][number]) => boolean,
): number {
  return view.log.filter((entry) => danced.has(entry.sequence) && matches(entry)).length;
}

function callTally(view: PlayerSnapshot, complete: boolean): CallTally | null {
  if (!view.rules.call) return null;
  // Every answered call ends on Perfect and every covered one on Recovered, so the ladder
  // counts them exactly. Only a drop shares its rung (Awkward) with dancing no Move at all.
  const answered = view.danceHistory.filter((entry) => entry.rung === "perfect").length;
  const covered = view.danceHistory.filter((entry) => entry.rung === "recovered").length;
  const unanswered = new Set(
    view.danceHistory
      .filter((entry) => entry.rung === "awkward" || entry.rung === "break")
      .map((entry) => entry.sequence),
  );
  const dropped = complete
    ? countLogLines(
        view,
        unanswered,
        (entry) => entry.kind === "call" && entry.message.startsWith(DROPPED_CALL),
      )
    : null;
  return {
    // Every call made stands over the next 8-count and resolves there, so the three add up.
    made: dropped === null ? null : answered + covered + dropped,
    answered,
    covered,
    dropped,
    longestRun: view.danceHistory.reduce(
      (longest, entry) => Math.max(longest, entry.afinqueAfter),
      0,
    ),
    runCap: view.afinque.cap,
  };
}

/** The 8-count that paid the most Style; ties go to the later one, the one still ringing. */
function highlightOf(view: PlayerSnapshot, phraseLength: number): SongRecap["highlight"] {
  let best: DanceComboView | null = null;
  for (const entry of view.danceHistory)
    if (entry.styleGained > 0 && (!best || entry.styleGained >= best.styleGained)) best = entry;
  return best ? { entry: best, songCount: songCountOf(best, phraseLength) } : null;
}

function ratingPlace(view: PlayerSnapshot): SongRecap["rating"] {
  if (!view.rating) return null;
  const ladder = [...view.rules.ratings].sort((left, right) => left.minimum - right.minimum);
  const place = ladder.findIndex((rating) => rating.name === view.rating?.name);
  return {
    name: view.rating.name,
    description: view.rating.description,
    place: place < 0 ? "" : `Rating ${place + 1} of ${ladder.length}`,
  };
}

/**
 * The recap of a finished song, or null while there is nothing to recap — a dance still
 * going, or a saved game this release cannot read, which has its own screen.
 */
export function readSongRecap(view: PlayerSnapshot): SongRecap | null {
  if (view.status !== "completed" && view.status !== "lost") return null;
  const completed = view.status === "completed";
  const complete = logReachesStart(view);
  const phraseLength = Math.max(1, view.rules.phraseLength);
  const score = view.finalScore ?? view.shared.style + view.shared.connection;
  const last = view.danceHistory.at(-1);
  const endedOn = completed || !last ? null : songCountOf(last, phraseLength);
  const countStyle = view.danceHistory.reduce((total, entry) => total + entry.styleGained, 0);
  // What the 8-counts never paid: the phrase bonuses, which land after an 8-count is recorded.
  const phraseStyle = Math.max(0, view.shared.style - countStyle);
  const rating = ratingPlace(view);
  const danced = new Set(view.danceHistory.map((entry) => entry.sequence));
  const songMoments = complete
    ? countLogLines(view, danced, (entry) => entry.kind === "score" && entry.role !== null)
    : null;
  const headline = completed ? (rating?.name ?? "The whole song") : "The dance ends here";

  return {
    outcome: completed ? "completed" : "lost",
    eyebrow: completed
      ? "You danced the whole song"
      : endedOn === null
        ? "The connection slipped"
        : `The connection slipped on 8-count ${endedOn} of ${view.rules.songLength}`,
    headline,
    blurb: completed
      ? (rating?.description ?? "You danced it all the way to the last count.")
      : "Mistakes are part of the dance. Take a breath, find each other, and play the song again.",
    // "Final score" belongs to the circle on screen; the spoken line says it in words.
    announcement: completed
      ? `You danced the whole song. ${headline}, with ${score} points.`
      : `The connection ran out${endedOn === null ? "" : ` on 8-count ${endedOn}`}. You scored ${score} points.`,
    illustration: completed
      ? {
          src: "/art/finale-complete.webp",
          alt: "The couple finish the song arms up, laughing, the house band playing behind them.",
        }
      : {
          src: "/art/finale-lost.webp",
          alt: "The couple laugh and reach for each other's hands again, the band still playing.",
        },
    score,
    style: view.shared.style,
    connection: view.shared.connection,
    rating,
    countsDanced: view.danceHistory.length,
    songLength: view.rules.songLength,
    endedOn,
    ladder: ladderTally(view.danceHistory),
    breakdown: [
      { label: "Danced in the 8-counts", value: countStyle, detail: "Style" },
      { label: "Phrase bonuses", value: phraseStyle, detail: "Style" },
      {
        label: "Connection kept",
        value: view.shared.connection,
        detail: completed ? "adds to the score" : "it ran out",
      },
    ],
    phrases: phraseTallies(view),
    calls: callTally(view, complete),
    songMoments,
    highlight: highlightOf(view, phraseLength),
  };
}
