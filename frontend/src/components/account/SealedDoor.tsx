"use client";

import { useEffect, useRef } from "react";

import { startGalaxy } from "@/lib/galaxy";

/** The door's steps, as in the design: four slabs, each wider than the one above. */
const STEPS = [0, 1, 2, 3].map((i) => ({ y: 330 + i * 16, halfWidth: 88 + i * 26, light: i % 2 === 0 }));

/**
 * A sealed door under a night sky: two leaves that slide apart when `open`, on a galaxy that turns
 * slowly behind them. Decoration only (the form beside it says what is happening), so it is hidden
 * from assistive technology; with reduced motion the galaxy is still and the leaves move at once.
 */
export function SealedDoor({ open }: { open: boolean }) {
  const galaxy = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = galaxy.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return startGalaxy(canvas, !reduced);
  }, []);

  return (
    <div className="ac-dwrap" aria-hidden="true">
      <div className={`ac-door${open ? " ac-open" : ""}`} data-testid="door">
        <div className="ac-glow" />
        <i className="ac-cloud ac-a" />
        <i className="ac-cloud ac-b" />
        <svg className="ac-frame" viewBox="0 0 300 400" focusable="false">
          <defs>
            <linearGradient id="ac-col" x1="0" x2="1">
              <stop offset="0" stopColor="#efe5cb" />
              <stop offset=".6" stopColor="#b8aa88" />
              <stop offset="1" stopColor="#6b6149" />
            </linearGradient>
            <linearGradient id="ac-rs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a3f31" />
              <stop offset="1" stopColor="#241d17" />
            </linearGradient>
          </defs>
          <g>
            {STEPS.map((step) => (
              <g key={step.y}>
                <rect x={150 - step.halfWidth} y={step.y + 7} width={step.halfWidth * 2} height="9" fill="url(#ac-rs)" />
                <rect x={150 - step.halfWidth} y={step.y} width={step.halfWidth * 2} height="7" fill={step.light ? "#c3b389" : "#b3a27a"} />
                <rect x={150 - step.halfWidth} y={step.y} width={step.halfWidth * 2} height="1.2" fill="#efe3bd" opacity=".8" />
              </g>
            ))}
          </g>
          <g filter="drop-shadow(0 0 8px rgba(242,197,92,.3))">
            <rect x="80" y="195" width="14" height="135" fill="url(#ac-col)" />
            <rect x="206" y="195" width="14" height="135" fill="url(#ac-col)" />
            <rect x="76" y="326" width="22" height="7" fill="#d6c9a6" />
            <rect x="202" y="326" width="22" height="7" fill="#d6c9a6" />
            <path d="M87 195A63 63 0 0 1 213 195" fill="none" stroke="url(#ac-col)" strokeWidth="16" />
            <path d="M79 195A71 71 0 0 1 221 195" fill="none" stroke="#f3e8c8" strokeWidth="1" opacity=".8" />
          </g>
        </svg>
        <div className="ac-op">
          <canvas ref={galaxy} width={448} height={574} />
          <div className="ac-lf ac-l" />
          <div className="ac-lf ac-r" />
        </div>
        <svg className="ac-sig" viewBox="0 0 40 40" focusable="false">
          <circle cx="20" cy="20" r="17" fill="rgba(20,16,10,.7)" stroke="#f2c55c" strokeWidth="1.2" />
          <path d="M20 7l2.6 9.4L32 20l-9.4 2.6L20 33l-2.6-10.4L8 20l9.4-3.6z" fill="#f2c55c" />
        </svg>
        <span className="ac-dcap">{open ? "Open" : "Sealed"}</span>
      </div>
    </div>
  );
}
