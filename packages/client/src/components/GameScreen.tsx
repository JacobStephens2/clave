import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DanceCard as DanceCardDefinition, Position } from "@clave/content";
import type { CardView, GameAction, PlayerSnapshot, Role } from "@clave/engine";
import { useAppStore } from "../store.js";
import {
  NO_INTENT,
  floorDraggableIds,
  reconcileIntent,
  resolveDrop,
  stagedPosition,
  unavailableReason,
  type DropResolution,
  type TurnIntent,
} from "../turn-intent.js";
import { DanceCard } from "./DanceCard.js";
import { DancerDemo } from "./DancerDemo.js";
import { MusicButton } from "./MusicPlayer.js";
import { PhraseHistory } from "./PhraseHistory.js";
import { RulesButton } from "./RulesDialog.js";
import { SoundEffectsButton, useSoundEffects, type SoundEffect } from "./SoundEffects.js";

const roleName = (role: Role) => (role === "lead" ? "Lead" : "Follow");
type InspectableCard = CardView | DanceCardDefinition;
type LessonBuyAction = Extract<GameAction, { type: "BUY_LESSON" }>;
type CleanupAction = Extract<GameAction, { type: "END_LESSON" }>;
type RoomCopyStatus = "idle" | "copied" | "failed";

interface CardInspectionOrigin {
  element: HTMLElement;
  rect: { left: number; top: number; width: number; height: number };
}

interface CardInspection {
  card: InspectableCard;
  origin: CardInspectionOrigin | null;
  /** The market row a lesson card was opened from, so the enlarged card can offer it. */
  lessonSource?: LessonBuyAction["source"] | undefined;
}

interface InspectorAction {
  label: string;
  primary: boolean;
  /** Receives the enlarged card element, the origin for any card flight. */
  run: (enlargedCard: HTMLElement | null) => void;
}

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

interface CleanupFlightCard {
  card: CardView;
  from: { left: number; top: number; width: number; height: number };
  deltaX: number;
  deltaY: number;
  midpointX: number;
  midpointY: number;
  scale: number;
  delay: number;
}

interface CleanupFlight {
  key: number;
  startingSequence: number;
  cards: CleanupFlightCard[];
  flying: boolean;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  previousFocus?.focus();
  if (!copied) throw new Error("The browser did not copy the room code.");
}

function actionLabel(action: GameAction | undefined): string {
  if (!action) return "Play";
  if (action.type === "TRANSITION") return "Transition";
  if (action.type === "PLAY_FLOURISH") return "Flourish";
  return "Dance move";
}

/** The button label for playing a hand card to the floor, or undefined when it cannot go. */
function playLabel(play: DropResolution | null): string | undefined {
  if (!play || play.kind === "ignore") return undefined;
  return play.kind === "stage" ? "Stage Position" : actionLabel(play.action);
}

function currentFloorPosition(view: PlayerSnapshot): Position | null {
  const card = view.table.position?.card;
  return card?.type === "position" ? card.position : null;
}

/** Why the viewer cannot take a lesson from `source` right now, or null when nothing explains it. */
function lessonUnavailableReason(
  view: PlayerSnapshot,
  source: LessonBuyAction["source"],
): string | null {
  const cost = view.rules.lessonCosts[source];
  if (view.status !== "playing" || view.activeRole !== view.viewerRole)
    return "Learn on your turn, after you dance";
  if (view.phase === "dance") return "Learn after you dance this 8-count";
  if (view.turn.boughtLesson) return "You already took a lesson this turn";
  if (source !== "beginner" && !view.market.privateLessonAvailable)
    return "Private lesson already taken this round";
  if (view.self.money < cost) return `Costs $${cost} · you have $${view.self.money}`;
  return null;
}

function soundForAction(action: GameAction): SoundEffect {
  switch (action.type) {
    case "MULLIGAN":
    case "END_LESSON":
      return "discard";
    case "PLAY_MOVE":
    case "PLAY_OPEN":
      return "card-move";
    case "TRANSITION":
      return "card-position";
    case "PLAY_FLOURISH":
      return "card-flourish";
    case "END_DANCE":
      return "turn";
    case "BUY_LESSON":
    case "LEARN_FROM_PARTNER":
      return "lesson";
    case "STUMBLE":
      return "stumble";
    case "CONFIRM_HAND":
      return "turn";
    case "SIGNAL_CARD":
      return "card-select";
    case "CLEAR_SIGNAL":
    case "UNDO_TURN":
      return "undo";
  }
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
        <div>
          <small>Music</small>
          <h3>Opening hands</h3>
          <p>You begin in Open. Check for a matching Move.</p>
        </div>
        <div className="song-audio-controls" role="group" aria-label="Audio controls">
          <MusicButton compact />
          <SoundEffectsButton compact />
        </div>
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
      <div className="song-audio-controls" role="group" aria-label="Audio controls">
        <MusicButton compact />
        <SoundEffectsButton compact />
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
  const canPlayMove = view.legalActions.some((action) => action.type === "PLAY_MOVE");
  const canPlayPosition = view.legalActions.some((action) => action.type === "TRANSITION");
  const canPlayFlourish = view.legalActions.some((action) => action.type === "PLAY_FLOURISH");
  const justPlayedMove = view.turn.moveCardId !== null ? view.table.move : null;
  const floorHint = pendingPosition
    ? "Now drag a highlighted matching Move here"
    : opening && acceptsDrop
      ? "Drag a highlighted Position here"
      : acceptsDrop && canPlayMove
        ? "Drag a highlighted Move here"
        : acceptsDrop && canPlayPosition
          ? "Now drag a highlighted Position here"
          : acceptsDrop && canPlayFlourish
            ? "Now drag a highlighted Flourish here"
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
        <div className="floor-title">
          <span>On the floor</span>
          {justPlayedMove && (
            <strong className="just-played-card" role="status">
              Just played: {justPlayedMove.card.name}
            </strong>
          )}
        </div>
        <div className="floor-heading-tools">
          <small className={acceptsDrop ? "floor-drop-hint" : ""}>{floorHint}</small>
          <button type="button" className="watch-dancers" onClick={onOpenDancerDemo}>
            Watch dancers
          </button>
        </div>
      </div>
      <div className="table-cards">
        <TableCard label="Move">
          {view.table.move ? (
            <DanceCard
              value={view.table.move}
              compact
              fullArtwork
              onInspect={() => onInspect(view.table.move!)}
            />
          ) : null}
        </TableCard>
        <div className="table-connector" aria-hidden="true">
          →
        </div>
        <TableCard label="Position" staged={Boolean(pendingPosition)}>
          {view.table.position || pendingPosition ? (
            <DanceCard
              value={view.table.position ?? pendingPosition!}
              compact
              fullArtwork
              onInspect={() => onInspect(view.table.position ?? pendingPosition!)}
            />
          ) : null}
        </TableCard>
        <div className="table-connector flourish-link" aria-hidden="true">
          →
        </div>
        <TableCard label="Flourish">
          {view.table.flourish ? (
            <DanceCard
              value={view.table.flourish}
              compact
              fullArtwork
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
  onLessonDragStart,
  onLessonDragEnd,
  draggingLessonKey,
  pendingLesson,
}: {
  view: PlayerSnapshot;
  onInspect: (
    card: InspectableCard,
    source: HTMLElement,
    lessonSource: LessonBuyAction["source"],
  ) => void;
  onBuyLesson: (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    sourceButton: HTMLButtonElement,
  ) => void;
  onLessonDragStart: (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  onLessonDragEnd: () => void;
  draggingLessonKey: string | null;
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
          const draggable = Boolean(buy && !pendingLesson);
          const lessonKey = `${source}:${card.id}`;
          return (
            <DanceCard
              key={`${source}-${card.id}-${index}`}
              value={card}
              compact
              disabled={!buy || Boolean(pendingLesson)}
              actionLabel={purchasePending ? "Learning…" : `Learn · $${cost}`}
              onAction={buy ? (event) => onBuyLesson(card, buy, event.currentTarget) : undefined}
              onInspect={(element) => onInspect(card, element, source)}
              draggable={draggable}
              dragging={draggingLessonKey === lessonKey}
              onDragStart={
                buy && draggable ? (event) => onLessonDragStart(card, buy, event) : undefined
              }
              onDragEnd={draggable ? onLessonDragEnd : undefined}
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
  onCleanup,
  cleanupPending,
  pendingPosition,
  cancelPendingPosition,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  onCleanup: (action: CleanupAction) => void;
  cleanupPending: boolean;
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
        <div className="setup-heading">
          <small>Opening hand</small>
          <strong>Ready to dance?</strong>
          <p>You begin in Open Position. Look for a Move you can dance from Open.</p>
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
    const moves = byType("PLAY_MOVE");
    const transitions = byType("TRANSITION");
    const flourishes = byType("PLAY_FLOURISH");
    const end = byType("END_DANCE")[0];
    const stumbles = byType("STUMBLE");
    const undo = byType("UNDO_TURN")[0];
    const establishedFloor = view.table.position !== null;
    const beforeMove = establishedFloor && view.turn.moveCardId === null;
    const floorPosition = currentFloorPosition(view);
    const danceHeading = pendingPosition
      ? "Complete the opening"
      : openings.length > 0
        ? "Open the floor with a Position"
        : beforeMove
          ? "Play a Move first"
          : transitions.length > 0
            ? "Move played — add a Position"
            : flourishes.length > 0
              ? "Add a Flourish—or finish"
              : "Finish the 8-count";
    const danceInstruction = beforeMove
      ? moves.length > 0
        ? `Current Position: ${floorPosition}. Play a Move whose top edge includes ${floorPosition}. Or choose Dance the basic or Stumble below.`
        : `No Move in your hand includes ${floorPosition}. Dance the basic or Stumble below.`
      : view.turn.moveCardId !== null
        ? transitions.length > 0 && flourishes.length > 0
          ? "Your Move is on the floor. Add a highlighted Position or Flourish, or finish."
          : transitions.length > 0
            ? "Your Move is on the floor. Add a highlighted Position, or finish the 8-count."
            : flourishes.length > 0
              ? "Your Move is on the floor. Add a highlighted Flourish, or finish the 8-count."
              : "Your Move is on the floor. Finish the 8-count when you’re ready."
        : null;
    return (
      <div className="turn-actions">
        <div className="step-heading">
          <span>2</span>
          <div>
            <small>Dance</small>
            <strong>{danceHeading}</strong>
            {danceInstruction && <span className="dance-step-note">{danceInstruction}</span>}
          </div>
        </div>
        {openings.length > 0 && (
          <div className="opening-drag-guide" aria-live="polite">
            <small>Opening play</small>
            <span>
              {pendingPosition
                ? `${pendingPosition.card.name} is staged. Play a highlighted matching Move next.`
                : "Stage any highlighted Position from your hand, then add a Move that dances from it."}
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
            <span className="cleanup-note">Your whole remaining hand discards automatically.</span>
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
          <button
            type="button"
            className="button gold"
            disabled={!done || cleanupPending}
            onClick={() => done && onCleanup(done)}
          >
            {cleanupPending ? "Discarding hand…" : "Finish turn · discard hand"}
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
  return null;
}

function Hand({
  view,
  intent,
  dispatch,
  onPlayCard,
  onInspect,
  pendingPosition,
  draggableCardIds,
  draggingCardId,
  onCardDragStart,
  onCardDragEnd,
  discardTargetRef,
  discardReceiving,
  acceptsLessonDrop,
  lessonDropOver,
  onLessonDragOverChange,
  onLessonDrop,
  onOpenDiscard,
}: {
  view: PlayerSnapshot;
  intent: TurnIntent;
  dispatch: (action: GameAction) => void;
  onPlayCard: (instanceId: string) => void;
  onInspect: (card: InspectableCard, source?: HTMLElement) => void;
  pendingPosition: CardView | null;
  draggableCardIds: Set<string>;
  draggingCardId: string | null;
  onCardDragStart: (instanceId: string, event: React.DragEvent<HTMLElement>) => void;
  onCardDragEnd: () => void;
  discardTargetRef: React.RefObject<HTMLButtonElement | null>;
  discardReceiving: boolean;
  acceptsLessonDrop: boolean;
  lessonDropOver: boolean;
  onLessonDragOverChange: (over: boolean) => void;
  onLessonDrop: (lessonKey: string) => void;
  onOpenDiscard: () => void;
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
          {draggableCardIds.size > 0 && (
            <span className="hand-play-hint">Drag a highlighted card or click it to play</span>
          )}
        </div>
        <div>
          <span>Deck {view.self.drawCount}</span>
          <button
            type="button"
            ref={discardTargetRef}
            className={`discard-pile-target ${discardReceiving ? "receiving" : ""} ${acceptsLessonDrop ? "accepts-lesson-drop" : ""} ${lessonDropOver ? "lesson-drop-over" : ""}`}
            aria-label={
              acceptsLessonDrop
                ? "Drop lesson here to buy it"
                : `View discard pile, ${view.self.discardCount} cards`
            }
            aria-haspopup="dialog"
            onClick={onOpenDiscard}
            onDragEnter={(event) => {
              if (!acceptsLessonDrop) return;
              event.preventDefault();
              onLessonDragOverChange(true);
            }}
            onDragOver={(event) => {
              if (!acceptsLessonDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              onLessonDragOverChange(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              onLessonDragOverChange(false);
            }}
            onDrop={(event) => {
              if (!acceptsLessonDrop) return;
              event.preventDefault();
              const lessonKey = event.dataTransfer.getData("application/x-clave-lesson");
              onLessonDragOverChange(false);
              if (lessonKey) onLessonDrop(lessonKey);
            }}
          >
            {acceptsLessonDrop
              ? lessonDropOver
                ? "Release to learn"
                : "Drop lesson here"
              : `Discard ${view.self.discardCount}`}
          </button>
        </div>
      </div>
      <div className="hand-scroll">
        {visibleHand.map((entry) => {
          const signal = view.legalActions.find(
            (action) => action.type === "SIGNAL_CARD" && action.instanceId === entry.instanceId,
          );
          const draggable = draggableCardIds.has(entry.instanceId);
          const label = playLabel(draggable ? resolveDrop(view, intent, entry.instanceId) : null);
          return (
            <DanceCard
              key={entry.instanceId}
              value={entry}
              disabled={!isOwnTurn}
              actionLabel={label}
              unavailableReason={unavailableReason(view, intent, entry.instanceId) ?? undefined}
              onAction={label ? () => onPlayCard(entry.instanceId) : undefined}
              onSignal={signal ? () => dispatch(signal) : undefined}
              onInspect={(source) => onInspect(entry, source)}
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

function CleanupCardFlights({
  flight,
  onComplete,
}: {
  flight: CleanupFlight;
  onComplete: () => void;
}) {
  return flight.cards.map((entry, index) => {
    const style = {
      left: entry.from.left,
      top: entry.from.top,
      width: entry.from.width,
      height: entry.from.height,
      "--lesson-flight-x": `${entry.deltaX}px`,
      "--lesson-flight-y": `${entry.deltaY}px`,
      "--lesson-flight-mid-x": `${entry.midpointX}px`,
      "--lesson-flight-mid-y": `${entry.midpointY}px`,
      "--lesson-flight-scale": String(entry.scale),
      "--cleanup-flight-delay": `${entry.delay}ms`,
    } as React.CSSProperties & Record<string, string | number>;
    const isLast = index === flight.cards.length - 1;

    return (
      <div
        key={`${flight.key}-${entry.card.instanceId}`}
        className={`cleanup-card-flight ${flight.flying ? "flying" : "waiting"}`}
        style={style}
        aria-hidden="true"
        onAnimationEnd={(event) => {
          if (isLast && event.target === event.currentTarget) onComplete();
        }}
      >
        <DanceCard value={entry.card} />
      </div>
    );
  });
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

function DiscardPileInspector({
  cards,
  role,
  onInspect,
  onClose,
}: {
  cards: CardView[];
  role: Role;
  onInspect: (card: CardView) => void;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".card-inspector")) onClose();
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
      className="discard-inspector"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-inspector-title"
      onClick={onClose}
    >
      <section className="discard-inspector-panel" onClick={(event) => event.stopPropagation()}>
        <header className="discard-inspector-heading">
          <div>
            <small>Most recent first</small>
            <h2 id="discard-inspector-title">{roleName(role)} discard pile</h2>
            <span>{cards.length} cards</span>
          </div>
          <button ref={closeButton} type="button" className="inspector-close" onClick={onClose}>
            Close
          </button>
        </header>
        {cards.length > 0 ? (
          <div className="discard-card-grid">
            {[...cards].reverse().map((card) => (
              <DanceCard
                key={card.instanceId}
                value={card}
                compact
                onInspect={() => onInspect(card)}
              />
            ))}
          </div>
        ) : (
          <div className="discard-empty">
            <span aria-hidden="true">▱</span>
            <strong>No cards discarded yet</strong>
            <p>Cards you play, replace, or discard at cleanup will collect here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function cardZoomTransform(
  source: { left: number; top: number; width: number; height: number },
  target: DOMRect,
): string {
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;
  return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${scaleX}, ${scaleY})`;
}

function CardInspector({
  inspection,
  actions,
  note,
  onClosed,
}: {
  inspection: CardInspection;
  actions: InspectorAction[];
  note: string | null;
  onClosed: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const onClosedRef = useRef(onClosed);
  const closeRequested = useRef(false);
  const [motionState, setMotionState] = useState<"opening" | "open" | "closing">("opening");

  onClosedRef.current = onClosed;

  const requestClose = useCallback(() => {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setMotionState("closing");
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    closeButton.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [requestClose]);

  useLayoutEffect(() => {
    if (motionState === "open") return;

    const card = content.current?.querySelector<HTMLElement>(".dance-card");
    if (!card) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      if (motionState === "opening") setMotionState("open");
      else onClosedRef.current();
      return;
    }

    const target = card.getBoundingClientRect();
    const storedOrigin = inspection.origin?.rect;
    const liveOrigin = inspection.origin?.element.isConnected
      ? inspection.origin.element.getBoundingClientRect()
      : null;
    const origin = liveOrigin ?? storedOrigin;
    const fromHand = origin ? cardZoomTransform(origin, target) : "translateY(28px) scale(0.86)";
    const keyframes: Keyframe[] =
      motionState === "opening"
        ? [
            { transform: fromHand, opacity: 0.7, filter: "brightness(0.72)" },
            { transform: "none", opacity: 1, filter: "brightness(1)" },
          ]
        : [
            { transform: "none", opacity: 1, filter: "brightness(1)" },
            { transform: fromHand, opacity: 0.62, filter: "brightness(0.72)" },
          ];
    const animation = card.animate(keyframes, {
      duration: motionState === "opening" ? 340 : 260,
      easing:
        motionState === "opening"
          ? "cubic-bezier(0.16, 1, 0.3, 1)"
          : "cubic-bezier(0.4, 0, 0.8, 0.2)",
      fill: "both",
    });
    let cancelled = false;
    void animation.finished
      .then(() => {
        if (cancelled) return;
        if (motionState === "opening") setMotionState("open");
        else onClosedRef.current();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      animation.cancel();
    };
  }, [inspection.origin, motionState]);

  return (
    <div
      className="card-inspector"
      data-motion-state={motionState}
      data-motion-origin={inspection.origin ? "hand" : "generic"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-inspector-title"
      onClick={requestClose}
    >
      <div
        ref={content}
        className="card-inspector-content"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="inspector-hint" id="card-inspector-title">
          Card detail
        </span>
        <DanceCard value={inspection.card} detailed />
        {note && <p className="inspector-note">{note}</p>}
        <div className="inspector-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`button ${action.primary ? "gold" : "outline"}`}
              onClick={() =>
                action.run(content.current?.querySelector<HTMLElement>(".dance-card") ?? null)
              }
            >
              {action.label}
            </button>
          ))}
          <button
            ref={closeButton}
            type="button"
            className="inspector-close"
            onClick={requestClose}
          >
            Close
          </button>
        </div>
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
        <RulesButton />
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
    dispatch: dispatchAction,
    acceptPass: acceptPassAction,
    leaveGame,
    newHotseat,
  } = useAppStore();
  const { play: playSoundEffect } = useSoundEffects();
  const [inspection, setInspection] = useState<CardInspection | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [intent, setIntent] = useState<TurnIntent>(NO_INTENT);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [floorDragOver, setFloorDragOver] = useState(false);
  const [draggingLessonKey, setDraggingLessonKey] = useState<string | null>(null);
  const [lessonDropOver, setLessonDropOver] = useState(false);
  const [lessonFlight, setLessonFlight] = useState<LessonFlight | null>(null);
  const [cleanupFlight, setCleanupFlight] = useState<CleanupFlight | null>(null);
  const [dancerDemoOpen, setDancerDemoOpen] = useState(false);
  const [roomCopyStatus, setRoomCopyStatus] = useState<RoomCopyStatus>("idle");
  const discardTargetRef = useRef<HTMLButtonElement>(null);
  const lessonDragRef = useRef<{
    key: string;
    card: DanceCardDefinition;
    action: LessonBuyAction;
    sourceCard: HTMLElement;
  } | null>(null);
  const lessonFlightKey = useRef(0);
  const cleanupFlightKey = useRef(0);
  const roomCopyReset = useRef<number | null>(null);
  const previousStatus = useRef(view?.status);
  const inspectCard = (
    card: InspectableCard,
    source?: HTMLElement,
    lessonSource?: LessonBuyAction["source"],
  ) => {
    const sourceRect = source?.getBoundingClientRect();
    setInspection({
      card,
      lessonSource,
      origin:
        source && sourceRect
          ? {
              element: source,
              rect: {
                left: sourceRect.left,
                top: sourceRect.top,
                width: sourceRect.width,
                height: sourceRect.height,
              },
            }
          : null,
    });
  };
  const dispatch = (action: GameAction) => {
    playSoundEffect(soundForAction(action));
    dispatchAction(action);
  };
  const acceptPass = () => {
    playSoundEffect("turn");
    acceptPassAction();
  };
  useEffect(() => {
    if (previousStatus.current !== "completed" && view?.status === "completed")
      playSoundEffect("success");
    previousStatus.current = view?.status;
  }, [playSoundEffect, view?.status]);
  useEffect(() => {
    if (view) setIntent((current) => reconcileIntent(view, current));
  }, [view]);
  useEffect(() => {
    setDraggingCardId(null);
    setFloorDragOver(false);
    setDraggingLessonKey(null);
    setLessonDropOver(false);
    lessonDragRef.current = null;
    setDiscardOpen(false);
  }, [view?.sequence, view?.phase, view?.viewerRole, passTo]);
  useEffect(() => setLessonFlight(null), [view?.viewerRole, passTo]);
  useEffect(() => {
    setRoomCopyStatus("idle");
    if (roomCopyReset.current !== null) window.clearTimeout(roomCopyReset.current);
    return () => {
      if (roomCopyReset.current !== null) window.clearTimeout(roomCopyReset.current);
    };
  }, [onlineSeat?.code]);
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
  useEffect(() => {
    if (!cleanupFlight || cleanupFlight.flying || !view) return;
    if (view.sequence <= cleanupFlight.startingSequence) return;
    const frame = window.requestAnimationFrame(() =>
      setCleanupFlight((current) =>
        current?.key === cleanupFlight.key ? { ...current, flying: true } : current,
      ),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [cleanupFlight, view]);
  useEffect(() => {
    if (!cleanupFlight || cleanupFlight.flying) return;
    const timeout = window.setTimeout(
      () => setCleanupFlight((current) => (current?.key === cleanupFlight.key ? null : current)),
      5_000,
    );
    return () => window.clearTimeout(timeout);
  }, [cleanupFlight]);
  const clearSignal = useMemo(
    () => view?.legalActions.find((action) => action.type === "CLEAR_SIGNAL"),
    [view],
  );
  const pendingPosition = useMemo(
    () => (view ? stagedPosition(view, intent) : null),
    [intent, view],
  );
  const draggableCardIds = useMemo(
    () => (view ? floorDraggableIds(view, intent) : new Set<string>()),
    [intent, view],
  );

  const playToFloor = (instanceId: string) => {
    if (!view) return;
    const drop = resolveDrop(view, intent, instanceId);
    if (drop.kind === "ignore") return;
    setIntent(drop.intent);
    if (drop.kind === "stage") playSoundEffect("card-position");
    else dispatch(drop.action);
  };

  const copyRoomCode = async () => {
    if (!onlineSeat) return;
    if (roomCopyReset.current !== null) window.clearTimeout(roomCopyReset.current);
    try {
      await copyText(onlineSeat.code);
      setRoomCopyStatus("copied");
    } catch {
      setRoomCopyStatus("failed");
    }
    roomCopyReset.current = window.setTimeout(() => {
      setRoomCopyStatus("idle");
      roomCopyReset.current = null;
    }, 2_400);
  };

  const buyLesson = (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    sourceElement: HTMLElement,
  ) => {
    if (!view || lessonFlight) return;
    const sourceCard = sourceElement.closest<HTMLElement>(".dance-card");
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
    setInspection(null);
    dispatch(action);
  };

  const beginLessonDrag = (
    card: DanceCardDefinition,
    action: LessonBuyAction,
    event: React.DragEvent<HTMLElement>,
  ) => {
    if (lessonFlight) {
      event.preventDefault();
      return;
    }
    const key = `${action.source}:${card.id}`;
    lessonDragRef.current = { key, card, action, sourceCard: event.currentTarget };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-clave-lesson", key);
    event.dataTransfer.setData("text/plain", card.name);
    setDraggingLessonKey(key);
    setLessonDropOver(false);
    setInspection(null);
  };

  const endLessonDrag = () => {
    lessonDragRef.current = null;
    setDraggingLessonKey(null);
    setLessonDropOver(false);
  };

  const dropLesson = (lessonKey: string) => {
    const lesson = lessonDragRef.current;
    if (!lesson || lesson.key !== lessonKey) return;
    lessonDragRef.current = null;
    setDraggingLessonKey(null);
    setLessonDropOver(false);
    buyLesson(lesson.card, lesson.action, lesson.sourceCard);
  };

  const cleanupTurn = (action: CleanupAction) => {
    if (!view || cleanupFlight) return;
    const cards = [...view.self.hand];
    if (cards.length === 0) {
      dispatch(action);
      return;
    }

    const discardTarget = discardTargetRef.current;
    if (!discardTarget) {
      dispatch(action);
      return;
    }
    const cardElements = new Map(
      Array.from(
        document.querySelectorAll<HTMLElement>(".hand-scroll .dance-card[data-card-instance-id]"),
      ).map((element) => [element.dataset.cardInstanceId, element]),
    );
    const targetRect = discardTarget.getBoundingClientRect();
    const flightCards = cards.flatMap((card, index) => {
      const sourceCard = cardElements.get(card.instanceId);
      if (!sourceCard) return [];
      const sourceRect = sourceCard.getBoundingClientRect();
      const deltaX =
        targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      const deltaY =
        targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
      const spread = index - (cards.length - 1) / 2;
      const arcHeight = Math.min(120, Math.abs(deltaY) * 0.2 + 42);
      return [
        {
          card,
          from: {
            left: sourceRect.left,
            top: sourceRect.top,
            width: sourceRect.width,
            height: sourceRect.height,
          },
          deltaX,
          deltaY,
          midpointX: deltaX * 0.62 + spread * 20,
          midpointY: deltaY * 0.5 - arcHeight - Math.abs(spread) * 6,
          scale: Math.min(0.42, Math.max(0.2, targetRect.width / sourceRect.width)),
          delay: index * 90,
        },
      ];
    });

    if (flightCards.length !== cards.length) {
      dispatch(action);
      return;
    }
    cleanupFlightKey.current += 1;
    setCleanupFlight({
      key: cleanupFlightKey.current,
      startingSequence: view.sequence,
      cards: flightCards,
      flying: false,
    });
    setInspection(null);
    dispatch(action);
  };

  const returnStagedPosition = () => {
    playSoundEffect("undo");
    setIntent(NO_INTENT);
  };

  /** What the enlarged card offers, read from the live snapshot so it never goes stale. */
  const inspectorControls = (
    current: CardInspection,
    view: PlayerSnapshot,
  ): { actions: InspectorAction[]; note: string | null } => {
    const closeThen = (run: () => void) => () => {
      setInspection(null);
      run();
    };
    if (current.lessonSource) {
      const source = current.lessonSource;
      const card = "card" in current.card ? current.card.card : current.card;
      const buy = view.legalActions.find(
        (action): action is LessonBuyAction =>
          action.type === "BUY_LESSON" && action.source === source && action.cardId === card.id,
      );
      if (!buy || lessonFlight) return { actions: [], note: lessonUnavailableReason(view, source) };
      return {
        actions: [
          {
            label: `Learn · $${view.rules.lessonCosts[source]}`,
            primary: true,
            run: (enlargedCard) => {
              if (enlargedCard) buyLesson(card, buy, enlargedCard);
              else closeThen(() => dispatch(buy))();
            },
          },
        ],
        note: null,
      };
    }

    const instanceId = "instanceId" in current.card ? current.card.instanceId : null;
    if (!instanceId || !view.self.hand.some((entry) => entry.instanceId === instanceId))
      return { actions: [], note: null };
    if (pendingPosition?.instanceId === instanceId)
      return {
        actions: [
          {
            label: "Return Position to hand",
            primary: false,
            run: closeThen(returnStagedPosition),
          },
        ],
        note: "Staged on the floor, waiting for a matching Move",
      };

    const actions: InspectorAction[] = [];
    const label = playLabel(
      draggableCardIds.has(instanceId) ? resolveDrop(view, intent, instanceId) : null,
    );
    if (label)
      actions.push({ label, primary: true, run: closeThen(() => playToFloor(instanceId)) });
    const signal = view.legalActions.find(
      (action) => action.type === "SIGNAL_CARD" && action.instanceId === instanceId,
    );
    if (signal)
      actions.push({
        label: "Signal to partner",
        primary: false,
        run: closeThen(() => dispatch(signal)),
      });
    return { actions, note: unavailableReason(view, intent, instanceId) };
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
          <>
            <button
              type="button"
              className={`room-code ${roomCopyStatus}`}
              data-copy-state={roomCopyStatus}
              onClick={() => void copyRoomCode()}
              title="Copy room code"
              aria-label={
                roomCopyStatus === "copied"
                  ? `Room ${onlineSeat.code} copied to clipboard`
                  : roomCopyStatus === "failed"
                    ? `Room ${onlineSeat.code} could not be copied. Tap to try again`
                    : `Copy room code ${onlineSeat.code}`
              }
            >
              <small>
                {roomCopyStatus === "copied"
                  ? "Copied!"
                  : roomCopyStatus === "failed"
                    ? "Copy failed · tap again"
                    : "Room · tap to copy"}
              </small>
              <strong>{onlineSeat.code}</strong>
            </button>
            <span
              className="room-copy-announcement"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {roomCopyStatus === "copied"
                ? `Room ${onlineSeat.code} copied to clipboard.`
                : roomCopyStatus === "failed"
                  ? `Room ${onlineSeat.code} could not be copied. Tap to try again.`
                  : ""}
            </span>
          </>
        ) : (
          <span className="mode-label">Pass & play</span>
        )}
        <RulesButton compact />
        <span className={`connection-status ${connection}`}>
          {mode === "online" ? connection : "saved on device"}
        </span>
      </header>
      <Hud view={view} />
      <div className="game-grid">
        <div className="main-table">
          <SongMoment view={view} />
          <PhraseHistory view={view} onInspect={inspectCard} />
          <DanceTable
            view={view}
            onInspect={inspectCard}
            pendingPosition={pendingPosition}
            acceptsDrop={draggableCardIds.size > 0}
            dragOver={floorDragOver}
            onDragOverChange={setFloorDragOver}
            onCardDrop={playToFloor}
            onOpenDancerDemo={() => setDancerDemoOpen(true)}
          />
          <TurnActions
            view={view}
            dispatch={dispatch}
            onCleanup={cleanupTurn}
            cleanupPending={Boolean(cleanupFlight)}
            pendingPosition={pendingPosition}
            cancelPendingPosition={returnStagedPosition}
          />
          <Hand
            view={view}
            intent={intent}
            dispatch={dispatch}
            onPlayCard={playToFloor}
            onInspect={inspectCard}
            pendingPosition={pendingPosition}
            draggableCardIds={draggableCardIds}
            draggingCardId={draggingCardId}
            onCardDragStart={(instanceId, event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-clave-card", instanceId);
              event.dataTransfer.setData("text/plain", instanceId);
              setDraggingCardId(instanceId);
              setInspection(null);
            }}
            onCardDragEnd={() => {
              setDraggingCardId(null);
              setFloorDragOver(false);
            }}
            discardTargetRef={discardTargetRef}
            discardReceiving={Boolean(lessonFlight?.flying || cleanupFlight?.flying)}
            acceptsLessonDrop={Boolean(draggingLessonKey)}
            lessonDropOver={lessonDropOver}
            onLessonDragOverChange={setLessonDropOver}
            onLessonDrop={dropLesson}
            onOpenDiscard={() => {
              playSoundEffect("card-select");
              setDiscardOpen(true);
            }}
          />
        </div>
        <aside className="game-sidebar">
          <Market
            view={view}
            onInspect={inspectCard}
            onBuyLesson={buyLesson}
            onLessonDragStart={beginLessonDrag}
            onLessonDragEnd={endLessonDrag}
            draggingLessonKey={draggingLessonKey}
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
      {cleanupFlight && (
        <CleanupCardFlights flight={cleanupFlight} onComplete={() => setCleanupFlight(null)} />
      )}
      {passTo && mode === "hotseat" && !cleanupFlight && (
        <PassScreen role={passTo} onReady={acceptPass} />
      )}
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
      {inspection && (
        <CardInspector
          inspection={inspection}
          {...inspectorControls(inspection, view)}
          onClosed={() => setInspection(null)}
        />
      )}
      {discardOpen && (
        <DiscardPileInspector
          cards={view.self.discard}
          role={view.viewerRole}
          onInspect={inspectCard}
          onClose={() => setDiscardOpen(false)}
        />
      )}
      {dancerDemoOpen && <DancerDemo view={view} onClose={() => setDancerDemoOpen(false)} />}
    </main>
  );
}
