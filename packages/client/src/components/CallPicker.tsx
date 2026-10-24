import { useEffect, useRef, useState } from "react";
import type { GameAction } from "@clave/engine";
import type { CallPicker as CallPickerReading } from "../turn-intent.js";

export const CALL_SHEET_ID = "call-sheet";
const CLOSED_ID = "call-picker-closed";

/**
 * The disclosure beside "take the song". Disabled with one short line when the rules close the
 * window: no call crosses a phrase ending, and none is made from a floor you did not leave.
 */
export function CallPickerTrigger({
  picker,
  open,
  onOpen,
}: {
  picker: CallPickerReading;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <span className="call-picker">
      <button
        type="button"
        className="button outline call-picker-trigger"
        aria-expanded={open}
        aria-controls={CALL_SHEET_ID}
        aria-describedby={picker.closed ? CLOSED_ID : undefined}
        disabled={picker.options.length === 0}
        onClick={onOpen}
      >
        {picker.label}
      </button>
      {picker.closed && (
        <small className="call-picker-closed" id={CLOSED_ID}>
          {picker.closed}
        </small>
      )}
    </span>
  );
}

/**
 * The calls, as a sheet over the table rather than another row in it. Escape closes it and the
 * focus goes back to the trigger; each option is one button a screen reader hears whole.
 */
export function CallSheet({
  picker,
  onChoose,
  onClose,
}: {
  picker: CallPickerReading;
  onChoose: (action: GameAction) => void;
  onClose: () => void;
}) {
  const firstOption = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  // Read during the first render: once this sheet commits, the table behind it turns inert
  // and the browser moves focus to the body.
  const [returnFocus] = useState(() => document.activeElement);

  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    firstOption.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [returnFocus]);

  return (
    <div
      className="call-sheet"
      id={CALL_SHEET_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-sheet-title"
      onClick={onClose}
    >
      <section className="call-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <header className="call-sheet-heading">
          <div>
            <small>Say it with the dance</small>
            <h2 id="call-sheet-title">Make a call</h2>
            <p>Your partner answers it on the next 8-count.</p>
          </div>
          <button type="button" className="inspector-close" onClick={onClose}>
            Close
          </button>
        </header>
        {picker.givesUp && <p className="call-sheet-trade">{picker.givesUp}</p>}
        <ul className="call-option-list">
          {picker.options.map((option, index) => (
            <li key={option.callId}>
              <button
                ref={index === 0 ? firstOption : undefined}
                type="button"
                className={`call-option ${option.favoured ? "favoured" : ""}`}
                aria-label={option.sentence}
                onClick={() => onChoose(option.action)}
              >
                <span className="call-option-name">
                  {option.name}
                  {option.favoured && (
                    <b className="call-favoured" aria-hidden="true">
                      {"★"}
                    </b>
                  )}
                </span>
                <span className="call-option-ask" aria-hidden="true">
                  {option.ask}
                </span>
                <span className="call-option-pays" aria-hidden="true">
                  <b>{option.style > 0 ? `${option.style} Style` : "No Style"}</b>
                  {option.inPocket > 0 && <i>{`★ +${option.inPocket} in the pocket`}</i>}
                  {option.afinque > 0 && <i>{`+${option.afinque} afinque`}</i>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
