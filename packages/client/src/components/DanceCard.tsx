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
  fullArtwork = false,
  disabled = false,
  actionLabel,
  unavailableReason,
  onAction,
  onSignal,
  onInspect,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
}: {
  value: CardView | DanceCardDefinition;
  compact?: boolean;
  fullArtwork?: boolean;
  disabled?: boolean;
  actionLabel?: string | undefined;
  unavailableReason?: string | undefined;
  onAction?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  onSignal?: (() => void) | undefined;
  onInspect?: ((source: HTMLElement) => void) | undefined;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: React.DragEventHandler<HTMLElement> | undefined;
  onDragEnd?: React.DragEventHandler<HTMLElement> | undefined;
}) {
  const card = "card" in value ? value.card : value;
  const details = cardDetails(card);
  const unavailableReasonId =
    unavailableReason && "instanceId" in value
      ? `card-unavailable-${value.instanceId.replaceAll(":", "-")}`
      : undefined;
  return (
    <article
      className={`dance-card ${card.type} tier-${card.tier.toLowerCase()} ${compact ? "compact" : ""} ${fullArtwork ? "full-artwork" : ""} ${disabled ? "disabled" : ""} ${onInspect ? "inspectable" : ""} ${draggable ? "playable" : ""} ${dragging ? "dragging" : ""}`}
      data-card-instance-id={"card" in value ? value.instanceId : undefined}
      tabIndex={onInspect ? 0 : undefined}
      aria-label={onInspect ? `${card.name}. Click to view larger.` : undefined}
      aria-describedby={unavailableReasonId}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        onInspect?.(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (onInspect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onInspect(event.currentTarget);
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
      <div className="card-art">
        <span className="card-art-fallback" aria-hidden="true">
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
        {unavailableReason && (
          <span className="card-unavailable-reason" id={unavailableReasonId}>
            {unavailableReason}
          </span>
        )}
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
