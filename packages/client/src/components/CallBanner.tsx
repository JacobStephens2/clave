import type { CallStanding } from "../turn-intent.js";

/**
 * The call standing over the 8-count being danced. It shows on both devices: the player
 * answering it reads what to dance and what dropping it costs, the partner who made it watches
 * it land. The met state is a word and a mark, never colour alone. Covering it is a control, so
 * it sits with the others.
 */
export function CallBanner({ call }: { call: CallStanding }) {
  return (
    <section
      className={`call-banner ${call.answering ? "answering" : "watching"} ${call.met ? "met" : "unmet"}`}
      aria-label="The call standing over this 8-count"
    >
      <div className="call-banner-ask">
        <small>{call.answering ? "A call stands over you" : "Your call stands"}</small>
        <strong>{call.headline}</strong>
        <p>{call.ask}</p>
        <span className="call-reward">{call.reward}</span>
        {/* The price of letting it go, printed where the answer is being decided. */}
        {call.price && <span className="call-price">{call.price}</span>}
      </div>
      <b className="call-state" role="status">
        <span aria-hidden="true">{call.met ? "✓" : "○"}</span> {call.state}
      </b>
    </section>
  );
}
