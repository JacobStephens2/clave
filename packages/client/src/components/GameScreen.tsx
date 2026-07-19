import { useEffect, useMemo, useRef, useState } from "react";
import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView, GameAction, PlayerSnapshot, Role } from "@clave/engine";
import { useAppStore } from "../store.js";
import { DanceCard } from "./DanceCard.js";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
type InspectableCard = CardView | DanceCardDefinition;

function actionForCard(actions: GameAction[], instanceId: string): GameAction | undefined {
  return actions.find(
    (action) =>
      (action.type === "PLAY_MOVE" && action.moveInstanceId === instanceId) ||
      (action.type === "TRANSITION" && action.positionInstanceId === instanceId) ||
      (action.type === "PLAY_FLOURISH" && action.flourishInstanceId === instanceId),
  );
}

function actionLabel(action: GameAction | undefined): string {
  if (!action) return "Play";
  if (action.type === "TRANSITION") return "Transition";
  if (action.type === "PLAY_FLOURISH") return "Flourish";
  return "Dance move";
}

function Hud({ view }: { view: PlayerSnapshot }) {
  return (
    <div className="hud" aria-label="Game score">
      <div className="hud-stat connection">
        <small>Connection</small>
        <strong>{view.shared.connection}</strong>
        <span>/{view.rules.maximumConnection}</span>
      </div>
      <div className="connection-meter" aria-hidden="true">
        {Array.from({ length: view.rules.maximumConnection }, (_, index) => (
          <i key={index} className={index < view.shared.connection ? "filled" : ""} />
        ))}
      </div>
      <div className="hud-stat">
        <small>Style</small>
        <strong>{view.shared.style}</strong>
      </div>
      <div className="hud-stat">
        <small>Your practice</small>
        <strong>${view.self.money}</strong>
      </div>
      <div className="hud-stat phrase">
        <small>Phrase {view.phrase.number}</small>
        <strong>
          {view.phrase.count}
          <span>/{view.rules.phraseLength}</span>
        </strong>
      </div>
    </div>
  );
}

function SongMoment({ view }: { view: PlayerSnapshot }) {
  if (!view.currentSong)
    return (
      <div className="song-card waiting">
        <small>Music</small>
        <h3>Opening hands</h3>
        <p>Check for a matching Position and Move.</p>
      </div>
    );
  return (
    <div className={`song-card ${view.currentSong.section.toLowerCase()}`}>
      <div className="song-count">
        <span>{String(view.currentSong.number).padStart(2, "0")}</span>
        <small>of {view.rules.songLength}</small>
      </div>
      <div>
        <small>
          {view.currentSong.section} · {view.currentSong.moment}
        </small>
        <h3>{view.currentSong.title}</h3>
        <p>{view.currentSong.description}</p>
      </div>
    </div>
  );
}

function TableCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="table-slot">
      <span>{label}</span>
      {children || <div className="empty-slot">—</div>}
    </div>
  );
}

function DanceTable({
  view,
  onInspect,
}: {
  view: PlayerSnapshot;
  onInspect: (card: InspectableCard) => void;
}) {
  return (
    <section className="dance-table" aria-label="Current dance state">
      <div className="table-heading">
        <span>On the floor</span>
        <small>
          {view.activeRole === view.viewerRole
            ? "Your 8-count"
            : `${roleName(view.activeRole)}’s 8-count`}
        </small>
      </div>
      <div className="table-cards">
        <TableCard label="Position">
          {view.table.position ? (
            <DanceCard
              value={view.table.position}
              compact
              onInspect={() => onInspect(view.table.position!)}
            />
          ) : null}
        </TableCard>
        <div className="table-connector" aria-hidden="true">
          ↝
        </div>
        <TableCard label="Last move">
          {view.table.move ? (
            <DanceCard
              value={view.table.move}
              compact
              onInspect={() => onInspect(view.table.move!)}
            />
          ) : null}
        </TableCard>
        <div className="table-connector flourish-link" aria-hidden="true">
          ✦
        </div>
        <TableCard label="Flourish">
          {view.table.flourish ? (
            <DanceCard
              value={view.table.flourish}
              compact
              onInspect={() => onInspect(view.table.flourish!)}
            />
          ) : null}
        </TableCard>
      </div>
      {view.signal && view.signal.role !== view.viewerRole && (
        <div className="partner-signal">
          <div>
            <small>Your partner signals</small>
            <strong>{view.signal.card.card.name}</strong>
          </div>
          <span>{view.signal.card.card.type}</span>
        </div>
      )}
    </section>
  );
}

function Market({
  view,
  dispatch,
  onInspect,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  onInspect: (card: InspectableCard) => void;
}) {
  const buys = view.legalActions.filter(
    (action): action is Extract<GameAction, { type: "BUY_LESSON" }> => action.type === "BUY_LESSON",
  );
  const findBuy = (source: "beginner" | "intermediate" | "advanced", cardId: string) =>
    buys.find((action) => action.source === source && action.cardId === cardId);
  const section = (
    title: string,
    source: "beginner" | "intermediate" | "advanced",
    cards: typeof view.market.beginner,
    cost: number,
  ) => (
    <div className="market-section">
      <div className="market-title">
        <strong>{title}</strong>
        <span>${cost}</span>
      </div>
      <div className="market-row">
        {cards.map((card, index) => {
          const buy = findBuy(source, card.id);
          return (
            <DanceCard
              key={`${source}-${card.id}-${index}`}
              value={card}
              compact
              disabled={!buy}
              actionLabel={`Learn · $${cost}`}
              onAction={buy ? () => dispatch(buy) : undefined}
              onInspect={() => onInspect(card)}
            />
          );
        })}
        {cards.length === 0 && <p className="market-empty">Opens in the montuno</p>}
      </div>
    </div>
  );
  return (
    <details className="market" open={view.phase === "lesson"}>
      <summary>
        <span>Lessons</span>
        <small>
          {view.market.privateLessonAvailable
            ? "Teacher available"
            : "Private lesson taken this round"}
        </small>
      </summary>
      {section(
        "Beginner supply",
        "beginner",
        view.market.beginner,
        view.rules.lessonCosts.beginner,
      )}
      {section(
        `Intermediate · ${view.market.intermediateDeckCount} in deck`,
        "intermediate",
        view.market.intermediate,
        view.rules.lessonCosts.intermediate,
      )}
      {section(
        `Advanced · ${view.market.advancedDeckCount} in deck`,
        "advanced",
        view.market.advanced,
        view.rules.lessonCosts.advanced,
      )}
    </details>
  );
}

function TurnActions({
  view,
  dispatch,
  selectedDiscards,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  selectedDiscards: Set<string>;
}) {
  const actions = view.legalActions;
  const byType = <T extends GameAction["type"]>(type: T) =>
    actions.filter((action): action is Extract<GameAction, { type: T }> => action.type === type);
  if (view.status === "setup") {
    const mulligan = byType("MULLIGAN")[0];
    const confirm = byType("CONFIRM_HAND")[0];
    if (!confirm)
      return (
        <div className="turn-actions waiting-actions">
          <strong>Waiting for {roleName(view.setupRole)}</strong>
          <span>Your hand stays private.</span>
        </div>
      );
    return (
      <div className="turn-actions">
        <div>
          <small>Opening hand</small>
          <strong>Ready to dance?</strong>
          <p>You need a Position with a matching Move to open the phrase.</p>
        </div>
        <div className="button-row">
          {mulligan && (
            <button type="button" className="button outline" onClick={() => dispatch(mulligan)}>
              Mulligan once
            </button>
          )}
          <button type="button" className="button gold" onClick={() => dispatch(confirm)}>
            Keep this hand
          </button>
        </div>
      </div>
    );
  }
  if (view.activeRole !== view.viewerRole)
    return (
      <div className="turn-actions waiting-actions">
        <strong>{roleName(view.activeRole)} is dancing</strong>
        <span>Watch the floor, not their hand.</span>
      </div>
    );

  if (view.phase === "dance") {
    const openings = byType("PLAY_OPEN");
    const end = byType("END_DANCE")[0];
    const stumbles = byType("STUMBLE");
    const undo = byType("UNDO_TURN")[0];
    return (
      <div className="turn-actions">
        <div className="step-heading">
          <span>2</span>
          <div>
            <small>Dance</small>
            <strong>{view.turn.cardsPlayed ? "Build the 8-count" : "Choose your step"}</strong>
          </div>
        </div>
        {openings.length > 0 && (
          <div className="opening-options">
            <small>Open together</small>
            {openings.map((action) => {
              const position = view.self.hand.find(
                (entry) => entry.instanceId === action.positionInstanceId,
              )!;
              const move = view.self.hand.find(
                (entry) => entry.instanceId === action.moveInstanceId,
              )!;
              return (
                <button
                  type="button"
                  key={`${action.positionInstanceId}-${action.moveInstanceId}`}
                  onClick={() => dispatch(action)}
                >
                  <span>{position.card.name}</span>
                  <b>+</b>
                  <span>{move.card.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="button-row wrap">
          {end && (
            <button type="button" className="button gold" onClick={() => dispatch(end)}>
              {view.turn.cardsPlayed === 0 ? "Dance the basic" : "Finish the 8-count"}
            </button>
          )}
          {stumbles.map((action) => {
            const recovery = action.recoveryInstanceId
              ? view.self.hand.find((entry) => entry.instanceId === action.recoveryInstanceId)
              : null;
            return (
              <button
                type="button"
                className="button danger-outline"
                key={action.recoveryInstanceId ?? "plain"}
                onClick={() => dispatch(action)}
              >
                {recovery ? `Stumble · ${recovery.card.name}` : "Stumble · −2 Connection"}
              </button>
            );
          })}
          {undo && (
            <button type="button" className="text-button" onClick={() => dispatch(undo)}>
              Reset turn
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view.phase === "lesson") {
    const learn = byType("LEARN_FROM_PARTNER");
    const done = byType("END_LESSON")[0];
    const undo = byType("UNDO_TURN")[0];
    return (
      <div className="turn-actions">
        <div className="step-heading">
          <span>3</span>
          <div>
            <small>Take a lesson</small>
            <strong>Practice something new—or keep moving</strong>
          </div>
        </div>
        {learn.length > 0 && (
          <div className="learn-partner">
            <small>Learn free from your partner</small>
            {learn.map((action) => (
              <button type="button" key={action.cardId} onClick={() => dispatch(action)}>
                {view.cardCatalog.find((card) => card.id === action.cardId)?.name ?? action.cardId}
              </button>
            ))}
          </div>
        )}
        <div className="button-row">
          <button type="button" className="button gold" onClick={() => done && dispatch(done)}>
            Finish lessons
          </button>
          {undo && (
            <button type="button" className="text-button" onClick={() => dispatch(undo)}>
              Reset turn
            </button>
          )}
        </div>
      </div>
    );
  }

  const freshen = byType("FRESHEN")[0];
  const undo = byType("UNDO_TURN")[0];
  return (
    <div className="turn-actions">
      <div className="step-heading">
        <span>4</span>
        <div>
          <small>Freshen up</small>
          <strong>Discard any cards, then draw to four</strong>
        </div>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="button gold"
          onClick={() =>
            freshen && dispatch({ ...freshen, discardInstanceIds: [...selectedDiscards] })
          }
        >
          {selectedDiscards.size
            ? `Discard ${selectedDiscards.size} & end turn`
            : "Keep hand & end turn"}
        </button>
        {undo && (
          <button type="button" className="text-button" onClick={() => dispatch(undo)}>
            Reset turn
          </button>
        )}
      </div>
    </div>
  );
}

function Hand({
  view,
  dispatch,
  selectedDiscards,
  toggleDiscard,
  onInspect,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  selectedDiscards: Set<string>;
  toggleDiscard: (id: string) => void;
  onInspect: (card: InspectableCard) => void;
}) {
  const isOwnTurn =
    view.activeRole === view.viewerRole ||
    (view.status === "setup" && view.setupRole === view.viewerRole);
  return (
    <section className="hand-zone">
      <div className="hand-heading">
        <div>
          <small>{roleName(view.viewerRole)} hand</small>
          <strong>{view.self.hand.length} cards</strong>
        </div>
        <div>
          <span>Deck {view.self.drawCount}</span>
          <span>Discard {view.self.discardCount}</span>
        </div>
      </div>
      <div className="hand-scroll">
        {view.self.hand.map((entry) => {
          const primary = actionForCard(view.legalActions, entry.instanceId);
          const signal = view.legalActions.find(
            (action) => action.type === "SIGNAL_CARD" && action.instanceId === entry.instanceId,
          );
          const selected = selectedDiscards.has(entry.instanceId);
          const freshen = view.phase === "freshen" && isOwnTurn;
          return (
            <DanceCard
              key={entry.instanceId}
              value={entry}
              selected={selected}
              disabled={!isOwnTurn}
              actionLabel={freshen ? (selected ? "Keep" : "Discard") : actionLabel(primary)}
              onAction={
                freshen
                  ? () => toggleDiscard(entry.instanceId)
                  : primary
                    ? () => dispatch(primary)
                    : undefined
              }
              onSignal={signal && view.phase !== "freshen" ? () => dispatch(signal) : undefined}
              onInspect={() => onInspect(entry)}
            />
          );
        })}
      </div>
    </section>
  );
}

function GameLog({ view }: { view: PlayerSnapshot }) {
  return (
    <details className="game-log">
      <summary>
        Dance log <span>{view.log.length}</span>
      </summary>
      <ol>
        {[...view.log].reverse().map((entry, index) => (
          <li key={`${entry.sequence}-${index}`}>
            <span>{entry.sequence || "·"}</span>
            <p>{entry.message}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function CardInspector({ card, onClose }: { card: InspectableCard; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    closeButton.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div
      className="card-inspector"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-inspector-title"
      onClick={onClose}
    >
      <div className="card-inspector-content" onClick={(event) => event.stopPropagation()}>
        <span className="inspector-hint" id="card-inspector-title">
          Card detail
        </span>
        <DanceCard value={card} />
        <button ref={closeButton} type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function PassScreen({ role, onReady }: { role: Role; onReady: () => void }) {
  return (
    <div className="pass-screen" role="dialog" aria-modal="true">
      <div className="pass-orbit" aria-hidden="true">
        <span>{role === "lead" ? "L" : "F"}</span>
      </div>
      <small>Keep the hand private</small>
      <h2>
        Pass to the
        <br />
        <em>{roleName(role)}</em>
      </h2>
      <p>When your partner has the screen, tap below.</p>
      <button type="button" className="button gold" onClick={onReady}>
        I’m the {roleName(role)}
      </button>
    </div>
  );
}

function Terminal({
  view,
  newHotseat,
  leave,
}: {
  view: PlayerSnapshot;
  newHotseat: () => void;
  leave: () => void;
}) {
  const won = view.status === "completed";
  return (
    <div className="terminal-screen">
      <small>{won ? "The final 8-count" : "The connection broke"}</small>
      <h2>{won ? view.rating?.name : "The dance ends here"}</h2>
      <div className="final-score">
        <span>{view.finalScore ?? 0}</span>
        <small>final score</small>
      </div>
      <div className="score-equation">
        <span>
          {view.shared.style}
          <small>Style</small>
        </span>
        <b>+</b>
        <span>
          {view.shared.connection}
          <small>Connection</small>
        </span>
      </div>
      <p>
        {won ? view.rating?.description : "Take a breath, find each other, and try the song again."}
      </p>
      <div className="button-row">
        <button type="button" className="button gold" onClick={newHotseat}>
          Dance again
        </button>
        <button type="button" className="button outline" onClick={leave}>
          Back home
        </button>
      </div>
    </div>
  );
}

export function GameScreen() {
  const {
    snapshot: view,
    mode,
    passTo,
    onlineSeat,
    connection,
    dispatch,
    acceptPass,
    leaveGame,
    newHotseat,
  } = useAppStore();
  const [selectedDiscards, setSelectedDiscards] = useState<Set<string>>(new Set());
  const [inspectedCard, setInspectedCard] = useState<InspectableCard | null>(null);
  useEffect(() => setSelectedDiscards(new Set()), [view?.sequence, view?.phase]);
  const clearSignal = useMemo(
    () => view?.legalActions.find((action) => action.type === "CLEAR_SIGNAL"),
    [view],
  );

  if (!view)
    return (
      <main className="loading-table">
        <span className="brand-eyebrow">Clave</span>
        <h1>Finding the floor…</h1>
        <button type="button" className="text-button" onClick={leaveGame}>
          Back home
        </button>
      </main>
    );
  if (view.status === "completed" || view.status === "lost" || view.status === "unresumable")
    return <Terminal view={view} newHotseat={newHotseat} leave={leaveGame} />;

  return (
    <main className="game">
      <header className="game-header">
        <button type="button" className="mini-brand" onClick={leaveGame} aria-label="Return home">
          CLAVE
        </button>
        {mode === "online" && onlineSeat ? (
          <button
            type="button"
            className="room-code"
            onClick={() => void navigator.clipboard?.writeText(onlineSeat.code)}
            title="Copy room code"
          >
            <small>Room · tap to copy</small>
            <strong>{onlineSeat.code}</strong>
          </button>
        ) : (
          <span className="mode-label">Pass & play</span>
        )}
        <span className={`connection-status ${connection}`}>
          {mode === "online" ? connection : "saved on device"}
        </span>
      </header>
      <Hud view={view} />
      <div className="game-grid">
        <div className="main-table">
          <SongMoment view={view} />
          <DanceTable view={view} onInspect={setInspectedCard} />
          <TurnActions view={view} dispatch={dispatch} selectedDiscards={selectedDiscards} />
          <Hand
            view={view}
            dispatch={dispatch}
            selectedDiscards={selectedDiscards}
            onInspect={setInspectedCard}
            toggleDiscard={(id) =>
              setSelectedDiscards((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
        </div>
        <aside className="game-sidebar">
          <Market view={view} dispatch={dispatch} onInspect={setInspectedCard} />
          <GameLog view={view} />
        </aside>
      </div>
      {passTo && mode === "hotseat" && <PassScreen role={passTo} onReady={acceptPass} />}
      {view.signal?.role === view.viewerRole && mode === "hotseat" && (
        <div className="signal-peek" role="dialog" aria-modal="true">
          <small>Show only this card to your partner</small>
          <DanceCard value={view.signal.card} />
          <button
            type="button"
            className="button gold"
            onClick={() => clearSignal && dispatch(clearSignal)}
          >
            Hide it again
          </button>
        </div>
      )}
      {view.signal?.role === view.viewerRole && mode === "online" && clearSignal && (
        <button type="button" className="signal-live" onClick={() => dispatch(clearSignal)}>
          Signal visible to partner · tap to hide
        </button>
      )}
      {inspectedCard && (
        <CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />
      )}
    </main>
  );
}
