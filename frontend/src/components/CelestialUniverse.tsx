"use client";

import Link from "next/link";
import { useState } from "react";

import { spreadLongitudes, wheelPoint } from "@/lib/chartGeometry";
import { RASHI_NAMES, WESTERN_SIGNS, planetAbbr } from "@/lib/chartLabels";
import {
  MODES,
  frameFor,
  describeBody,
  placeAngle,
  ringTransform,
  signAt,
  type Mode,
  type RingState,
  type SkyBody,
  type Zodiac,
} from "@/lib/universe";

export interface UniverseSky {
  moment: string;
  ayanamsa: number;
  bodies: SkyBody[];
}

export interface UniverseNatal {
  ayanamsa: number;
  bodies: SkyBody[];
  /** The ascendant's tropical longitude, when the birth time is known. */
  ascendant: number | null;
}

const C = 300;
const RING_OUTER = 280;
const RING_INNER = 236;
const NATAL_RADIUS = 104;
const SKY_GLYPH = 13;
const NATAL_GLYPH = 9;

/** How close two labels on one track may sit, in degrees, before they are
 * nudged apart (about a glyph's width at that track's radius). */
const SKY_GAP = 11;
const NATAL_GAP = 15;

function formatMoment(iso: string): string {
  // Fixed locale and zone so the server and the browser print the same text.
  return `${new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

function sector(
  inner: number,
  outer: number,
  from: number,
  to: number,
): string {
  const a = wheelPoint(C, C, outer, from, 0);
  const b = wheelPoint(C, C, outer, to, 0);
  const c = wheelPoint(C, C, inner, to, 0);
  const d = wheelPoint(C, C, inner, from, 0);
  // Longitude runs counter-clockwise on screen, which is SVG's sweep-flag 0.
  return `M${a.x} ${a.y} A${outer} ${outer} 0 0 0 ${b.x} ${b.y} L${c.x} ${c.y} A${inner} ${inner} 0 0 1 ${d.x} ${d.y}Z`;
}

/** One ring of twelve signs. It is drawn once, at rest; the pose it is
 * given (turned, scaled, faded) is what moves. The labels are turned back by
 * the same angle so they stay upright while the ring turns. */
function Ring({
  names,
  state,
  tone,
}: {
  names: readonly string[];
  state: RingState;
  tone: "amber" | "teal";
}) {
  const stroke =
    tone === "amber" ? "stroke-amber-300/40" : "stroke-teal-300/40";
  const text = tone === "amber" ? "fill-amber-100" : "fill-teal-100";
  const middle = (RING_OUTER + RING_INNER) / 2;
  return (
    <g
      className="universe-move"
      style={{
        transformOrigin: `${C}px ${C}px`,
        transform: ringTransform(state),
        opacity: state.opacity,
      }}
    >
      {names.map((name, index) => {
        const label = wheelPoint(C, C, middle, index * 30 + 15, 0);
        return (
          <g key={name}>
            <path
              d={sector(RING_INNER, RING_OUTER, index * 30, index * 30 + 30)}
              className={`${stroke} ${index % 2 === 0 ? "fill-slate-800/70" : "fill-slate-900/60"}`}
              strokeWidth={1}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`universe-move ${text} text-[13px]`}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: `rotate(${-state.rotate}deg)`,
              }}
            >
              {name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Glyph({
  body,
  radius,
  angle,
  size,
  tone,
  selected,
  label,
  onSelect,
  moves,
}: {
  body: SkyBody;
  radius: number;
  angle: number;
  size: number;
  tone: "sky" | "natal";
  selected: boolean;
  label: string;
  onSelect: () => void;
  moves: boolean;
}) {
  const colours =
    tone === "sky"
      ? "fill-amber-300 stroke-amber-100"
      : "fill-teal-300 stroke-teal-100";
  return (
    <g
      className={moves ? "universe-move" : undefined}
      style={{
        transformOrigin: `${C}px ${C}px`,
        transform: `rotate(${angle}deg) translateX(${radius}px)`,
      }}
    >
      {/* Drawn at the centre of the wheel, so turning about it and sliding
          out along the radius puts the glyph on its track. */}
      <g transform={`translate(${C} ${C})`}>
        <g style={{ transform: `rotate(${-angle}deg)` }}>
          {selected && (
            <circle
              r={size + 6}
              className="fill-none stroke-white"
              strokeWidth={2}
            />
          )}
          {/* The disc is the button, and nothing is inside it: the letters
              beside it are decoration, and visible text that a button's name
              does not contain as a word fails WCAG 2.5.3. */}
          <circle
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected}
            onClick={onSelect}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }}
            r={size}
            className={`${colours} cursor-pointer outline-none hover:stroke-white focus-visible:stroke-white focus-visible:[stroke-width:3px]`}
            strokeWidth={1.5}
            fillOpacity={0.95}
          >
            <title>{label}</title>
          </circle>
          <text
            aria-hidden="true"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-950 text-[11px] font-semibold"
            style={{ pointerEvents: "none" }}
          >
            {planetAbbr(body.name)}
          </text>
          {body.retrograde && (
            <text
              aria-hidden="true"
              x={size - 1}
              y={-size + 1}
              className={
                tone === "sky"
                  ? "fill-rose-300 text-[10px]"
                  : "fill-rose-300 text-[9px]"
              }
              style={{ pointerEvents: "none" }}
            >
              R
            </text>
          )}
        </g>
      </g>
    </g>
  );
}

const EXPLANATION: Record<Mode, string> = {
  vedic:
    "The sidereal zodiac, which the Vedic tradition uses: signs are measured against the fixed stars.",
  western:
    "The tropical zodiac, which Western astrology uses: signs are measured from the equinox.",
  compare:
    "Both zodiacs at once. The inner ring is the Vedic one, turned back from the Western one by the ayanamsa; each planet sits in the signs of both.",
};

export function CelestialUniverse({
  sky,
  natal,
}: {
  sky: UniverseSky;
  natal?: UniverseNatal;
}) {
  const [mode, setMode] = useState<Mode>("vedic");
  const [selected, setSelected] = useState<{
    kind: "sky" | "natal";
    name: string;
  } | null>(null);

  const frame = frameFor(mode, sky.ayanamsa);

  // Display positions: nudged apart where bodies crowd, in the order given.
  const skyAngles = spreadLongitudes(
    sky.bodies.map((b) => b.tropical),
    SKY_GAP,
  ).map(placeAngle);
  const natalAngles = natal
    ? spreadLongitudes(
        natal.bodies.map((b) => b.tropical),
        NATAL_GAP,
      ).map(placeAngle)
    : [];

  const chosen =
    selected &&
    (selected.kind === "sky" ? sky.bodies : (natal?.bodies ?? [])).find(
      (b) => b.name === selected.name,
    );
  const chosenAyanamsa =
    selected?.kind === "natal" && natal ? natal.ayanamsa : sky.ayanamsa;

  const question = chosen
    ? selected?.kind === "natal"
      ? `How does my ${chosen.name} read in my chart?`
      : `What does ${chosen.name} moving through ${signAt(chosen.tropical, sky.ayanamsa, "vedic").sign} mean for my chart?`
    : "";

  return (
    <section
      aria-label="The sky"
      className="flex flex-col gap-4 panel p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-lg font-semibold text-amber-300">
            The sky now
          </h2>
          <p className="text-xs text-slate-400">
            As of {formatMoment(sky.moment)}
          </p>
        </div>
        <div
          role="group"
          aria-label="Zodiac shown"
          className="flex gap-1 text-sm"
        >
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-md px-3 py-1.5 transition ${
                mode === option.value
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
        <svg
          viewBox="0 0 600 600"
          role="group"
          aria-label="The planets in the zodiac. Choose one for details; the table below lists every position."
          className="mx-auto w-full max-w-[34rem]"
          data-mode={mode}
        >
          <defs>
            <radialGradient id="universe-glow">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r={RING_INNER} fill="url(#universe-glow)" />
          {[NATAL_RADIUS, 156, 198].map((radius) => (
            <circle
              key={radius}
              cx={C}
              cy={C}
              r={radius}
              className="fill-none stroke-slate-600/40"
              strokeDasharray="2 6"
            />
          ))}

          <g data-ring="western">
            <Ring names={WESTERN_SIGNS} state={frame.western} tone="amber" />
          </g>
          <g data-ring="vedic">
            <Ring names={RASHI_NAMES} state={frame.vedic} tone="teal" />
          </g>

          <circle cx={C} cy={C} r={5} className="fill-amber-300" />

          {natal && natal.ascendant !== null && (
            <g
              style={{
                transformOrigin: `${C}px ${C}px`,
                transform: `rotate(${placeAngle(natal.ascendant)}deg)`,
              }}
            >
              <g transform={`translate(${C} ${C})`}>
                <line
                  x1={58}
                  y1={0}
                  x2={NATAL_RADIUS + 22}
                  y2={0}
                  className="stroke-teal-300/70"
                  strokeWidth={1.5}
                />
                <g transform={`translate(${NATAL_RADIUS + 38} 0)`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-teal-200 text-[10px] font-semibold"
                    style={{
                      transform: `rotate(${-placeAngle(natal.ascendant)}deg)`,
                    }}
                  >
                    ASC
                  </text>
                </g>
              </g>
            </g>
          )}

          {natal?.bodies.map((body, index) => (
            <Glyph
              key={`natal-${body.name}`}
              body={body}
              radius={NATAL_RADIUS}
              angle={natalAngles[index]}
              size={NATAL_GLYPH}
              tone="natal"
              moves={false}
              selected={
                selected?.kind === "natal" && selected.name === body.name
              }
              label={`Your natal ${describeBody(body, natal.ayanamsa, mode)}`}
              onSelect={() => setSelected({ kind: "natal", name: body.name })}
            />
          ))}

          {sky.bodies.map((body, index) => (
            <Glyph
              key={`sky-${body.name}`}
              body={body}
              radius={frame.skyRadius}
              angle={skyAngles[index]}
              size={SKY_GLYPH}
              tone="sky"
              moves
              selected={selected?.kind === "sky" && selected.name === body.name}
              label={`Now: ${describeBody(body, sky.ayanamsa, mode)}`}
              onSelect={() => setSelected({ kind: "sky", name: body.name })}
            />
          ))}
        </svg>

        <aside
          aria-live="polite"
          className="flex flex-col gap-3 text-sm text-slate-300"
        >
          <p className="text-slate-400">{EXPLANATION[mode]}</p>
          <p className="text-xs text-slate-400">
            The two zodiacs differ by {sky.ayanamsa.toFixed(2)}°, the ayanamsa.
            The planets do not move when you change zodiac; the ring of signs
            turns around them.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>
              <span className="text-amber-300">●</span> the sky now
            </span>
            {natal && (
              <span>
                <span className="text-teal-300">●</span> your birth chart
              </span>
            )}
          </p>

          {chosen ? (
            <div className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3">
              <p className="font-medium text-slate-100">
                {selected?.kind === "natal"
                  ? `Your natal ${chosen.name}`
                  : `${chosen.name} now`}
                {chosen.retrograde && (
                  <span className="ml-1 text-xs font-normal text-rose-300">
                    retrograde
                  </span>
                )}
              </p>
              {(["vedic", "western"] as Zodiac[]).map((zodiac) => {
                const where = signAt(chosen.tropical, chosenAyanamsa, zodiac);
                return (
                  <p
                    key={zodiac}
                    className={
                      mode !== "compare" && mode !== zodiac
                        ? "text-slate-500"
                        : ""
                    }
                  >
                    <span className="text-slate-400">
                      {zodiac === "vedic" ? "Vedic" : "Western"}:{" "}
                    </span>
                    {where.sign} {where.degrees.toFixed(1)}°
                  </p>
                );
              })}
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Link
                  href={`/?q=${encodeURIComponent(question)}#ask`}
                  className="text-amber-300 underline underline-offset-2"
                >
                  Ask the Guide
                </Link>
                <Link
                  href="/chart"
                  className="text-amber-300 underline underline-offset-2"
                >
                  Explore {chosen.name}
                </Link>
              </p>
            </div>
          ) : (
            <p className="text-slate-400">
              Choose a planet to see its sign in each zodiac.
            </p>
          )}
        </aside>
      </div>

      <p className="text-xs text-slate-500">
        Bodies that sit close together are nudged apart so they stay readable;
        the table gives the exact positions. Only the nine grahas are shown,
        since the Western outer planets have no Vedic counterpart.
      </p>

      <details className="text-sm text-slate-300">
        <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
          Positions as text
        </summary>
        <div
          className="mt-2 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Sky positions table"
        >
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 pr-3 font-medium">Body</th>
                <th className="py-1 pr-3 font-medium">Now, Vedic</th>
                <th className="py-1 pr-3 font-medium">Now, Western</th>
                {natal && (
                  <th className="py-1 pr-3 font-medium">Your chart, Vedic</th>
                )}
                {natal && (
                  <th className="py-1 font-medium">Your chart, Western</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sky.bodies.map((body) => {
                const own = natal?.bodies.find((b) => b.name === body.name);
                const cell = (b: SkyBody, ayanamsa: number, zodiac: Zodiac) => {
                  const where = signAt(b.tropical, ayanamsa, zodiac);
                  return `${where.sign} ${where.degrees.toFixed(1)}°`;
                };
                return (
                  <tr key={body.name} className="border-t border-slate-800">
                    <th
                      scope="row"
                      className="py-1 pr-3 font-medium text-slate-200"
                    >
                      {body.name}
                      {body.retrograde ? " (R)" : ""}
                    </th>
                    <td className="py-1 pr-3">
                      {cell(body, sky.ayanamsa, "vedic")}
                    </td>
                    <td className="py-1 pr-3">
                      {cell(body, sky.ayanamsa, "western")}
                    </td>
                    {natal && (
                      <td className="py-1 pr-3">
                        {own ? cell(own, natal.ayanamsa, "vedic") : "-"}
                      </td>
                    )}
                    {natal && (
                      <td className="py-1">
                        {own ? cell(own, natal.ayanamsa, "western") : "-"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
