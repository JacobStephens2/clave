import type { PlayerSnapshot } from "@clave/engine";

/**
 * The run of answered calls, beside Connection and Style. The pips are the links, the number
 * beside them what the next answer in the row would add. Hidden in a game whose content
 * prints no calls, where the chain cannot exist.
 */
export function AfinqueMeter({ view }: { view: PlayerSnapshot }) {
  const { links, cap, nextBonus } = view.afinque;
  if (cap === 0) return null;
  return (
    <div className="hud-stat afinque">
      <small aria-hidden="true">Afinque</small>
      <strong aria-hidden="true">
        {links}
        <span>/{cap}</span>
      </strong>
      <span className="afinque-pips" aria-hidden="true">
        {Array.from({ length: cap }, (_, index) => (
          <i key={index} className={index < links ? "filled" : ""} />
        ))}
      </span>
      <span className="afinque-next" aria-hidden="true">
        {`next +${nextBonus}`}
      </span>
      <span className="visually-hidden">
        {`Afinque: ${links} of ${cap} links. ${
          nextBonus > 0
            ? `The next answer adds ${nextBonus} Style.`
            : "The next answer adds no extra Style yet."
        }`}
      </span>
    </div>
  );
}
