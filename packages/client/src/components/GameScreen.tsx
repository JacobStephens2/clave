import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView, GameAction, PlayerSnapshot, Role } from "@clave/engine";
import { useAppStore, type PartnerPresence } from "../store.js";
import {
  NO_INTENT,
  readDanceStep,
  type DanceTelling,
  type HandOffer,
  type TurnIntent,
} from "../turn-intent.js";
import { DanceCard } from "./DanceCard.js";
import { DancerDemo } from "./DancerDemo.js";
import { MusicButton } from "./MusicPlayer.js";
import { PhraseHistory, comboSummary } from "./PhraseHistory.js";
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

/** What a screen reader hears when the turn or step changes. */
function turnAnnouncement(view: PlayerSnapshot): string {
  if (view.status !== "playing") return "";
  if (view.activeRole !== view.viewerRole) return `${roleName(view.activeRole)}’s 8-count.`;
  if (view.phase === "lesson") return "Your lesson step: learn a card, or finish your turn.";
  const song = view.currentSong;
  return song ? `Your 8-count: ${song.title}. ${song.description}.` : "Your 8-count.";
}

/** Whether the viewer is the one the game is waiting on. */
function viewersTurn(view: PlayerSnapshot | null): boolean {
  if (!view) return false;
  if (view.status === "setup") return view.setupRole === view.viewerRole;
  return view.status === "playing" && view.activeRole === view.viewerRole;
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
    case "ADJUST":
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
    case "COVER_CALL":
      return "discard";
    case "CLEAR_SIGNAL":
    case "UNDO_TURN":
      return "undo";
  }
}

/** What moved on the scoreboard between two snapshots the same viewer saw. */
interface ScoreChange {
  key: number;
  connection: number;
  style: number;
  money: number;
  announcement: string;
}

interface ScoreReading {
  gameId: string;
  viewer: Role;
  sequence: number;
  connection: number;
  style: number;
  money: number;
}

function readScore(view: PlayerSnapshot): ScoreReading {
  return {
    gameId: view.gameId,
    viewer: view.viewerRole,
    sequence: view.sequence,
    connection: view.shared.connection,
    style: view.shared.style,
    money: view.self.money,
  };
}

function scoreChange(previous: ScoreReading, view: PlayerSnapshot): ScoreChange | null {
  if (
    previous.gameId !== view.gameId ||
    previous.viewer !== view.viewerRole ||
    view.sequence <= previous.sequence
  )
    return null;
  const change = {
    connection: view.shared.connection - previous.connection,
    style: view.shared.style - previous.style,
    money: view.self.money - previous.money,
  };
  if (!change.connection && !change.style && !change.money) return null;
  const said = (label: string, value: number) =>
    value ? `${label} ${value > 0 ? "up" : "down"} ${Math.abs(value)}.` : "";
  // Only entries newer than the previous reading, so an undone play is never cited.
  const causes = view.log
    .filter(
      (entry) =>
        entry.sequence > previous.sequence && (entry.kind === "score" || entry.kind === "dance"),
    )
    .map((entry) => entry.message);
  return {
    key: view.sequence,
    ...change,
    announcement: [
      said("Style", change.style),
      said("Connection", change.connection),
      said("Your practice money", change.money),
      ...causes,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function HudDelta({ value, changeKey }: { value: number; changeKey: number }) {
  if (!value) return null;
  return (
    <b key={changeKey} className={`hud-delta ${value > 0 ? "up" : "down"}`} aria-hidden="true">
      {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
    </b>
  );
}

function Hud({
  view,
  change,
  inert,
}: {
  view: PlayerSnapshot;
  change: ScoreChange | null;
  inert: boolean;
}) {
  return (
    <div className="hud" role="group" aria-label="Game score" inert={inert}>
      <div className="hud-stat connection">
        <small>Connection</small>
        <strong>{view.shared.connection}</strong>
        <span>/{view.rules.maximumConnection}</span>
        {change && <HudDelta value={change.connection} changeKey={change.key} />}
      </div>
      <div className="connection-meter" aria-hidden="true">
        {Array.from({ length: view.rules.maximumConnection }, (_, index) => (
          <i key={index} className={index < view.shared.connection ? "filled" : ""} />
        ))}
      </div>
      <div className="hud-stat">
        <small>Style</small>
        <strong>{view.shared.style}</strong>
        {change && <HudDelta value={change.style} changeKey={change.key} />}
      </div>
      <div className="hud-stat">
        <small>Your practice</small>
        <strong>${view.self.money}</strong>
        {change && <HudDelta value={change.money} changeKey={change.key} />}
      </div>
      <div className="hud-stat phrase">
        <small>Phrase {view.phrase.number}</small>
        <strong>
          {view.phrase.count}
          <span>/{view.rules.phraseLength}</span>
        </strong>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {change?.announcement ?? ""}
      </p>
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
          <p>Look for a matching Position and Move.</p>
        </div>
        <div className="song-audio-controls" role="group" aria-label="Audio controls">
          <MusicButton compact />
          <SoundEffectsButton compact />
        </div>
      </div>
    );
  const landed =
    view.phase === "lesson"
      ? [
          view.turn.bonusStyle ? `+${view.turn.bonusStyle} Style` : null,
          view.turn.bonusConnection ? `+${view.turn.bonusConnection} Connection` : null,
        ].filter(Boolean)
      : [];
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
        <p>
          {landed.length > 0 && <b className="song-landed">Landed · {landed.join(" · ")}</b>}
          {view.currentSong.description}
        </p>
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
  stagedPosition,
  floorHint,
  acceptsDrop,
  dragOver,
  onDragOverChange,
  onCardDrop,
  onOpenDancerDemo,
}: {
  view: PlayerSnapshot;
  onInspect: (card: InspectableCard) => void;
  stagedPosition: CardView | null;
  floorHint: string;
  acceptsDrop: boolean;
  dragOver: boolean;
  onDragOverChange: (over: boolean) => void;
  onCardDrop: (instanceId: string) => void;
  onOpenDancerDemo: () => void;
}) {
  const justPlayedMove = view.turn.moveCardId !== null ? view.table.move : null;
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
        <TableCard label="Position" staged={Boolean(stagedPosition)}>
          {view.table.position || stagedPosition ? (
            <DanceCard
              value={view.table.position ?? stagedPosition!}
              compact
              fullArtwork
              onInspect={() => onInspect(view.table.position ?? stagedPosition!)}
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

/** The header chip: where the game is saved, or how the room and the partner are doing. */
function connectionStatus(
  mode: "hotseat" | "online" | null,
  connection: "offline" | "connecting" | "connected" | "reconnecting",
  partner: PartnerPresence | null,
): { state: string; long: string; short: string } {
  if (mode !== "online") return { state: "local", long: "Saved on device", short: "Saved" };
  if (connection === "connecting")
    return { state: "connecting", long: "Connecting…", short: "Connecting" };
  if (connection === "reconnecting")
    return { state: "reconnecting", long: "Reconnecting…", short: "Reconnecting" };
  if (connection === "offline") return { state: "offline", long: "Offline", short: "Offline" };
  if (partner === "away")
    return { state: "partner-away", long: "Partner away", short: "Partner away" };
  if (partner === "absent")
    return { state: "partner-absent", long: "Waiting for partner", short: "Waiting" };
  return partner === "connected"
    ? { state: "connected", long: "Partner here", short: "Partner here" }
    : { state: "connected", long: "Connected", short: "Online" };
}

function InvitePartner({ code }: { code: string }) {
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const grouped = code.match(/.{1,4}/g)?.join(" ") ?? code;
  const link = `${location.origin}/#join=${code}`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Dance Clave with me",
          text: `Join my room: ${grouped}`,
          url: link,
        });
        return;
      }
      await copyText(link);
      setShareStatus("copied");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareStatus("failed");
    }
  };
  return (
    <section className="invite-partner" aria-labelledby="invite-partner-title">
      <div>
        <small id="invite-partner-title">Invite your partner</small>
        <strong className="invite-code">{grouped}</strong>
        <span>On their device: Two devices → Join with this code, or open your invite link.</span>
      </div>
      <button type="button" className="button gold" onClick={() => void share()}>
        {shareStatus === "copied"
          ? "Link copied"
          : shareStatus === "failed"
            ? "Copy failed · try again"
            : "Share invite link"}
      </button>
    </section>
  );
}

function TurnActions({
  view,
  dispatch,
  onCleanup,
  cleanupPending,
  telling,
  returnStagedPosition,
  invite,
  partnerAway,
}: {
  view: PlayerSnapshot;
  dispatch: (action: GameAction) => void;
  onCleanup: (action: CleanupAction) => void;
  cleanupPending: boolean;
  telling: DanceTelling | null;
  returnStagedPosition: () => void;
  /** The room code to share while the partner's seat is still empty. */
  invite: string | null;
  /** The online partner's device has dropped away. */
  partnerAway: boolean;
}) {
  const actions = view.legalActions;
  const byType = <T extends GameAction["type"]>(type: T) =>
    actions.filter((action): action is Extract<GameAction, { type: T }> => action.type === type);
  if (view.status === "setup") {
    const mulligan = byType("MULLIGAN")[0];
    const confirm = byType("CONFIRM_HAND")[0];
    if (!confirm)
      return (
        <div className={`turn-actions waiting-actions ${invite ? "with-invite" : ""}`}>
          {invite && <InvitePartner code={invite} />}
          <strong>
            {invite
              ? `Waiting for the ${roleName(view.setupRole)} to join`
              : partnerAway
                ? `${roleName(view.setupRole)} stepped away`
                : `Waiting for ${roleName(view.setupRole)}`}
          </strong>
          <span>
            {partnerAway ? "The dance resumes when they reconnect." : "Your hand stays private."}
          </span>
        </div>
      );
    return (
      <div className={`turn-actions ${invite ? "with-invite" : ""}`}>
        {invite && <InvitePartner code={invite} />}
        <div className="setup-heading">
          <small>Opening hand</small>
          <strong>Ready to dance?</strong>
          <p>
            Look for a Position and a Move you can dance from it. The Lead chooses the first
            Position.
          </p>
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
        <strong>
          {roleName(view.activeRole)} {partnerAway ? "stepped away" : "is dancing"}
        </strong>
        <span>
          {partnerAway
            ? "The dance resumes when they reconnect."
            : "Watch the floor, not their hand."}
        </span>
      </div>
    );

  if (view.phase === "dance") {
    if (!telling) return null;
    return (
      <div className="turn-actions">
        <div className="step-heading">
          <span>2</span>
          <div>
            <small>Dance</small>
            <strong>{telling.heading}</strong>
            {telling.instruction && <span className="dance-step-note">{telling.instruction}</span>}
          </div>
        </div>
        {telling.openingGuide && (
          <div className="opening-drag-guide" aria-live="polite">
            <small>Opening play</small>
            <span>{telling.openingGuide}</span>
          </div>
        )}
        <div className="button-row wrap">
          {telling.controls.kind === "return" ? (
            <button type="button" className="button outline" onClick={returnStagedPosition}>
              {telling.controls.label}
            </button>
          ) : (
            telling.controls.controls.map((control) => {
              if (control.kind === "end")
                return (
                  <button
                    type="button"
                    className="button gold"
                    key="end"
                    onClick={() => dispatch(control.action)}
                  >
                    {control.label}
                  </button>
                );
              if (control.kind === "stumble")
                return (
                  <button
                    type="button"
                    className="button danger-outline"
                    key={control.action.recoveryInstanceId ?? "plain"}
                    onClick={() => dispatch(control.action)}
                  >
                    {control.label}
                  </button>
                );
              return (
                <button
                  type="button"
                  className="text-button"
                  key="undo"
                  onClick={() => dispatch(control.action)}
                >
                  {control.label}
                </button>
              );
            })
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
  offers,
  staged,
  acceptsDrop,
  dispatch,
  onPlayCard,
  onInspect,
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
  offers: readonly HandOffer[];
  staged: boolean;
  acceptsDrop: boolean;
  dispatch: (action: GameAction) => void;
  onPlayCard: (instanceId: string) => void;
  onInspect: (card: InspectableCard, source?: HTMLElement) => void;
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
  const offerFor = (instanceId: string) => offers.find((offer) => offer.instanceId === instanceId);
  const visibleHand = view.self.hand.filter((entry) => offerFor(entry.instanceId)?.inRow);
  return (
    <section className="hand-zone">
      <div className="hand-heading">
        <div>
          <small>{roleName(view.viewerRole)} hand</small>
          <strong>{visibleHand.length} cards</strong>
          {staged && <span>1 Position staged</span>}
          {acceptsDrop && (
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
          const offer = offerFor(entry.instanceId);
          if (!offer) return null;
          const signal = offer.signal;
          return (
            <DanceCard
              key={entry.instanceId}
              value={entry}
              disabled={!isOwnTurn}
              actionLabel={offer.playLabel ?? undefined}
              unavailableReason={offer.sentence ?? undefined}
              onAction={offer.playLabel ? () => onPlayCard(entry.instanceId) : undefined}
              onSignal={signal ? () => dispatch(signal) : undefined}
              onInspect={(source) => onInspect(entry, source)}
              draggable={offer.draggable}
              dragging={draggingCardId === entry.instanceId}
              onDragStart={
                offer.draggable ? (event) => onCardDragStart(entry.instanceId, event) : undefined
              }
              onDragEnd={offer.draggable ? onCardDragEnd : undefined}
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
  covered,
  onInspect,
  onClose,
}: {
  cards: CardView[];
  role: Role;
  /** An enlarged card sits on top, so this dialog steps out of the tab order. */
  covered: boolean;
  onInspect: (card: CardView) => void;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  // Read during the first render: once this dialog commits, the table behind it turns inert
  // and the browser moves focus to the body.
  const [returnFocus] = useState(() => document.activeElement);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".card-inspector")) {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    closeButton.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [returnFocus]);

  return (
    <div
      className="discard-inspector"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-inspector-title"
      inert={covered}
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

  // Read during the first render, before the table behind the dialog turns inert.
  const [returnFocus] = useState(() => document.activeElement);

  useEffect(() => {
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
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [requestClose, returnFocus]);

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

function SignalPeek({
  card,
  opener,
  onHide,
}: {
  card: CardView;
  opener: Element | null;
  onHide: () => void;
}) {
  const hideButton = useRef<HTMLButtonElement>(null);
  const [returnFocus] = useState(() => opener ?? document.activeElement);
  useEffect(() => {
    hideButton.current?.focus();
    return () => {
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [returnFocus]);
  return (
    <div
      className="signal-peek"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signal-peek-title"
    >
      <small id="signal-peek-title">Show only this card to your partner</small>
      <DanceCard value={card} />
      <button ref={hideButton} type="button" className="button gold" onClick={onHide}>
        Hide it again
      </button>
    </div>
  );
}

function PassScreen({
  role,
  view,
  onReady,
}: {
  role: Role;
  view: PlayerSnapshot;
  onReady: () => void;
}) {
  // All public: the last 8-count, any phrase scoring it triggered, and the next song card.
  const lastCombo = view.status === "playing" ? view.danceHistory.at(-1) : undefined;
  const phraseResult = view.log.find(
    (entry) => entry.sequence === view.sequence && entry.kind === "score" && entry.role === null,
  );
  const nextSong = view.status === "playing" ? view.currentSong : null;
  const readyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => readyButton.current?.focus(), []);
  return (
    <div className="pass-screen" role="dialog" aria-modal="true" aria-labelledby="pass-title">
      <div className="pass-orbit" aria-hidden="true">
        <span>{role === "lead" ? "L" : "F"}</span>
      </div>
      <small>Keep the hand private</small>
      <h2 id="pass-title">
        Pass to the
        <br />
        <em>{roleName(role)}</em>
      </h2>
      <p>When your partner has the screen, tap below.</p>
      <button ref={readyButton} type="button" className="button gold" onClick={onReady}>
        I’m the {roleName(role)}
      </button>
      {(lastCombo || nextSong) && (
        <dl className="pass-recap">
          {lastCombo && (
            <div>
              <dt>Last 8-count</dt>
              <dd>{comboSummary(lastCombo)}</dd>
            </div>
          )}
          {phraseResult && (
            <div className="pass-phrase">
              <dt>Phrase scored</dt>
              <dd>{phraseResult.message}</dd>
            </div>
          )}
          <div>
            <dt>Together</dt>
            <dd>
              Style {view.shared.style} · Connection {view.shared.connection}
            </dd>
          </div>
          {nextSong && (
            <div className="pass-next-song">
              <dt>
                Up next · {String(nextSong.number).padStart(2, "0")} of {view.rules.songLength}
              </dt>
              <dd>
                <strong>{nextSong.title}</strong> {nextSong.description}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function RatingLadder({ view }: { view: PlayerSnapshot }) {
  const score = view.finalScore ?? 0;
  const ladder = [...view.rules.ratings].sort((left, right) => left.minimum - right.minimum);
  const reached = ladder.reduce(
    (found, rating, index) => (score >= rating.minimum ? index : found),
    0,
  );
  const next = ladder[reached + 1];
  return (
    <section className="rating-ladder" aria-label="Performance ratings">
      <ol>
        {ladder.map((rating, index) => (
          <li
            key={rating.name}
            className={index === reached ? "reached" : index < reached ? "passed" : ""}
            aria-current={index === reached ? "true" : undefined}
          >
            <strong>{rating.minimum}+</strong>
            <span>{rating.name}</span>
          </li>
        ))}
      </ol>
      {next && (
        <p>
          {next.minimum - score} more {next.minimum - score === 1 ? "point" : "points"} reaches{" "}
          <em>{next.name}</em>.
        </p>
      )}
    </section>
  );
}

function Terminal({
  view,
  mode,
  inert,
  onInspect,
  onDanceAgain,
  leave,
}: {
  view: PlayerSnapshot;
  mode: "hotseat" | "online" | null;
  inert: boolean;
  onInspect: (card: InspectableCard) => void;
  onDanceAgain: () => void;
  leave: () => void;
}) {
  const won = view.status === "completed";
  const unresumable = view.status === "unresumable";
  const online = mode === "online";
  return (
    <main className="terminal-screen" inert={inert}>
      <div className="terminal-inner">
        <small>
          {won
            ? "The final 8-count"
            : unresumable
              ? "This dance can’t continue"
              : "The connection broke"}
        </small>
        <h2>
          {won ? view.rating?.name : unresumable ? "The floor has changed" : "The dance ends here"}
        </h2>
        {!unresumable && (
          <>
            <div className="final-score">
              <span>{view.finalScore ?? view.shared.style + view.shared.connection}</span>
              <small>{won ? "final score" : "Style + Connection"}</small>
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
          </>
        )}
        <p>
          {won
            ? view.rating?.description
            : unresumable
              ? `${view.terminalReason ?? "This saved dance cannot be read by the current release."} Nothing you did caused this; start a fresh dance.`
              : "Take a breath, find each other, and try the song again."}
        </p>
        {won && <RatingLadder view={view} />}
        {view.danceHistory.length > 0 && (
          <div className="terminal-choreography">
            <PhraseHistory view={view} onInspect={onInspect} />
          </div>
        )}
        <div className="button-row">
          <button type="button" className="button gold" onClick={onDanceAgain}>
            {online ? "Create a new room" : "Dance again"}
          </button>
          <RulesButton />
          <button type="button" className="button outline" onClick={leave}>
            Back home
          </button>
        </div>
        {online && (
          <p className="terminal-hint">
            One of you creates the new room and shares its code; the other joins it from Home.
          </p>
        )}
      </div>
    </main>
  );
}

export function GameScreen() {
  const {
    snapshot: view,
    mode,
    passTo,
    onlineSeat,
    connection,
    partnerPresence,
    dispatch: dispatchAction,
    acceptPass: acceptPassAction,
    leaveGame,
    newHotseat,
    createOnline,
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
  const [latestScoreChange, setLatestScoreChange] = useState<ScoreChange | null>(null);
  const lastScoreReading = useRef<ScoreReading | null>(null);
  const signalReturnFocus = useRef<Element | null>(null);
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
    // The enlarged card closes as the reveal opens; return to its surviving hand card.
    if (action.type === "SIGNAL_CARD")
      signalReturnFocus.current = inspection?.origin?.element ?? document.activeElement;
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
  const myTurn = viewersTurn(view);
  const wasMyTurn = useRef(myTurn);
  useEffect(() => {
    // Online, the partner's device is elsewhere: cue the turn and mark the tab.
    if (mode !== "online") return;
    if (myTurn && !wasMyTurn.current) playSoundEffect("turn");
    wasMyTurn.current = myTurn;
    const baseTitle = document.title.replace(/^Your turn · /, "");
    document.title = myTurn ? `Your turn · ${baseTitle}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [mode, myTurn, playSoundEffect]);
  useEffect(() => {
    if (!view) return;
    const previous = lastScoreReading.current;
    lastScoreReading.current = readScore(view);
    if (previous?.viewer !== view.viewerRole) setLatestScoreChange(null);
    const change = previous ? scoreChange(previous, view) : null;
    if (change) setLatestScoreChange(change);
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
  const step = useMemo(() => (view ? readDanceStep(view, intent) : null), [intent, view]);
  useEffect(() => {
    if (step && step.intent !== intent) setIntent(step.intent);
  }, [intent, step]);
  const clearSignal = step?.clearSignal;

  const playToFloor = (instanceId: string) => {
    if (!step) return;
    const drop = step.offers.find((offer) => offer.instanceId === instanceId)?.drop;
    if (!drop || drop.kind === "ignore") return;
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
    if (!step) return { actions: [], note: null };
    if (current.lessonSource) {
      const source = current.lessonSource;
      const card = "card" in current.card ? current.card.card : current.card;
      const buy = view.legalActions.find(
        (action): action is LessonBuyAction =>
          action.type === "BUY_LESSON" && action.source === source && action.cardId === card.id,
      );
      if (!buy || lessonFlight) return { actions: [], note: step.lessonSentence(source, card.id) };
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
    const offer = instanceId
      ? step.offers.find((entry) => entry.instanceId === instanceId)
      : undefined;
    if (!offer) return { actions: [], note: null };
    if (offer.stagedNote && step.telling?.controls.kind === "return")
      return {
        actions: [
          {
            label: step.telling.controls.label,
            primary: false,
            run: closeThen(returnStagedPosition),
          },
        ],
        note: offer.stagedNote,
      };

    const actions: InspectorAction[] = [];
    if (offer.playLabel)
      actions.push({
        label: offer.playLabel,
        primary: true,
        run: closeThen(() => playToFloor(offer.instanceId)),
      });
    if (offer.signal) {
      const signal = offer.signal;
      actions.push({
        label: "Signal to partner",
        primary: false,
        run: closeThen(() => dispatch(signal)),
      });
    }
    return { actions, note: offer.sentence };
  };

  if (!view || !step)
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
    return (
      <>
        <Terminal
          view={view}
          mode={mode}
          inert={Boolean(inspection)}
          onInspect={inspectCard}
          onDanceAgain={() =>
            mode === "online" ? void createOnline(view.viewerRole) : newHotseat()
          }
          leave={leaveGame}
        />
        {inspection && (
          <CardInspector
            inspection={inspection}
            {...inspectorControls(inspection, view)}
            onClosed={() => setInspection(null)}
          />
        )}
      </>
    );

  const status = connectionStatus(mode, connection, partnerPresence);
  const passScreenOpen = Boolean(passTo && mode === "hotseat" && !cleanupFlight);
  const signalPeekOpen = view.signal?.role === view.viewerRole && mode === "hotseat";
  // While a dialog is up, the table behind it leaves the tab order and the accessibility tree.
  const overlayOpen =
    passScreenOpen || signalPeekOpen || Boolean(inspection) || discardOpen || dancerDemoOpen;

  return (
    <main className="game">
      <header className="game-header" inert={overlayOpen}>
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
        <span
          className={`connection-status ${status.state}`}
          data-connection={mode === "online" ? connection : "local"}
          data-partner={
            mode === "online" && connection === "connected"
              ? (partnerPresence ?? "unknown")
              : undefined
          }
        >
          <span className="status-long">{status.long}</span>
          <span className="status-short" aria-hidden="true">
            {status.short}
          </span>
        </span>
      </header>
      {mode === "online" && connection !== "connected" && (
        <p className="reconnect-banner" role="status">
          {connection === "offline"
            ? "This seat is offline. Head home to reconnect or start a new room."
            : connection === "connecting"
              ? "Connecting to your room…"
              : "Reconnecting to your room… your moves will wait."}
        </p>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        {turnAnnouncement(view)}
      </p>
      <Hud view={view} change={latestScoreChange} inert={overlayOpen} />
      <div className="game-grid" inert={overlayOpen}>
        <div className="main-table">
          <SongMoment view={view} />
          <PhraseHistory view={view} onInspect={inspectCard} />
          <DanceTable
            view={view}
            onInspect={inspectCard}
            stagedPosition={step.stagedPosition}
            floorHint={step.floorHint}
            acceptsDrop={step.acceptsDrop}
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
            telling={step.telling}
            returnStagedPosition={returnStagedPosition}
            invite={
              mode === "online" && partnerPresence === "absent" ? (onlineSeat?.code ?? null) : null
            }
            partnerAway={mode === "online" && partnerPresence === "away"}
          />
          <Hand
            view={view}
            offers={step.offers}
            staged={step.stagedPosition !== null}
            acceptsDrop={step.acceptsDrop}
            dispatch={dispatch}
            onPlayCard={playToFloor}
            onInspect={inspectCard}
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
      {passScreenOpen && passTo && <PassScreen role={passTo} view={view} onReady={acceptPass} />}
      {signalPeekOpen && view.signal && (
        <SignalPeek
          card={view.signal.card}
          opener={signalReturnFocus.current}
          onHide={() => clearSignal && dispatch(clearSignal)}
        />
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
          covered={Boolean(inspection)}
          onInspect={inspectCard}
          onClose={() => setDiscardOpen(false)}
        />
      )}
      {dancerDemoOpen && <DancerDemo view={view} onClose={() => setDancerDemoOpen(false)} />}
    </main>
  );
}
