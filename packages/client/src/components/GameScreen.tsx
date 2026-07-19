import { useEffect, useMemo, useRef, useState } from "react";
import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView, GameAction, PlayerSnapshot, Role } from "@clave/engine";
import { useAppStore } from "../store.js";
import { DanceCard } from "./DanceCard.js";
import { DancerDemo } from "./DancerDemo.js";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
type InspectableCard = CardView | DanceCardDefinition;
type OpeningAction = Extract<GameAction, { type: "PLAY_OPEN" }>;
type LessonBuyAction = Extract<GameAction, { type: "BUY_LESSON" }>;

interface LessonFlight {
  key: number;
  card: DanceCardDefinition;
  source: LessonBuyAction["source"];
  startingSequence: number;
  from: { left: number; top: number; width: number; height: number };
  deltaX: number;
  deltaY: number;
  midpointX: number;
  midpointY: number;
  scale: number;
  flying: boolean;
}

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

function TableCard({
  label,
  children,
  staged = false,
}: {
  label: string;
  children: React.ReactNode;
  staged?: boolean;
}) {
  return (
    <div
      className={`table-slot ${staged ? "staged-slot" : ""}`}
      data-slot={label.toLowerCase().replaceAll(" ", "-")}
    >
      <span>{staged ? `${label} · staged` : label}</span>
      {children || <div className="empty-slot">—</div>}
      {staged && <small className="staged-note">Waiting for Move</small>}
    </div>
  );
}

function DanceTable({
  view,
  onInspect,
  pendingPosition,
  acceptsDrop,
  dragOver,
  onDragOverChange,
  onCardDrop,
  onOpenDancerDemo,
}: {
  view: PlayerSnapshot;
  onInspect: (card: InspectableCard) => void;
  pendingPosition: CardView | null;
  acceptsDrop: boolean;
  dragOver: boolean;
  onDragOverChange: (over: boolean) => void;
  onCardDrop: (instanceId: string) => void;
  onOpenDancerDemo: () => void;
}) {
  const opening = view.table.position === null;
  const floorHint = pendingPosition
    ? "Now drag a highlighted matching Move here"
    : opening && acceptsDrop
      ? "Drag a highlighted Position here"
      : acceptsDrop
        ? "Drag a highlighted card here"
        : view.activeRole === view.viewerRole
          ? "Your 8-count"
          : `${roleName(view.activeRole)}’s 8-count`;
  return (
    <section
      className={`dance-table ${acceptsDrop ? "accepts-card-drop" : ""} ${dragOver ? "drag-over" : ""}`}
      aria-label="Current dance state and card drop area"
      onDragEnter={(event) => {
        if (!acceptsDrop) return;
        event.preventDefault();
        onDragOverChange(true);
      }}
      onDragOver={(event) => {
        if (!acceptsDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOverChange(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onDragOverChange(false);
      }}
      onDrop={(event) => {
        if (!acceptsDrop) return;
        event.preventDefault();
        const instanceId =
          event.dataTransfer.getData("application/x-clave-card") ||
          event.dataTransfer.getData("text/plain");
        onDragOverChange(false);
        if (instanceId) onCardDrop(instanceId);
      }}
    >
      <div className="table-heading">
        <span>On the floor</span>
        <div className="floor-heading-tools">
          <small className={acceptsDrop ? "floor-drop-hint" : ""}>{floorHint}</small>
          <button type="button" className="watch-dancers" onClick={onOpenDancerDemo}>
            Watch dancers
          </button>
        </div>
      </div>
      <div className="table-cards">
        <TableCard label="Position" staged={Boolean(pendingPosition)}>
          {view.table.position || pendingPosition ? (
            <DanceCard
              value={view.table.position ?? pendingPosition!}
              compact
              onInspect={() => onInspect(view.table.position ?? pendingPosition!)}
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
  onInspect,
  onBuyLesson,
  pendingLesson,
}: {
  view: PlayerSnapshot;
  onInspect: (card: InspectableCard) => void;
  onBuyLesson: (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    sourceButton: HTMLButtonElement,
  ) => void;
  pendingLesson: { source: LessonBuyAction["source"]; cardId: string } | null;
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
          const purchasePending =
            pendingLesson?.source === source && pendingLesson.cardId === card.id;
          return (
            <DanceCard
              key={`${source}-${card.id}-${index}`}
              value={card}
              compact
              disabled={!buy || purchasePending}
              actionLabel={purchasePending ? "Learning…" : `Learn · $${cost}`}
              onAction={buy ? (event) => onBuyLesson(card, buy, event.currentTarget) : undefined}
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
  pendingPosition,
  cancelPendingPosition,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  selectedDiscards: Set<string>;
  pendingPosition: CardView | null;
  cancelPendingPosition: () => void;
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
            <strong>
              {pendingPosition
                ? "Complete the opening"
                : openings.length > 0
                  ? "Drag a Position to the floor"
                  : view.turn.cardsPlayed
                    ? "Build the 8-count"
                    : "Choose your step"}
            </strong>
          </div>
        </div>
        {openings.length > 0 && (
          <div className="opening-drag-guide" aria-live="polite">
            <small>Opening play</small>
            <span>
              {pendingPosition
                ? `${pendingPosition.card.name} is staged. Drag a highlighted matching Move next.`
                : "Start with any highlighted Position in your hand."}
            </span>
          </div>
        )}
        <div className="button-row wrap">
          {pendingPosition ? (
            <button type="button" className="button outline" onClick={cancelPendingPosition}>
              Return Position to hand
            </button>
          ) : (
            <>
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
            </>
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
  pendingPosition,
  draggableCardIds,
  draggingCardId,
  onCardDragStart,
  onCardDragEnd,
  discardTargetRef,
  discardReceiving,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  selectedDiscards: Set<string>;
  toggleDiscard: (id: string) => void;
  onInspect: (card: InspectableCard) => void;
  pendingPosition: CardView | null;
  draggableCardIds: Set<string>;
  draggingCardId: string | null;
  onCardDragStart: (instanceId: string, event: React.DragEvent<HTMLElement>) => void;
  onCardDragEnd: () => void;
  discardTargetRef: React.RefObject<HTMLSpanElement | null>;
  discardReceiving: boolean;
}) {
  const isOwnTurn =
    view.activeRole === view.viewerRole ||
    (view.status === "setup" && view.setupRole === view.viewerRole);
  const visibleHand = view.self.hand.filter(
    (entry) => entry.instanceId !== pendingPosition?.instanceId,
  );
  return (
    <section className="hand-zone">
      <div className="hand-heading">
        <div>
          <small>{roleName(view.viewerRole)} hand</small>
          <strong>{visibleHand.length} cards</strong>
          {pendingPosition && <span>1 Position staged</span>}
        </div>
        <div>
          <span>Deck {view.self.drawCount}</span>
          <span
            ref={discardTargetRef}
            className={`discard-pile-target ${discardReceiving ? "receiving" : ""}`}
            aria-label={`Discard pile, ${view.self.discardCount} cards`}
          >
            Discard {view.self.discardCount}
          </span>
        </div>
      </div>
      <div className="hand-scroll">
        {visibleHand.map((entry) => {
          const primary = actionForCard(view.legalActions, entry.instanceId);
          const signal = view.legalActions.find(
            (action) => action.type === "SIGNAL_CARD" && action.instanceId === entry.instanceId,
          );
          const selected = selectedDiscards.has(entry.instanceId);
          const freshen = view.phase === "freshen" && isOwnTurn;
          const draggable = draggableCardIds.has(entry.instanceId);
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
              draggable={draggable}
              dragging={draggingCardId === entry.instanceId}
              onDragStart={
                draggable ? (event) => onCardDragStart(entry.instanceId, event) : undefined
              }
              onDragEnd={draggable ? onCardDragEnd : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function LessonCardFlight({
  flight,
  onComplete,
}: {
  flight: LessonFlight;
  onComplete: () => void;
}) {
  const style = {
    left: flight.from.left,
    top: flight.from.top,
    width: flight.from.width,
    height: flight.from.height,
    "--lesson-flight-x": `${flight.deltaX}px`,
    "--lesson-flight-y": `${flight.deltaY}px`,
    "--lesson-flight-mid-x": `${flight.midpointX}px`,
    "--lesson-flight-mid-y": `${flight.midpointY}px`,
    "--lesson-flight-scale": String(flight.scale),
  } as React.CSSProperties & Record<string, string | number>;

  return (
    <div
      className={`lesson-card-flight ${flight.flying ? "flying" : "waiting"}`}
      style={style}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onComplete();
      }}
    >
      <DanceCard value={flight.card} compact />
    </div>
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
  const [pendingOpenPositionId, setPendingOpenPositionId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [floorDragOver, setFloorDragOver] = useState(false);
  const [lessonFlight, setLessonFlight] = useState<LessonFlight | null>(null);
  const [dancerDemoOpen, setDancerDemoOpen] = useState(false);
  const discardTargetRef = useRef<HTMLSpanElement>(null);
  const lessonFlightKey = useRef(0);
  useEffect(() => {
    setSelectedDiscards(new Set());
    setPendingOpenPositionId(null);
    setDraggingCardId(null);
    setFloorDragOver(false);
  }, [view?.sequence, view?.phase, view?.viewerRole, passTo]);
  useEffect(() => setLessonFlight(null), [view?.viewerRole, passTo]);
  useEffect(() => {
    if (!lessonFlight || lessonFlight.flying || !view) return;
    if (view.sequence <= lessonFlight.startingSequence) return;
    const frame = window.requestAnimationFrame(() =>
      setLessonFlight((current) =>
        current?.key === lessonFlight.key ? { ...current, flying: true } : current,
      ),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [lessonFlight, view]);
  useEffect(() => {
    if (!lessonFlight || lessonFlight.flying) return;
    const timeout = window.setTimeout(
      () => setLessonFlight((current) => (current?.key === lessonFlight.key ? null : current)),
      5_000,
    );
    return () => window.clearTimeout(timeout);
  }, [lessonFlight]);
  const clearSignal = useMemo(
    () => view?.legalActions.find((action) => action.type === "CLEAR_SIGNAL"),
    [view],
  );
  const openingActions = useMemo(
    () =>
      view?.legalActions.filter((action): action is OpeningAction => action.type === "PLAY_OPEN") ??
      [],
    [view],
  );
  const pendingPosition = useMemo(
    () =>
      pendingOpenPositionId
        ? (view?.self.hand.find((entry) => entry.instanceId === pendingOpenPositionId) ?? null)
        : null,
    [pendingOpenPositionId, view],
  );
  const draggableCardIds = useMemo(() => {
    const ids = new Set<string>();
    if (
      !view ||
      view.status !== "playing" ||
      view.phase !== "dance" ||
      view.activeRole !== view.viewerRole
    )
      return ids;

    if (!view.table.position) {
      for (const action of openingActions) {
        if (pendingOpenPositionId) {
          if (action.positionInstanceId === pendingOpenPositionId) ids.add(action.moveInstanceId);
        } else ids.add(action.positionInstanceId);
      }
      return ids;
    }

    for (const action of view.legalActions) {
      if (action.type === "PLAY_MOVE") ids.add(action.moveInstanceId);
      if (action.type === "TRANSITION") ids.add(action.positionInstanceId);
      if (action.type === "PLAY_FLOURISH") ids.add(action.flourishInstanceId);
    }
    return ids;
  }, [openingActions, pendingOpenPositionId, view]);

  const playDroppedCard = (instanceId: string) => {
    if (!view || !draggableCardIds.has(instanceId)) return;
    if (!view.table.position) {
      if (!pendingOpenPositionId) {
        if (openingActions.some((action) => action.positionInstanceId === instanceId))
          setPendingOpenPositionId(instanceId);
        return;
      }
      const opening = openingActions.find(
        (action) =>
          action.positionInstanceId === pendingOpenPositionId &&
          action.moveInstanceId === instanceId,
      );
      if (opening) {
        setPendingOpenPositionId(null);
        dispatch(opening);
      }
      return;
    }

    const action = actionForCard(view.legalActions, instanceId);
    if (action) dispatch(action);
  };

  const buyLesson = (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    sourceButton: HTMLButtonElement,
  ) => {
    if (!view || lessonFlight) return;
    const sourceCard = sourceButton.closest<HTMLElement>(".dance-card");
    const discardTarget = discardTargetRef.current;
    if (!sourceCard || !discardTarget) {
      dispatch(action);
      return;
    }

    const sourceRect = sourceCard.getBoundingClientRect();
    const targetRect = discardTarget.getBoundingClientRect();
    const deltaX =
      targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const deltaY =
      targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const arcHeight = Math.min(90, Math.abs(deltaY) * 0.18 + 30);
    lessonFlightKey.current += 1;
    setLessonFlight({
      key: lessonFlightKey.current,
      card,
      source: action.source,
      startingSequence: view.sequence,
      from: {
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      deltaX,
      deltaY,
      midpointX: deltaX * 0.65,
      midpointY: deltaY * 0.55 - arcHeight,
      scale: Math.min(0.52, Math.max(0.28, targetRect.width / sourceRect.width)),
      flying: false,
    });
    setInspectedCard(null);
    dispatch(action);
  };

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
          <DanceTable
            view={view}
            onInspect={setInspectedCard}
            pendingPosition={pendingPosition}
            acceptsDrop={draggableCardIds.size > 0}
            dragOver={floorDragOver}
            onDragOverChange={setFloorDragOver}
            onCardDrop={playDroppedCard}
            onOpenDancerDemo={() => setDancerDemoOpen(true)}
          />
          <TurnActions
            view={view}
            dispatch={dispatch}
            selectedDiscards={selectedDiscards}
            pendingPosition={pendingPosition}
            cancelPendingPosition={() => setPendingOpenPositionId(null)}
          />
          <Hand
            view={view}
            dispatch={dispatch}
            selectedDiscards={selectedDiscards}
            onInspect={setInspectedCard}
            pendingPosition={pendingPosition}
            draggableCardIds={draggableCardIds}
            draggingCardId={draggingCardId}
            onCardDragStart={(instanceId, event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-clave-card", instanceId);
              event.dataTransfer.setData("text/plain", instanceId);
              setDraggingCardId(instanceId);
              setInspectedCard(null);
            }}
            onCardDragEnd={() => {
              setDraggingCardId(null);
              setFloorDragOver(false);
            }}
            discardTargetRef={discardTargetRef}
            discardReceiving={Boolean(lessonFlight?.flying)}
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
          <Market
            view={view}
            onInspect={setInspectedCard}
            onBuyLesson={buyLesson}
            pendingLesson={
              lessonFlight ? { source: lessonFlight.source, cardId: lessonFlight.card.id } : null
            }
          />
          <GameLog view={view} />
        </aside>
      </div>
      {lessonFlight && (
        <LessonCardFlight flight={lessonFlight} onComplete={() => setLessonFlight(null)} />
      )}
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
      {dancerDemoOpen && <DancerDemo view={view} onClose={() => setDancerDemoOpen(false)} />}
    </main>
  );
}
