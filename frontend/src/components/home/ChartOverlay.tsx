"use client";

import type { RefObject } from "react";

import {
  CHART,
  GRAHA_LOOK,
  chartCaptions,
  chartOffsets,
  chartPlanet,
  chartPoint,
  chartRings,
  planetRadius,
  ringSectors,
  signsOf,
} from "@/lib/homeScene";
import type { HomeSky } from "@/lib/sky";
import type { Mode } from "@/lib/universe";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "vedic", label: "Vedic" },
  { mode: "compare", label: "Both" },
  { mode: "western", label: "Western" },
];

/**
 * What is inside the doorway: a chart wheel of the sky as it is now, with the planets laid out in
 * order round their signs. Vedic and Western each draw their own ring of signs; Both draws the two
 * side by side, with a dashed ring on each planet whose sign differs between them. The planets stay
 * where they are; only the signs turn. Nothing here is drawn until the visitor steps in, and while
 * they are not inside it is `inert`, so none of it can take focus or be reached by a screen reader.
 */
export function ChartOverlay({
  overlayRef,
  backRef,
  inside,
  drawn,
  mode,
  onMode,
  sky,
  selected,
  onSelect,
  onBack,
}: {
  overlayRef: RefObject<HTMLDivElement | null>;
  backRef: RefObject<HTMLButtonElement | null>;
  inside: boolean;
  drawn: boolean;
  mode: Mode;
  onMode: (mode: Mode) => void;
  sky: HomeSky | null;
  selected: number;
  onSelect: (index: number) => void;
  onBack: () => void;
}) {
  const ayanamsa = sky?.ayanamsa ?? 24;
  const bodies = sky?.bodies ?? [];
  const rings = chartRings(mode, ayanamsa);
  const captions = chartCaptions(mode, ayanamsa);
  const compare = mode === "compare";
  const radius = planetRadius(mode);
  const offsets = chartOffsets(bodies.map((b) => b.tropical), mode);
  const picked = selected >= 0 ? bodies[selected] : undefined;
  const pickedSigns = picked ? signsOf(picked.tropical, ayanamsa) : null;

  return (
    <div ref={overlayRef} className="hm-ov" inert={!inside} style={{ opacity: 0 }}>
      {drawn && (
        <>
          <svg viewBox="0 0 600 740" role="group" aria-label="Chart wheel of the sky now" focusable="false">
            <circle cx={CHART.cx} cy={CHART.cy} r={CHART.disc} fill="rgba(3,6,16,.8)" />
            {rings.map((ring) => (
              <g key={ring.system}>
                {ringSectors(ring).map((sector) => (
                  <g key={sector.label.text}>
                    <path d={sector.path} fill={sector.fill} stroke={sector.stroke} strokeWidth="1" />
                    <text
                      className="hm-sn"
                      fill={ring.gold ? "#f2c55c" : "#cdd5e6"}
                      transform={`translate(${sector.label.x.toFixed(1)} ${sector.label.y.toFixed(1)}) rotate(${sector.label.rotate.toFixed(1)})`}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {sector.label.text}
                    </text>
                  </g>
                ))}
              </g>
            ))}
            <circle cx={CHART.cx} cy={CHART.cy} r={radius - 24} fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="2 5" />

            {bodies.map((body, i) => {
              const place = chartPlanet(body.tropical, mode, ayanamsa, offsets[i]);
              const look = GRAHA_LOOK[body.name] ?? GRAHA_LOOK.Moon;
              const signs = signsOf(body.tropical, ayanamsa);
              const w = look.width * 0.72;
              const h = look.height * 0.72;
              const from = chartPoint(radius + offsets[i] + 14, place.angle);
              const to = chartPoint(212, place.angle);
              return (
                <g key={body.name}>
                  {compare && (
                    <line x1={from[0].toFixed(1)} y1={from[1].toFixed(1)} x2={to[0].toFixed(1)} y2={to[1].toFixed(1)} stroke="rgba(242,197,92,.4)" strokeWidth="1" />
                  )}
                  <g
                    className="hm-pn"
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected === i}
                    aria-label={`${body.name}${body.retrograde ? ", retrograde" : ""}, Western ${signs.western}, Vedic ${signs.vedic}`}
                    transform={`translate(${place.x.toFixed(1)} ${place.y.toFixed(1)})`}
                    onClick={() => onSelect(selected === i ? -1 : i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(selected === i ? -1 : i);
                      }
                    }}
                  >
                    {selected === i && <circle r="23" fill="none" stroke="#f2c55c" strokeWidth="2" />}
                    {compare && place.moved && <circle r="20" fill="none" stroke="#cdd5e6" strokeWidth="1.2" strokeDasharray="3 3" />}
                    <circle className="hm-m" r="16" fill="rgba(3,6,16,.65)" stroke="rgba(242,197,92,.45)" strokeWidth="1" />
                    <image href={`/grahas/${look.slug}.webp`} x={-w / 2} y={-h / 2} width={w} height={h} />
                  </g>
                  {/* the two letters under a planet are decoration: the button already has its full name */}
                  <text className="hm-pc" aria-hidden="true" transform={`translate(${place.x.toFixed(1)} ${(place.y + 27).toFixed(1)})`} textAnchor="middle" dominantBaseline="central">
                    {body.name.slice(0, 2)}
                  </text>
                </g>
              );
            })}

            <text className="hm-ct hm-g" x="300" y="92" textAnchor="middle">{captions.title}</text>
            <text className="hm-ct" x="300" y="346" textAnchor="middle">{captions.centre}</text>
            <text className="hm-ct" x="300" y="364" textAnchor="middle" style={{ fontSize: "8.5px" }}>{captions.centreNote}</text>
            <text className="hm-cp" x="300" y="616" textAnchor="middle">{captions.hint}</text>
            {picked && pickedSigns && (
              <text className="hm-cp" x="300" y="640" textAnchor="middle" style={{ fill: "#f2c55c" }}>
                {picked.name}{picked.retrograde ? " (retrograde)" : ""}: {pickedSigns.western} (Western) · {pickedSigns.vedic} (Vedic)
              </text>
            )}
          </svg>
          <button ref={backRef} type="button" className="hm-back" onClick={onBack}>
            ← Step back out
          </button>
          <div className="hm-ovt" role="group" aria-label="Zodiac">
            {MODES.map((m) => (
              <button key={m.mode} type="button" className="hm-ovb" aria-pressed={mode === m.mode} onClick={() => onMode(m.mode)}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
