import { useEffect, useRef, useState } from "react";
import type { PlayerSnapshot, Role } from "@clave/engine";
import { eventsBetween, type SnapshotEvent } from "../snapshot-events.js";
import { useSoundEffects, type SoundEffect, type SoundEffectOptions } from "./SoundEffects.js";

/** How many cues stay on screen at once, and how long each one stays. */
const VISIBLE = 2;
const DWELL = 2_500;

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");

/** A moment, dressed for this viewer: one line to read, one to hear. */
interface Cue {
  readonly id: number;
  readonly glyph: string;
  readonly title: string;
  readonly detail: string | null;
  readonly tone: "bright" | "soft" | "dim";
  readonly announcement: string;
}

/** Who did it, from this viewer's seat. */
function doer(view: PlayerSnapshot, role: Role, capital = true): string {
  if (role === view.viewerRole) return capital ? "You" : "you";
  return `${capital ? "The" : "the"} ${roleName(role)}`;
}

/**
 * The one cue a step is worth: the first moment in it that has a sound, taking the events
 * as the rules resolve them. A step can hold several moments — an answer, a link, a call
 * back — and they are one gesture, not a pile of sounds. A stumble keeps the cue it has
 * always had, played by the action, so the break rung adds nothing on top of it.
 */
function cueSound(events: readonly SnapshotEvent[]): [SoundEffect, SoundEffectOptions] | null {
  for (const event of events) {
    switch (event.kind) {
      case "cierre":
        return ["cierre", {}];
      case "section-change":
        if (event.to === "Montuno") return ["montuno", {}];
        break;
      case "call-dropped":
        return ["drop", {}];
      case "call-answered":
        // In the pocket: the song card asked for exactly that call. It sparkles.
        return [event.inPocket ? "perfect" : "answer", { links: event.links }];
      case "call-covered":
        return ["cover", {}];
      case "call-made":
        return ["call", {}];
      case "afinque-break":
        if (!event.atPhraseEnd && event.links > 1) return ["afinque-break", {}];
        break;
      default:
        break;
    }
  }
  return null;
}

/**
 * What one moment reads like on screen. Null for the everyday ones: a clean 8-count, the
 * scoreboard ticking over, a run of one link ending. The HUD and the phrase strip already
 * say those.
 */
function cueCopy(view: PlayerSnapshot, event: SnapshotEvent): Omit<Cue, "id"> | null {
  switch (event.kind) {
    case "call-made": {
      const name = event.name ?? "a call";
      return {
        glyph: "!",
        title: `${doer(view, event.byRole)} call${event.byRole === view.viewerRole ? "" : "s"} ${name}`,
        detail: [event.ask, event.favoured ? "★ in the pocket" : null].filter(Boolean).join(" · "),
        tone: "soft",
        announcement: `${doer(view, event.byRole)} call${event.byRole === view.viewerRole ? "" : "s"} ${name}: ${event.ask ?? ""} ${event.style} Style.`,
      };
    }
    case "call-answered": {
      const name = event.name ?? "The call";
      return {
        glyph: "★",
        title: `¡Eso! ${name} answered`,
        detail: [
          event.style ? `+${event.style} Style` : null,
          event.inPocket ? "★ in the pocket" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "bright",
        announcement: `${doer(view, event.byRole)} answered ${name}. +${event.style} Style.`,
      };
    }
    case "call-dropped":
      return {
        glyph: "~",
        title: "The call dropped",
        detail: event.connection ? `−${event.connection} Connection` : "the stumble took it",
        tone: "dim",
        announcement: `${doer(view, event.byRole)} dropped ${event.name ?? "the call"}.${
          event.connection ? ` −${event.connection} Connection.` : ""
        }`,
      };
    case "call-covered":
      return {
        glyph: "↺",
        // A cover over an 8-count that already answers the call throws the answer away: the
        // rung drops from Perfect to Recovered and the afinque breaks. That is no save.
        title: event.alreadyAnswered ? "That call was already answered" : "Nice save",
        detail: event.alreadyAnswered ? "the Style and the run go with it" : "the call is clear",
        tone: event.alreadyAnswered ? "dim" : "soft",
        // The viewer's own words, as every other moment here: the engine's sentence names the
        // Recovery card, but it names the dancer in the third person on their own device.
        announcement: `${doer(view, event.byRole)} covered ${event.name ?? "the call"}.`,
      };
    case "afinque-link":
      if (event.links < 2) return null;
      return {
        glyph: "•",
        title: `Afinque ×${event.links}`,
        detail: event.bonus ? `+${event.bonus} Style on top` : "keep it going",
        tone: "bright",
        announcement: `Afinque ${event.links} links.${event.bonus ? ` +${event.bonus} Style.` : ""}`,
      };
    case "afinque-break":
      if (event.atPhraseEnd || event.links < 2) return null;
      return {
        glyph: "·",
        title: `The run ends at ×${event.links}`,
        detail: null,
        tone: "dim",
        announcement: `The run of answered calls ends at ${event.links} links.`,
      };
    case "rung":
      if (event.rung !== "break") return null;
      return {
        glyph: "×",
        title: "A stumble — shake it off",
        detail: null,
        tone: "dim",
        announcement: `${doer(view, event.role)} stumbled on count ${event.count}.`,
      };
    case "section-change":
      if (event.to !== "Montuno") return null;
      return {
        glyph: "♪",
        title: "The campana comes in — montuno!",
        detail: null,
        tone: "bright",
        announcement: "The campana comes in. The montuno starts.",
      };
    case "cierre":
      return {
        glyph: "✦",
        title: "¡Cierre!",
        detail: "the band stops with you",
        tone: "bright",
        announcement: "The song ends on a pose. The band stops with you.",
      };
    default:
      return null;
  }
}

/**
 * Sound and a short line for every new moment in the dance, on whichever device the
 * snapshot arrives on. Both players hear the same call, the same answer and the same
 * campana; the wording is each viewer's own.
 */
export function SnapshotCues({ view }: { view: PlayerSnapshot | null }) {
  const { play } = useSoundEffects();
  const previous = useRef<PlayerSnapshot | null>(null);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);
  const [cues, setCues] = useState<readonly Cue[]>([]);
  // Held apart from the cues so that a cue fading out never re-announces the one before it.
  const [announcement, setAnnouncement] = useState("");

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!view) return;
    const events = eventsBetween(previous.current, view);
    previous.current = view;
    if (events.length === 0) return;

    const sound = cueSound(events);
    if (sound) play(sound[0], sound[1]);

    const fresh = events
      .map((event) => cueCopy(view, event))
      .filter((copy): copy is Omit<Cue, "id"> => copy !== null)
      .slice(0, VISIBLE)
      .map((copy) => ({ ...copy, id: nextId.current++ }));
    if (fresh.length === 0) return;

    setAnnouncement(fresh.map((cue) => cue.announcement).join(" "));
    setCues((current) => [...current, ...fresh].slice(-VISIBLE));
    for (const cue of fresh) {
      const timer = window.setTimeout(() => {
        timers.current = timers.current.filter((entry) => entry !== timer);
        setCues((current) => current.filter((entry) => entry.id !== cue.id));
      }, DWELL);
      timers.current.push(timer);
    }
  }, [play, view]);

  // The layer outlives the swap to the end screen, which has its own blocks to keep clear:
  // the stylesheet reads this to drop the toast below the headline and the final score.
  const screen =
    view && (view.status === "completed" || view.status === "lost" || view.status === "unresumable")
      ? "terminal"
      : "table";

  return (
    <div className="snapshot-cues" data-screen={screen}>
      <ul aria-hidden="true">
        {cues.map((cue) => (
          <li key={cue.id} className={`cue ${cue.tone}`}>
            <b>{cue.glyph}</b>
            <span>
              <strong>{cue.title}</strong>
              {cue.detail && <small>{cue.detail}</small>}
            </span>
          </li>
        ))}
      </ul>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
