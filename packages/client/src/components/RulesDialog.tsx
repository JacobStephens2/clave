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
import { RUNGS } from "../rungs.js";
import { useAppStore } from "../store.js";

/** The section a control may open the rulebook at. */
export const CALL_SECTION = "rules-call";

interface RulesContextValue {
  openRules: (section?: string) => void;
}

const RulesContext = createContext<RulesContextValue | null>(null);

function RulesDialog({ onClose, section }: { onClose: () => void; section: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // A dance on screen shows the numbers that game is being played with; the home screen shows
  // the numbers this app ships with. The snapshot publishes only some of them.
  const liveRules = useAppStore((state) => state.snapshot?.rules ?? null);
  const rules = content.rules;
  const phraseBonuses = liveRules?.phraseBonuses ?? rules.phraseBonuses;
  const ratings = liveRules?.ratings ?? rules.ratings;
  const lessonCosts = liveRules?.lessonCosts ?? rules.lessonCosts;
  const songLength = liveRules?.songLength ?? content.song.cards.length;
  const phraseLength = liveRules?.phraseLength ?? songLength / 2;
  // Null in a game stored before the call existed: that dance simply has no calls in it.
  const call = liveRules ? liveRules.call : (rules.call ?? null);
  const callOptions = call ? [...call.options].sort((left, right) => left.style - right.style) : [];
  const starterSize = content.decks.starter.reduce((total, entry) => total + entry.count, 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    if (section)
      dialog.querySelector<HTMLElement>(`#${section}`)?.scrollIntoView({ block: "start" });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [section]);

  // The five rungs in the order the rulebook prints them; `checkedAt` is the order the engine
  // tests them in, which is what the precedence line below reads out.
  const ladder: { rung: string; checkedAt: number; meaning: string }[] = [
    ...(call
      ? [
          {
            rung: RUNGS.perfect.word,
            checkedAt: 3,
            meaning: "A call stood over you and you answered it with a Move. Afinque gains a link.",
          },
        ]
      : []),
    {
      rung: RUNGS.clean.word,
      checkedAt: 5,
      meaning: call
        ? "You danced a Move with no call standing over you. Nothing breaks."
        : "You danced a Move this 8-count.",
    },
    {
      rung: RUNGS.awkward.word,
      checkedAt: 4,
      meaning: call
        ? `You danced no Move—the basic, or a hold alone—or the call over you dropped. Afinque breaks, and a dropped call costs ${call.missConnectionCost} Connection.`
        : "You danced no Move: the basic, or a hold alone.",
    },
    ...(call
      ? [
          {
            rung: RUNGS.recovered.word,
            checkedAt: 2,
            meaning:
              "You covered the call over you with a Recovery card. No Connection lost; afinque breaks.",
          },
        ]
      : []),
    {
      rung: RUNGS.break.word,
      checkedAt: 1,
      meaning:
        "You stumbled. The floor clears and Connection drops, unless a Recovery card softens it.",
    },
  ];
  const precedence = [...ladder].sort((left, right) => left.checkedAt - right.checkedAt);
  // Null on a live snapshot means that game sends every lesson to the discard pile, which is
  // how every game stored before the call plays — so the live value wins even when it is null.
  const toTop = liveRules ? liveRules.lessonToDrawTop : (rules.lessonToDrawTop ?? null);
  const privateLessonsToTop = Boolean(toTop?.intermediate || toTop?.advanced);

  const sections: { id: string; label: string; heading: string; body: ReactNode }[] = [
    {
      id: "rules-goal",
      label: "Goal",
      heading: "Win together",
      body: (
        <p>
          Style and Connection belong to both players. Finish the song with the strongest combined
          score you can. If Connection ever reaches 0, the dance ends immediately in a loss.
        </p>
      ),
    },
    {
      id: "rules-setup",
      label: "Setup",
      heading: "Choose your opening Position",
      body: (
        <>
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
        </>
      ),
    },
    {
      id: "rules-turn",
      label: "Your turn",
      heading: "Your turn is one 8-count",
      body: (
        <>
          <ol className="rules-turn-list">
            <li>
              <strong>Hear the music.</strong> Gain ${rules.incomePerTurn} and reveal the next song
              moment. Its condition can award a bonus this turn.
            </li>
            <li>
              <strong>Dance.</strong> Play a Move matching the current Position. You may then play
              one Position as its destination and one matching Flourish. If you use all three,
              follow the floor order: Move → Position → Flourish.
            </li>
            {call ? (
              <li>
                <strong>Say something.</strong> As your dance step ends, take the song moment’s
                bonus—or make a call for your partner’s next 8-count instead.
              </li>
            ) : null}
            <li>
              <strong>Take a lesson.</strong>{" "}
              {privateLessonsToTop
                ? "Optionally buy one card. A group class goes to your discard pile; a private lesson goes on top of your draw pile."
                : "Optionally buy one card; it goes to your discard pile, not directly to your hand."}
            </li>
            <li>
              <strong>Clean up.</strong> Discard every card remaining in your hand, then draw a new
              hand of {rules.handSize}. You cannot keep cards between turns.
            </li>
          </ol>
          <aside>
            <strong>If the floor is empty</strong>
            <p>
              At the start of the song, after a stumble, or at the start of phrase two, open with a
              Position and a matching Move together. In the app, stage the Position first, then play
              its matching Move by dragging or using its card action.
            </p>
          </aside>
          <p>
            You may instead <strong>dance the basic</strong> and play nothing. Or stumble: lose{" "}
            {rules.stumble.defaultConnectionCost} Connection and clear the floor unless a Recovery
            card reduces the cost. A surviving stumble still continues to lessons and mandatory
            cleanup.
          </p>
        </>
      ),
    },
    {
      id: "rules-cards",
      label: "Cards",
      heading: "Read the cards",
      body: (
        <dl className="rules-card-types">
          <div>
            <dt>Position</dt>
            <dd>
              Where the couple is—Open, Closed, Half-Open, or Half-Closed. Positions score no Style
              and may change only immediately after your Move, or as the hold.
            </dd>
          </div>
          <div>
            <dt>Move</dt>
            <dd>
              The figure you dance. Its top edge lists every Position it accepts and the Style it
              earns. A Move must match the Position already on the floor.
            </dd>
          </div>
          <div>
            <dt>Flourish</dt>
            <dd>
              Extra Style on the Move you played this turn. It must match the Position from which
              that Move began.
            </dd>
          </div>
          <div>
            <dt>Recovery</dt>
            <dd>
              Reduces the Connection lost when you choose to stumble
              {call ? ", and covers a call you cannot answer" : ""}.
            </dd>
          </div>
        </dl>
      ),
    },
    {
      id: "rules-hold",
      label: "The hold",
      heading: "Take the hold",
      body: (
        <>
          <p>
            Before you have played anything this 8-count, you may play one Position card. On an
            empty floor you <strong>take the hold</strong>—the couple connects there. On an
            established floor you <strong>adjust the hold</strong>—your Position replaces it, and it
            must be a different one.
          </p>
          <p>
            Either way the hold gives up this 8-count’s song bonus, and the card counts toward your
            two Positions. You may still dance a Move from the new position, transition, and
            flourish{call ? ", and you may still make a call" : ""}.
          </p>
          <aside>
            <strong>Nothing in hand matches?</strong>
            <p>
              The hold is the way out: set a room you can dance in instead of stumbling. Opening
              with a Position and a matching Move together is still the stronger play.
            </p>
          </aside>
        </>
      ),
    },
    ...(call
      ? [
          {
            id: CALL_SECTION,
            label: "The call",
            heading: "Call and answer",
            body: (
              <>
                <p>
                  As your dance step ends—never on a stumble—you may name one of these calls instead
                  of taking the song moment’s bonus. Your call stands over your partner’s next
                  8-count. If the song’s condition went unmet, calling costs you nothing.
                </p>
                <p>
                  Each call asks your partner for one thing, and every call needs a Move: the basic
                  never answers one.
                </p>
                <dl className="rules-call-list">
                  {callOptions.map((option) => (
                    <div key={option.id}>
                      <dt>
                        {option.name}
                        <span>{option.style} Style</span>
                      </dt>
                      <dd>{option.ask}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  An answer scores the call’s Style, the afinque bonus, and{" "}
                  <strong>+{call.inPocketStyle} Style in the pocket</strong> if you called the one
                  the song moment marks with a star <span aria-hidden="true">★</span>—you asked for
                  exactly what the music was asking for.
                </p>
                <aside>
                  <strong>When you may call</strong>
                  <p>
                    Someone has to be on the floor when your 8-count ends, and no call crosses a
                    phrase ending—so nobody is ever called into 8-count 1 or {phraseLength + 1}.
                  </p>
                </aside>
                <p>
                  If the ask goes unmet the call <strong>drops</strong>: the couple loses{" "}
                  {call.missConnectionCost} Connection, afinque breaks, and the phrase is no longer
                  clean. You can always <strong>cover</strong> a call instead—discard a Recovery
                  card from your hand at any point in your dance step and the call is cleared with
                  no Connection lost.
                </p>
              </>
            ),
          },
          {
            id: "rules-afinque",
            label: "Afinque",
            heading: "Keep the afinque going",
            body: (
              <>
                <p>
                  Afinque is one shared number: the calls the two of you have answered in a row,
                  either player’s. Each answer adds a link, and the link pays extra Style on that
                  answer.
                </p>
                <div
                  className="rules-afinque-table"
                  role="list"
                  aria-label="Extra Style per afinque link"
                >
                  {call.afinqueBonus.map((bonus, index) => (
                    <span key={index} role="listitem">
                      <strong>
                        {index + 1} {index === 0 ? "link" : "links"}
                      </strong>
                      +{bonus} Style
                    </span>
                  ))}
                </div>
                <p>
                  {call.afinqueBonus.length} links is the most it holds. It breaks to zero on a
                  dropped call, a covered call, a stumble, or an 8-count with no Move in it
                  {call.resetAfinqueAtPhraseEnd ? ", and it resets at every phrase ending" : ""}.
                  Saying nothing does not break it—take the song, and the chain survives as long as
                  your partner dances a Move.
                </p>
              </>
            ),
          },
        ]
      : []),
    {
      id: "rules-ladder",
      label: "The ladder",
      heading: "Every 8-count lands somewhere",
      body: (
        <>
          <p>
            However it goes, your 8-count ends on one rung. Rungs score nothing by themselves—they
            are the record of how the dance is going, and the phrase strip and the recap are built
            from them.
          </p>
          <dl className="rules-ladder">
            {ladder.map((step) => (
              <div key={step.rung}>
                <dt>{step.rung}</dt>
                <dd>{step.meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="rules-legend">
            Where more than one could fit, they are checked in this order:{" "}
            {precedence.map((step) => step.rung.toLowerCase()).join(", ")}. A Clean rung is about
            one 8-count; the Clean phrase bonus is a separate, phrase-wide test.
          </p>
        </>
      ),
    },
    {
      id: "rules-song",
      label: "Song",
      heading: "Follow the song",
      body: (
        <>
          <p>
            Llorarás is two phrases of {phraseLength} 8-counts: the Cuerpo, then the Montuno. Each
            song moment has a visible condition such as changing Position or playing a Flourish
            {call ? ", and a starred call the music is already asking for" : ""}.
          </p>
          <p>At the end of each phrase, clear the floor and score:</p>
          <ul>
            <li>
              {call ? "No stumbles and no dropped call" : "No stumbles"}: +{phraseBonuses.clean}{" "}
              Style
            </li>
            <li>
              Variety: +{phraseBonuses.varietyPerExtraPosition} Style for each Position danced from
              beyond the first
            </li>
            <li>Both partners flourished: +{phraseBonuses.sharedFlair} Style</li>
            <li>Pose on the final 8-count: +{phraseBonuses.poseFinish} Style</li>
          </ul>
        </>
      ),
    },
    {
      id: "rules-lessons",
      label: "Lessons",
      heading: "Grow your decks",
      body: (
        <>
          <div className="rules-costs" aria-label="Lesson costs">
            <span>
              Beginner <strong>${lessonCosts.beginner}</strong>
            </span>
            <span>
              Intermediate <strong>${lessonCosts.intermediate}</strong>
            </span>
            <span>
              Advanced <strong>${lessonCosts.advanced}</strong>
            </span>
          </div>
          <p>
            Beginner cards are always available. Intermediate cards come from a face-up market.
            Advanced lessons open when the Montuno begins. Only one Intermediate or Advanced private
            lesson may be bought per Lead-and-Follow round; Beginner group lessons are unlimited.
          </p>
          {privateLessonsToTop ? (
            <p>
              A private lesson lands on top of your draw pile—you just learned it, so you dance it
              next. Beginner group classes and anything you learn from your partner go to your
              discard pile.
            </p>
          ) : null}
          <p>
            Once per phrase, you may also learn a free copy of a Move your partner played earlier in
            that phrase.
            {privateLessonsToTop ? "" : " Every learned card enters your discard pile."}
          </p>
        </>
      ),
    },
    {
      id: "rules-partner",
      label: "Partner",
      heading: "Dance, don’t quarterback",
      body: (
        <>
          <p>
            Hands are private. Do not name, describe, or count your cards. You may talk about
            general intent—“let’s get to Closed”—and reveal one card from your hand as a signal on
            your turn.
            {call ? " A call is public: both of you can see what was asked for." : ""}
          </p>
          <p>
            The digital <strong>Reset turn</strong> control restores the current turn to its
            beginning before it is handed to your partner.
          </p>
        </>
      ),
    },
    {
      id: "rules-scoring",
      label: "Finish",
      heading: "Finish the dance",
      body: (
        <>
          <p className="rules-equation">Final score = Style + remaining Connection</p>
          <div className="rules-ratings" aria-label="Performance ratings">
            {[...ratings]
              .sort((left, right) => left.minimum - right.minimum)
              .map((rating, index, sorted) => {
                const next = sorted[index + 1];
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
        </>
      ),
    },
  ];

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
            {sections.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() =>
                  dialogRef.current?.querySelector<HTMLElement>(`#${entry.id}`)?.scrollIntoView({
                    block: "start",
                  })
                }
              >
                {entry.label}
              </button>
            ))}
          </nav>

          {sections.map((entry, index) => (
            <section id={entry.id} key={entry.id}>
              <span className="rules-section-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{entry.heading}</h3>
                {entry.body}
              </div>
            </section>
          ))}
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
  const [open, setOpen] = useState<{ section: string | null } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openRules = useCallback((section?: string) => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen({ section: section ?? null });
  }, []);

  const closeRules = useCallback(() => {
    setOpen(null);
    window.requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);

  const value = useMemo(() => ({ openRules }), [openRules]);
  return (
    <RulesContext.Provider value={value}>
      {children}
      {open && <RulesDialog onClose={closeRules} section={open.section} />}
    </RulesContext.Provider>
  );
}

/** Opens the rulebook, optionally at one section. Throws outside the provider. */
export function useRules(): RulesContextValue {
  const rules = useContext(RulesContext);
  if (!rules) throw new Error("useRules must be used inside RulesProvider.");
  return rules;
}

export function RulesButton({ compact = false }: { compact?: boolean }) {
  const { openRules } = useRules();
  return (
    <button
      type="button"
      className={`rules-button ${compact ? "compact" : ""}`}
      onClick={() => openRules()}
      aria-haspopup="dialog"
      aria-label="How to play"
    >
      <span aria-hidden="true">?</span>
      <span>How to play</span>
    </button>
  );
}
