"use client";

import { useEffect, useRef, useState } from "react";

/** How long the second press stays available before the button goes back to its first label. */
const CONFIRM_MS = 3500;

/**
 * A button for something that cannot be undone: the first press asks "Press again to confirm", the
 * second does it. If nobody presses again it goes back to how it was. The change is also said aloud
 * (the button keeps focus, so a changed label alone is easy to miss).
 */
export function ConfirmButton({
  label,
  onConfirm,
  pending = false,
}: {
  label: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function press() {
    window.clearTimeout(timer.current);
    if (asking) {
      setAsking(false);
      onConfirm();
      return;
    }
    setAsking(true);
    timer.current = window.setTimeout(() => setAsking(false), CONFIRM_MS);
  }

  return (
    <>
      <button type="button" className={`ac-ghost${asking ? " ac-hot" : ""}`} onClick={press} disabled={pending} aria-busy={pending}>
        {asking ? "Press again to confirm" : label}
      </button>
      <span className="ac-visually-hidden" role="status">
        {asking ? `${label}: press again to confirm.` : ""}
      </span>
    </>
  );
}
