import type { DanceCard as DanceCardDefinition } from "@clave/content";
import type { CardView } from "@clave/engine";

function cardDetails(card: DanceCardDefinition): {
  type: string;
  detail: string;
  style: number | null;
} {
  switch (card.type) {
    case "position":
      return { type: "Position", detail: card.position, style: null };
    case "move":
      return { type: "Move", detail: card.positions.join(" · "), style: card.style };
    case "flourish":
      return {
        type: card.pose ? "Flourish · Pose" : "Flourish",
        detail: card.positions === "any" ? "Any position" : card.positions.join(" · "),
        style: card.style,
      };
    case "recovery":
      return {
        type: "Recovery",
        detail: `Stumble costs ${card.connectionCost} Connection`,
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
}: {
  value: CardView | DanceCardDefinition;
  compact?: boolean;
  selected?: boolean;
  disabled?: boolean;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  onSignal?: (() => void) | undefined;
  onInspect?: (() => void) | undefined;
}) {
  const card = "card" in value ? value.card : value;
  const details = cardDetails(card);
  return (
    <article
      className={`dance-card ${card.type} tier-${card.tier.toLowerCase()} ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${disabled ? "disabled" : ""} ${onInspect ? "inspectable" : ""}`}
      tabIndex={onInspect ? 0 : undefined}
      aria-label={onInspect ? `${card.name}. Click to view larger.` : undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        onInspect?.();
      }}
      onKeyDown={(event) => {
        if (onInspect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onInspect();
        }
      }}
    >
      <div className="card-topline">
        <span>{details.type}</span>
        <span>{card.tier}</span>
      </div>
      <div className="card-glyph" aria-hidden="true">
        {card.type === "position"
          ? "◇"
          : card.type === "move"
            ? "↝"
            : card.type === "flourish"
              ? "✦"
              : "↺"}
      </div>
      <h4>{card.name}</h4>
      <p>{details.detail}</p>
      {details.style !== null && (
        <div className="style-pip" aria-label={`${details.style} Style`}>
          +{details.style}
          <small>style</small>
        </div>
      )}
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
