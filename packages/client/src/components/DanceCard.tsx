import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView } from "@clave/engine";

function cardDetails(card: DanceCardDefinition): {
  type: string;
  detail: string;
  requirement: string;
  style: number | null;
} {
  switch (card.type) {
    case "position":
      return { type: "Position", detail: card.position, requirement: card.position, style: null };
    case "move":
      return {
        type: "Move",
        detail: card.positions.join(" · "),
        requirement: card.positions.join(" / "),
        style: card.style,
      };
    case "flourish":
      return {
        type: card.pose ? "Flourish · Pose" : "Flourish",
        detail: card.positions === "any" ? "Any position" : card.positions.join(" · "),
        requirement: card.positions === "any" ? "Any position" : card.positions.join(" / "),
        style: card.style,
      };
    case "recovery":
      return {
        type: "Recovery",
        detail: `Stumble costs ${card.connectionCost} Connection`,
        requirement:
          card.connectionCost === 0 ? "No Connection cost" : `−${card.connectionCost} Connection`,
        style: null,
      };
  }
}

export function DanceCard({
  value,
  compact = false,
  selected = false,
  disabled = false,
  actionLabel,
  onAction,
  onSignal,
  onInspect,
  onSelect,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
}: {
  value: CardView | DanceCardDefinition;
  compact?: boolean;
  selected?: boolean;
  disabled?: boolean;
  actionLabel?: string | undefined;
  onAction?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  onSignal?: (() => void) | undefined;
  onInspect?: (() => void) | undefined;
  onSelect?: (() => void) | undefined;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: React.DragEventHandler<HTMLElement> | undefined;
  onDragEnd?: React.DragEventHandler<HTMLElement> | undefined;
}) {
  const card = "card" in value ? value.card : value;
  const details = cardDetails(card);
  const selectable = Boolean(onSelect);
  return (
    <article
      className={`dance-card ${card.type} tier-${card.tier.toLowerCase()} ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${selectable ? "selectable" : ""} ${disabled ? "disabled" : ""} ${onInspect ? "inspectable" : ""} ${draggable ? "playable" : ""} ${dragging ? "dragging" : ""}`}
      data-card-instance-id={"card" in value ? value.instanceId : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={onSelect || onInspect ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-label={
        selectable
          ? `${card.name}. ${selected ? "Selected for discard." : "Click to select for discard."}`
          : onInspect
            ? `${card.name}. Click to view larger.`
            : undefined
      }
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (onSelect) onSelect();
        else onInspect?.();
      }}
      onKeyDown={(event) => {
        if ((onSelect || onInspect) && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (onSelect) onSelect();
          else onInspect?.();
        }
      }}
    >
      <div className="card-topline">
        <span className="card-type-top">{details.type}</span>
        <span className="card-requirement-top" title={details.requirement}>
          {details.requirement}
        </span>
        {details.style === null ? (
          <span aria-hidden="true" />
        ) : (
          <span className="card-style-top" aria-label={`${details.style} Style`}>
            +{details.style}
            <small>Style</small>
          </span>
        )}
      </div>
      {selectable && selected && (
        <span className="discard-selection-badge" aria-hidden="true">
          ✓ Selected for discard
        </span>
      )}
      <div className="card-art" aria-hidden="true">
        <span className="card-art-fallback">
          {card.type === "position"
            ? "◇"
            : card.type === "move"
              ? "↝"
              : card.type === "flourish"
                ? "✦"
                : "↺"}
        </span>
        <img
          src={`/card-art/${card.id}.webp`}
          alt=""
          decoding="async"
          draggable={false}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      </div>
      <h4>{card.name}</h4>
      <p>{details.detail}</p>
      {(onAction || onSignal) && (
        <div className="card-actions">
          {onAction && (
            <button type="button" disabled={disabled} onClick={onAction}>
              {actionLabel ?? "Play"}
            </button>
          )}
          {onSignal && (
            <button
              type="button"
              className="signal-button"
              onClick={onSignal}
              aria-label={`Reveal ${card.name} as a signal`}
            >
              Signal
            </button>
          )}
        </div>
      )}
    </article>
  );
}
