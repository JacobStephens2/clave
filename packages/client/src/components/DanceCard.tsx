import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView } from "@clave/engine";
import { alternatives } from "../phrasing.js";

/** How the card plays, phrased from its own data for the enlarged card. */
function rulesText(card: DanceCardDefinition): string {
  switch (card.type) {
    case "move":
      return `Dance it from ${alternatives(card.positions)}: the floor Position must match. Earns ${card.style} Style.`;
    case "position":
      return `Right after your Move, transition the couple to ${card.position}. On an empty floor, open with it and a Move that dances from ${card.position}.`;
    case "flourish": {
      const from =
        card.positions === "any"
          ? "Add it to the Move you danced this 8-count, from any Position."
          : `Add it to the Move you danced this 8-count when that Move started from ${alternatives(card.positions)}.`;
      const pose = card.pose
        ? " A Pose: in a phrase’s final 8-count it earns the Pose finish bonus."
        : "";
      return `${from} Earns ${card.style} Style.${pose}`;
    }
    case "recovery":
      return card.connectionCost === 0
        ? "Play it as you Stumble to lose no Connection."
        : `Play it as you Stumble to lose only ${card.connectionCost} Connection.`;
  }
}

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
  detailed = false,
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
  /** The enlarged card: full requirement text plus how the card plays. */
  detailed?: boolean;
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
      className={`dance-card ${card.type} tier-${card.tier.toLowerCase()} ${compact ? "compact" : ""} ${fullArtwork ? "full-artwork" : ""} ${detailed ? "detailed" : ""} ${disabled ? "disabled" : ""} ${onInspect ? "inspectable" : ""} ${draggable ? "playable" : ""} ${dragging ? "dragging" : ""}`}
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
      {detailed && <p className="card-rules">{rulesText(card)}</p>}
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
