import { useEffect, useRef, useState } from "react";
import type { PlayerSnapshot } from "@clave/engine";

export type ChoreographyMode = "position" | "move" | "flourish";

const fallbackCards: Record<ChoreographyMode, { name: string; note: string }> = {
  position: {
    name: "Open Position",
    note: "Partners mark the rhythm apart while keeping a light two-hand connection.",
  },
  move: {
    name: "Follow Right Turn",
    note: "The Lead marks in place while the Follow travels through a clockwise turn.",
  },
  flourish: {
    name: "Arm Overhead (Lead)",
    note: "The partnership keeps its basic while the Lead traces an overhead accent.",
  },
};

function liveCard(view: PlayerSnapshot, mode: ChoreographyMode) {
  if (mode === "position") return view.table.position?.card;
  if (mode === "move") return view.table.move?.card;
  return view.table.flourish?.card;
}

function Dancer({ role }: { role: "lead" | "follow" }) {
  return (
    <div className={`demo-dancer ${role}`} aria-hidden="true">
      <span className="dancer-head" />
      <span className="dancer-torso" />
      <span className="dancer-limb arm outside" />
      <span className="dancer-limb arm inside" />
      <span className="dancer-limb leg outside" />
      <span className="dancer-limb leg inside" />
      <small>{role}</small>
    </div>
  );
}

export function DancerDemo({ view, onClose }: { view: PlayerSnapshot; onClose: () => void }) {
  const initialMode: ChoreographyMode = view.table.flourish
    ? "flourish"
    : view.table.move
      ? "move"
      : "position";
  const [mode, setMode] = useState<ChoreographyMode>(initialMode);
  const activeCard = liveCard(view, mode) ?? fallbackCards[mode];

  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Read during the first render, before the table behind the dialog turns inert.
  const [returnFocus] = useState(() => document.activeElement);

  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [returnFocus]);

  return (
    <div className="dancer-demo-overlay" role="presentation" onClick={onClose}>
      <section
        className="dancer-demo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dancer-demo-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>Choreography prototype</small>
            <h2 id="dancer-demo-title">Watch the partnership</h2>
          </div>
          <button ref={closeButton} type="button" className="dancer-demo-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="choreography-tabs" role="tablist" aria-label="Dance demonstration">
          {(["position", "move", "flourish"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={mode === candidate}
              className={mode === candidate ? "selected" : ""}
              onClick={() => setMode(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
        <div
          key={mode}
          className="dancer-demo-stage"
          data-choreography={mode}
          role="img"
          aria-label={`Animated Lead and Follow demonstrating ${activeCard.name}`}
        >
          <div className="stage-halo one" aria-hidden="true" />
          <div className="stage-halo two" aria-hidden="true" />
          <div className="partner-connection" aria-hidden="true" />
          <Dancer role="lead" />
          <Dancer role="follow" />
          <div className="rhythm-counts" aria-hidden="true">
            <i>1</i>
            <i>2</i>
            <i>3</i>
            <i>5</i>
            <i>6</i>
            <i>7</i>
          </div>
        </div>
        <footer>
          <div>
            <small>{mode} sample</small>
            <strong>{activeCard.name}</strong>
          </div>
          <p>{"note" in activeCard ? activeCard.note : fallbackCards[mode].note}</p>
        </footer>
      </section>
    </div>
  );
}
