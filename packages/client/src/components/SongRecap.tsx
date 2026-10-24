import type { PlayerSnapshot } from "@clave/engine";
import { readSongRecap, type CallTally, type RungTally } from "../recap.js";
import { comboSummary } from "./PhraseHistory.js";

/** The illustrations are painted portrait; the attributes keep the panel from jumping. */
const ART_WIDTH = 768;
const ART_HEIGHT = 1152;

function RungRow({ tally, of }: { tally: RungTally; of: number }) {
  return (
    <li className="song-recap-rung" data-rung={tally.rung} data-empty={tally.count === 0}>
      <strong>{tally.label}</strong>
      <b>{tally.count === 0 ? "none" : `${tally.count} of ${of}`}</b>
      <span className="song-recap-bar" aria-hidden="true">
        <i
          style={
            { "--share": String(tally.share) } as React.CSSProperties &
              Record<string, string | number>
          }
        />
      </span>
      <small>{tally.meaning}</small>
    </li>
  );
}

/** The call tally as chips; the two the log cannot always see are simply left out. */
function callChips(calls: CallTally) {
  return [
    calls.made === null ? null : { label: "called", value: calls.made },
    { label: "answered", value: calls.answered },
    { label: "covered", value: calls.covered },
    calls.dropped === null ? null : { label: "dropped", value: calls.dropped },
  ].filter((chip) => chip !== null);
}

/** The end of the song: what the couple danced, what it paid, and a painting of the moment. */
export function SongRecap({ view }: { view: PlayerSnapshot }) {
  const recap = readSongRecap(view);
  if (!recap) return null;
  const [cuerpo, montuno] = recap.phrases;
  const louder = cuerpo && montuno && montuno.style > cuerpo.style;

  return (
    <div className="song-recap" data-outcome={recap.outcome}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {recap.announcement}
      </p>
      <div className="song-recap-art">
        <img
          src={recap.illustration.src}
          alt={recap.illustration.alt}
          width={ART_WIDTH}
          height={ART_HEIGHT}
          decoding="async"
          draggable={false}
        />
      </div>

      <div className="song-recap-top">
        <header className="song-recap-head">
          <small>{recap.eyebrow}</small>
          <h2>{recap.headline}</h2>
          <p className="song-recap-blurb">{recap.blurb}</p>
        </header>
        <div className="song-recap-score">
          <div className="final-score">
            <span>{recap.score}</span>
            <small>final score</small>
          </div>
          <div className="song-recap-sums">
            <dl className="song-recap-breakdown">
              {recap.breakdown.map((line) => (
                <div key={line.label}>
                  <dt>
                    {line.label}
                    {line.detail && <small>{line.detail}</small>}
                  </dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
            </dl>
            {recap.rating?.place && <p className="song-recap-place">{recap.rating.place}</p>}
          </div>
        </div>
      </div>

      <div className="song-recap-panels">
        <section className="song-recap-panel" aria-labelledby="song-recap-ladder-title">
          <h3 id="song-recap-ladder-title">
            How the 8-counts ended
            <small>
              {recap.countsDanced} of {recap.songLength} danced
            </small>
          </h3>
          <ol className="song-recap-rungs">
            {recap.ladder.map((tally) => (
              <RungRow key={tally.rung} tally={tally} of={recap.countsDanced} />
            ))}
          </ol>
        </section>

        <div className="song-recap-column">
          <section className="song-recap-panel" aria-labelledby="song-recap-phrases-title">
            <h3 id="song-recap-phrases-title">The two phrases</h3>
            <dl className="song-recap-phrases">
              {recap.phrases.map((phrase) => (
                <div key={phrase.phrase}>
                  <dt>
                    {phrase.name}
                    <small>
                      {phrase.counts}/{view.rules.phraseLength} 8-counts
                    </small>
                    {phrase.bonuses && <span>phrase bonuses · {phrase.bonuses}</span>}
                  </dt>
                  <dd>
                    <b>{phrase.style}</b>
                    <small>Style</small>
                  </dd>
                </div>
              ))}
            </dl>
            {louder && (
              <p className="song-recap-note">The montuno got louder, just as it should.</p>
            )}
            {recap.songMoments !== null && recap.songMoments > 0 && (
              <p className="song-recap-note">
                Song-card bonuses landed · <b>{recap.songMoments}</b>
              </p>
            )}
          </section>

          {recap.calls && (
            <section className="song-recap-panel" aria-labelledby="song-recap-calls-title">
              <h3 id="song-recap-calls-title">The calls</h3>
              {recap.calls.made === 0 ? (
                <p className="song-recap-note">
                  Nobody called this song. Next time, ask your partner for something.
                </p>
              ) : (
                <>
                  <ul className="song-recap-chips">
                    {callChips(recap.calls).map((chip) => (
                      <li key={chip.label}>
                        <b>{chip.value}</b>
                        <span>{chip.label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="song-recap-note">
                    {recap.calls.longestRun > 0
                      ? `Longest afinque · ${recap.calls.longestRun} of ${recap.calls.runCap} answers in a row`
                      : "No two answers landed back to back — the afinque never caught."}
                  </p>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {recap.highlight && (
        <p className="song-recap-highlight">
          <small>Biggest 8-count</small>
          <strong>
            {String(recap.highlight.songCount).padStart(2, "0")} ·{" "}
            {comboSummary(recap.highlight.entry)}
          </strong>
          <b>+{recap.highlight.entry.styleGained} Style</b>
        </p>
      )}
    </div>
  );
}
