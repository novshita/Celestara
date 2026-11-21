"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A short message that appears at the bottom of the screen and goes by itself. It is a polite live
 * region, so a screen reader says it without moving focus. */
export function useToast(): { show: (message: string) => void; toast: React.ReactNode } {
  const [message, setMessage] = useState("");
  const timer = useRef(0);

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(""), 3600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    show,
    toast: (
      <div className={`ac-toast${message ? " ac-on" : ""}`} role="status">
        {message}
      </div>
    ),
  };
}
