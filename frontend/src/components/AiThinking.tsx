/**
 * Shown while a request to the model is running (product spec §26, "AI
 * processing"): celestial bodies joined by moving lines. Decoration only, so
 * the SVG is hidden from assistive technology and the text carries the
 * meaning; with reduced motion requested the lines and pulses stand still.
 */
const NODES = [
  { x: 14, y: 26 },
  { x: 52, y: 10 },
  { x: 90, y: 22 },
  { x: 128, y: 8 },
  { x: 166, y: 24 },
] as const;

const LINKS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 2],
  [1, 3],
  [2, 4],
];

export function AiThinking({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-slate-400">
      <svg viewBox="0 0 180 34" aria-hidden className="h-8 w-36 shrink-0">
        {LINKS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={NODES[from].x}
            y1={NODES[from].y}
            x2={NODES[to].x}
            y2={NODES[to].y}
            className="thinking-line stroke-amber-400/50"
            strokeWidth="1"
          />
        ))}
        {NODES.map((node, index) => (
          <circle
            key={index}
            cx={node.x}
            cy={node.y}
            r="3"
            className="thinking-node fill-amber-300"
            style={{ animationDelay: `${index * 0.25}s` }}
          />
        ))}
      </svg>
      {label}
    </div>
  );
}
