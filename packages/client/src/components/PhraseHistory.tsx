import { useEffect, useMemo, useState } from "react";
import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { DanceComboView, PlayerSnapshot, Role } from "@clave/engine";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
const phraseName = (phrase: number) => (phrase === 1 ? "Cuerpo" : "Montuno");

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

function comboSummary(entry: DanceComboView): string {
  if (entry.outcome === "stumble") return `${roleName(entry.role)} stumbled`;
  if (entry.outcome === "basic")
    return `${roleName(entry.role)} danced the basic in ${entry.endingPosition ?? "position"}`;
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
    ? `8-count ${count}. ${comboSummary(entry)}.`
    : current
      ? `8-count ${count}. Building on the floor now.`
      : `8-count ${count}. Not danced yet.`;
  const footer = entry
    ? entry.outcome === "stumble"
      ? "Stumble"
      : entry.outcome === "basic"
        ? `Basic · ${entry.endingPosition ?? "Position"}`
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
      <p title={footer}>{footer}</p>
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
