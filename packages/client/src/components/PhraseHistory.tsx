import { useEffect, useMemo, useState } from "react";
import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { DanceComboView, PlayerSnapshot, Role } from "@clave/engine";
import { RUNGS } from "../rungs.js";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
const phraseName = (phrase: number) => (phrase === 1 ? "Cuerpo" : "Montuno");

/** The rung, the Style it earned, and the chain it left, as a screen reader hears it. */
function rungSentence(entry: DanceComboView): string {
  return [
    `${RUNGS[entry.rung].said}.`,
    entry.styleGained > 0 ? `+${entry.styleGained} Style.` : null,
    entry.afinqueAfter > 0
      ? `Afinque ${entry.afinqueAfter} ${entry.afinqueAfter === 1 ? "link" : "links"}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The rung mark, with the afinque links it left as dots beside it. */
function RungMark({ entry }: { entry: DanceComboView }) {
  const rung = RUNGS[entry.rung];
  return (
    <span className={`combo-rung ${entry.rung}`} title={rung.word}>
      <b aria-hidden="true">{rung.glyph}</b>
      <span aria-hidden="true">{rung.word}</span>
      {entry.afinqueAfter > 0 && (
        <i className="combo-links" aria-hidden="true">
          {"•".repeat(entry.afinqueAfter)}
        </i>
      )}
    </span>
  );
}

function ComboThumbnail({
  card,
  type,
  onInspect,
}: {
  card: DanceCardDefinition | null;
  type: "move" | "position" | "flourish";
  onInspect: (card: DanceCardDefinition) => void;
}) {
  const shortType = type === "move" ? "M" : type === "position" ? "P" : "F";
  if (!card)
    return (
      <span className={`combo-thumbnail empty ${type}`} aria-hidden="true">
        {shortType}
      </span>
    );

  return (
    <button
      type="button"
      className={`combo-thumbnail ${type}`}
      title={`${type[0]!.toUpperCase()}${type.slice(1)} · ${card.name}`}
      aria-label={`${type}, ${card.name}. View card.`}
      onClick={() => onInspect(card)}
    >
      <img src={`/card-art/${card.id}.webp`} alt="" draggable={false} />
      <span aria-hidden="true">{shortType}</span>
    </button>
  );
}

/** One 8-count in a sentence, e.g. "Lead danced Follow Right Turn, Open Position". */
export function comboSummary(entry: DanceComboView): string {
  if (entry.outcome === "stumble") return `${roleName(entry.role)} stumbled`;
  if (entry.outcome === "basic") {
    const where = entry.endingPosition ?? "position";
    // A Position alone is the hold, not the basic: it is the play that gave up the song bonus.
    if (entry.hold === "taken") return `${roleName(entry.role)} took the hold in ${where}`;
    if (entry.hold === "adjusted") return `${roleName(entry.role)} adjusted the hold to ${where}`;
    return `${roleName(entry.role)} danced the basic in ${where}`;
  }
  const cards = [entry.move?.name, entry.position?.name, entry.flourish?.name].filter(Boolean);
  return `${roleName(entry.role)} danced ${cards.join(", ")}`;
}

function ComboSlot({
  count,
  entry,
  current,
  latest,
  onInspect,
}: {
  count: number;
  entry: DanceComboView | undefined;
  current: boolean;
  latest: boolean;
  onInspect: (card: DanceCardDefinition) => void;
}) {
  const state = entry?.outcome ?? (current ? "current" : "future");
  const label = entry
    ? `8-count ${count}. ${comboSummary(entry)}. ${rungSentence(entry)}`
    : current
      ? `8-count ${count}. Building on the floor now.`
      : `8-count ${count}. Not danced yet.`;
  const footer = entry
    ? entry.outcome === "stumble"
      ? null
      : entry.outcome === "basic"
        ? `${entry.hold ? "Hold" : "Basic"} · ${entry.endingPosition ?? "Position"}`
        : (entry.move?.name ?? "Dance")
    : current
      ? "On the floor"
      : "—";

  return (
    <article
      className={`phrase-combo ${state} ${latest ? "latest" : ""}`}
      aria-label={label}
      data-count={count}
      data-outcome={state}
    >
      <header>
        <strong>{String(count).padStart(2, "0")}</strong>
        {entry ? <span className={`combo-role ${entry.role}`}>{roleName(entry.role)}</span> : null}
      </header>
      {entry?.outcome === "stumble" ? (
        <div className="combo-stumble" aria-hidden="true">
          <span>×</span>
          <small>Reset</small>
        </div>
      ) : (
        <div className="combo-card-row">
          <ComboThumbnail card={entry?.move ?? null} type="move" onInspect={onInspect} />
          <ComboThumbnail card={entry?.position ?? null} type="position" onInspect={onInspect} />
          <ComboThumbnail card={entry?.flourish ?? null} type="flourish" onInspect={onInspect} />
        </div>
      )}
      <div className="combo-footer">
        {entry && <RungMark entry={entry} />}
        {footer && (
          <p title={footer} aria-hidden="true">
            {footer}
          </p>
        )}
      </div>
    </article>
  );
}

export function PhraseHistory({
  view,
  onInspect,
}: {
  view: PlayerSnapshot;
  onInspect: (card: DanceCardDefinition) => void;
}) {
  const [selectedPhrase, setSelectedPhrase] = useState(view.phrase.number);
  const phrases = view.phrase.number === 2 ? [1, 2] : [1];

  useEffect(() => setSelectedPhrase(view.phrase.number), [view.phrase.number]);

  const entries = useMemo(
    () => view.danceHistory.filter((entry) => entry.phrase === selectedPhrase),
    [selectedPhrase, view.danceHistory],
  );
  const entriesByCount = useMemo(
    () => new Map(entries.map((entry) => [entry.count, entry])),
    [entries],
  );
  const latestSequence = entries.reduce((latest, entry) => Math.max(latest, entry.sequence), 0);
  const currentCount = selectedPhrase === view.phrase.number ? view.phrase.count : null;

  return (
    <section
      className="phrase-history"
      aria-label={`Phrase choreography, ${phraseName(selectedPhrase)}, ${entries.length} of ${view.rules.phraseLength} 8-counts danced`}
    >
      <header className="phrase-history-heading">
        <div>
          <small>Phrase choreography</small>
          <strong>
            {phraseName(selectedPhrase)} · {entries.length}/{view.rules.phraseLength}
          </strong>
        </div>
        <span className="phrase-history-key">Move → Position → Flourish</span>
        {phrases.length > 1 ? (
          <div className="phrase-tabs" role="tablist" aria-label="Choose phrase">
            {phrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                role="tab"
                aria-selected={selectedPhrase === phrase}
                onClick={() => setSelectedPhrase(phrase)}
              >
                {phraseName(phrase)}
              </button>
            ))}
          </div>
        ) : (
          <span className="phrase-live-label">Live phrase</span>
        )}
      </header>
      <div className="phrase-history-scroll">
        <div className="phrase-history-track">
          {Array.from({ length: view.rules.phraseLength }, (_, index) => {
            const count = index + 1;
            const entry = entriesByCount.get(count);
            return (
              <ComboSlot
                key={`${selectedPhrase}-${count}`}
                count={count}
                entry={entry}
                current={currentCount === count}
                latest={Boolean(entry && entry.sequence === latestSequence)}
                onInspect={onInspect}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
