import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { content } from "@clave/content";

interface RulesContextValue {
  openRules: () => void;
}

const RulesContext = createContext<RulesContextValue | null>(null);

function RulesDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rules = content.rules;
  const songLength = content.song.cards.length;
  const phraseLength = songLength / 2;
  const starterSize = content.decks.starter.reduce((total, entry) => total + entry.count, 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="rules-dialog"
      aria-labelledby="rules-title"
      aria-describedby="rules-introduction"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="rules-sheet">
        <header className="rules-header">
          <div>
            <small>Clave rulebook</small>
            <h2 id="rules-title">How to dance the song</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close game rules">
            ×
          </button>
        </header>

        <div className="rules-body">
          <p className="rules-introduction" id="rules-introduction">
            Two players—Lead and Follow—cooperate through one salsa song. Build Style, protect your
            shared Connection, and finish all {songLength} 8-counts together.
          </p>

          <div className="rules-at-a-glance" aria-label="Game at a glance">
            <span>
              <strong>{songLength}</strong>
              8-counts
            </span>
            <span>
              <strong>{rules.initialConnection}</strong>
              starting Connection
            </span>
            <span>
              <strong>{rules.handSize}</strong>
              cards in hand
            </span>
            <span>
              <strong>Move → Position → Flourish</strong>
              normal play order
            </span>
          </div>

          <nav className="rules-nav" aria-label="Rulebook sections">
            {[
              ["rules-goal", "Goal"],
              ["rules-setup", "Setup"],
              ["rules-turn", "Your turn"],
              ["rules-cards", "Cards"],
              ["rules-song", "Song"],
              ["rules-lessons", "Lessons"],
              ["rules-partner", "Partner"],
              ["rules-scoring", "Finish"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() =>
                  dialogRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({
                    block: "start",
                  })
                }
              >
                {label}
              </button>
            ))}
          </nav>

          <section id="rules-goal">
            <span className="rules-section-number">01</span>
            <div>
              <h3>Win together</h3>
              <p>
                Style and Connection belong to both players. Finish the song with the strongest
                combined score you can. If Connection ever reaches 0, the dance ends immediately in
                a loss.
              </p>
            </div>
          </section>

          <section id="rules-setup">
            <span className="rules-section-number">02</span>
            <div>
              <h3>Choose your opening Position</h3>
              <ol>
                <li>Choose Lead and Follow. The Lead takes the first turn.</li>
                <li>Each player begins with a {starterSize}-card starter deck.</li>
                <li>
                  Each player shuffles their full starter deck and draws {rules.handSize} cards. The
                  floor starts empty; the Lead chooses the first Position from their hand.
                </li>
                <li>
                  If your hand has no matching Position and Move, you may mulligan your entire hand
                  once.
                </li>
              </ol>
              <p>
                Start at {rules.initialConnection} Connection, {rules.initialStyle} Style, and $
                {rules.startingMoney} each.
              </p>
            </div>
          </section>

          <section id="rules-turn">
            <span className="rules-section-number">03</span>
            <div>
              <h3>Your turn is one 8-count</h3>
              <ol className="rules-turn-list">
                <li>
                  <strong>Hear the music.</strong> Gain ${rules.incomePerTurn} and reveal the next
                  song moment. Its condition can award a bonus this turn.
                </li>
                <li>
                  <strong>Dance.</strong> Play a Move matching the current Position. You may then
                  play one Position as its destination and one matching Flourish. If you use all
                  three, follow the floor order: Move → Position → Flourish.
                </li>
                <li>
                  <strong>Take a lesson.</strong> Optionally buy one card; it goes to your discard
                  pile, not directly to your hand.
                </li>
                <li>
                  <strong>Clean up.</strong> Discard every card remaining in your hand, then draw a
                  new hand of {rules.handSize}. You cannot keep cards between turns.
                </li>
              </ol>
              <aside>
                <strong>If the floor is empty</strong>
                <p>
                  At the start of the song, after a stumble, or at the start of phrase two, open
                  with a Position and a matching Move together. In the app, stage the Position
                  first, then play its matching Move by dragging or using its card action.
                </p>
              </aside>
              <p>
                You may instead <strong>dance the basic</strong> and play nothing. Or stumble: lose{" "}
                {rules.stumble.defaultConnectionCost} Connection and clear the floor unless a
                Recovery card reduces the cost. A surviving stumble still continues to lessons and
                mandatory cleanup.
              </p>
            </div>
          </section>

          <section id="rules-cards">
            <span className="rules-section-number">04</span>
            <div>
              <h3>Read the cards</h3>
              <dl className="rules-card-types">
                <div>
                  <dt>Position</dt>
                  <dd>
                    Where the couple is—Open, Closed, Half-Open, or Half-Closed. Positions score no
                    Style and may change only immediately after your Move.
                  </dd>
                </div>
                <div>
                  <dt>Move</dt>
                  <dd>
                    The figure you dance. Its top edge lists every Position it accepts and the Style
                    it earns. A Move must match the Position already on the floor.
                  </dd>
                </div>
                <div>
                  <dt>Flourish</dt>
                  <dd>
                    Extra Style on the Move you played this turn. It must match the Position from
                    which that Move began.
                  </dd>
                </div>
                <div>
                  <dt>Recovery</dt>
                  <dd>Reduces the Connection lost when you choose to stumble.</dd>
                </div>
              </dl>
            </div>
          </section>

          <section id="rules-song">
            <span className="rules-section-number">05</span>
            <div>
              <h3>Follow the song</h3>
              <p>
                Llorarás is two phrases of {phraseLength} 8-counts: the Cuerpo, then the Montuno.
                Each song moment has a visible condition such as changing Position or playing a
                Flourish.
              </p>
              <p>At the end of each phrase, clear the floor and score:</p>
              <ul>
                <li>No stumbles: +{rules.phraseBonuses.clean} Style</li>
                <li>
                  Variety: +{rules.phraseBonuses.varietyPerExtraPosition} Style for each Position
                  danced from beyond the first
                </li>
                <li>Both partners flourished: +{rules.phraseBonuses.sharedFlair} Style</li>
                <li>Pose on the final 8-count: +{rules.phraseBonuses.poseFinish} Style</li>
              </ul>
            </div>
          </section>

          <section id="rules-lessons">
            <span className="rules-section-number">06</span>
            <div>
              <h3>Grow your decks</h3>
              <div className="rules-costs" aria-label="Lesson costs">
                <span>
                  Beginner <strong>${rules.lessonCosts.beginner}</strong>
                </span>
                <span>
                  Intermediate <strong>${rules.lessonCosts.intermediate}</strong>
                </span>
                <span>
                  Advanced <strong>${rules.lessonCosts.advanced}</strong>
                </span>
              </div>
              <p>
                Beginner cards are always available. Intermediate cards come from a face-up market.
                Advanced lessons open when the Montuno begins. Only one Intermediate or Advanced
                private lesson may be bought per Lead-and-Follow round; Beginner group lessons are
                unlimited.
              </p>
              <p>
                Once per phrase, you may also learn a free copy of a Move your partner played
                earlier in that phrase. Every learned card enters your discard pile.
              </p>
            </div>
          </section>

          <section id="rules-partner">
            <span className="rules-section-number">07</span>
            <div>
              <h3>Dance, don’t quarterback</h3>
              <p>
                Hands are private. Do not name, describe, or count your cards. You may talk about
                general intent—“let’s get to Closed”—and reveal one card from your hand as a signal
                on your turn.
              </p>
              <p>
                The digital <strong>Reset turn</strong> control restores the current turn to its
                beginning before it is handed to your partner.
              </p>
            </div>
          </section>

          <section id="rules-scoring">
            <span className="rules-section-number">08</span>
            <div>
              <h3>Finish the dance</h3>
              <p className="rules-equation">Final score = Style + remaining Connection</p>
              <div className="rules-ratings" aria-label="Performance ratings">
                {[...rules.ratings]
                  .sort((left, right) => left.minimum - right.minimum)
                  .map((rating, index, ratings) => {
                    const next = ratings[index + 1];
                    return (
                      <span key={rating.name}>
                        <strong>
                          {rating.minimum}
                          {next ? `–${next.minimum - 1}` : "+"}
                        </strong>
                        {rating.name}
                      </span>
                    );
                  })}
              </div>
            </div>
          </section>
        </div>

        <footer className="rules-footer">
          <span>Ready?</span>
          <button type="button" className="button gold" onClick={onClose}>
            Return to the dance
          </button>
        </footer>
      </article>
    </dialog>
  );
}

export function RulesProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openRules = useCallback(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  const closeRules = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);

  const value = useMemo(() => ({ openRules }), [openRules]);
  return (
    <RulesContext.Provider value={value}>
      {children}
      {open && <RulesDialog onClose={closeRules} />}
    </RulesContext.Provider>
  );
}

export function RulesButton({ compact = false }: { compact?: boolean }) {
  const rules = useContext(RulesContext);
  if (!rules) throw new Error("RulesButton must be used inside RulesProvider.");
  return (
    <button
      type="button"
      className={`rules-button ${compact ? "compact" : ""}`}
      onClick={rules.openRules}
      aria-haspopup="dialog"
      aria-label="How to play"
    >
      <span aria-hidden="true">?</span>
      <span>How to play</span>
    </button>
  );
}
