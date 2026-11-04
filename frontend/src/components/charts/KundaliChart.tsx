"use client";

import { useState } from "react";

import {
  NORTH_HOUSES,
  NORTH_SIZE,
  SOUTH_CELLS,
  centroid,
  signNumberForHouse,
} from "@/lib/chartGeometry";
import { RASHI_NAMES, planetAbbr } from "@/lib/chartLabels";
import type { GrahaPlacement, VedicChart } from "@/lib/types";

type Style = "north" | "south";

/** One planet's label in a house; retrograde ones get a small marker. */
function PlanetLabels({ row }: { row: GrahaPlacement[] }) {
  return (
    <>
      {row.map((placement, index) => (
        <tspan key={placement.graha}>
          {index > 0 && "   "}
          {planetAbbr(placement.graha)}
          {placement.retrograde && (
            <tspan className="fill-amber-400 text-[9px]" dx={1}>
              (R)
            </tspan>
          )}
        </tspan>
      ))}
    </>
  );
}

/** Two to a row so a crowded house stays inside its shape. */
function planetRows(placements: GrahaPlacement[]): GrahaPlacement[][] {
  const rows: GrahaPlacement[][] = [];
  for (let i = 0; i < placements.length; i += 2) {
    rows.push(placements.slice(i, i + 2));
  }
  return rows;
}

function NorthIndian({
  placements,
  ascendantIndex,
}: {
  placements: GrahaPlacement[];
  ascendantIndex: number;
}) {
  return (
    <svg
      viewBox={`-2 -2 ${NORTH_SIZE + 4} ${NORTH_SIZE + 4}`}
      role="img"
      aria-labelledby="kundali-title kundali-desc"
      className="w-full max-w-md"
    >
      <title id="kundali-title">North Indian Kundali</title>
      <desc id="kundali-desc">
        The houses are fixed, with the first house at the top; the number in
        each is the sign it holds. The tables below give every value.
      </desc>

      {NORTH_HOUSES.map((vertices, index) => {
        const house = index + 1;
        const centre = centroid(vertices);
        // The sign number sits towards the middle of the chart, as is usual.
        const inner = vertices.reduce((best, vertex) =>
          Math.hypot(vertex[0] - 200, vertex[1] - 200) <
          Math.hypot(best[0] - 200, best[1] - 200)
            ? vertex
            : best,
        );
        const signAt = {
          x: centre.x + (inner[0] - centre.x) * 0.62,
          y: centre.y + (inner[1] - centre.y) * 0.62,
        };
        const here = placements.filter((placement) => placement.bhava === house);
        const rows = planetRows(here);
        return (
          <g key={house}>
            <polygon
              points={vertices.map(([x, y]) => `${x},${y}`).join(" ")}
              pathLength={1}
              className={`chart-ring stroke-amber-400/70 ${house === 1 ? "fill-amber-400/10" : "fill-transparent"}`}
              strokeWidth={1.4}
            />
            <text
              {...signAt}
              textAnchor="middle"
              dominantBaseline="central"
              className="chart-pop fill-slate-500 text-[11px]"
              style={{ animationDelay: "500ms" }}
            >
              {signNumberForHouse(ascendantIndex, house)}
            </text>
            {rows.map((row, rowIndex) => (
              <text
                key={rowIndex}
                x={centre.x}
                y={centre.y + (rowIndex - (rows.length - 1) / 2) * 17 + (house === 1 ? 6 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                className="chart-pop fill-slate-100 text-[13px] font-medium"
                style={{ animationDelay: `${600 + index * 40}ms`, whiteSpace: "pre" }}
              >
                <PlanetLabels row={row} />
              </text>
            ))}
            {house === 1 && (
              <text
                x={centre.x}
                y={centre.y - 38}
                textAnchor="middle"
                className="chart-pop fill-amber-300 text-[10px] font-semibold"
                style={{ animationDelay: "500ms" }}
              >
                Asc
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SouthIndian({
  placements,
  ascendantIndex,
}: {
  placements: GrahaPlacement[];
  ascendantIndex: number | null;
}) {
  const cell = 100;
  return (
    <svg
      viewBox="-2 -2 404 404"
      role="img"
      aria-labelledby="kundali-title kundali-desc"
      className="w-full max-w-md"
    >
      <title id="kundali-title">South Indian Kundali</title>
      <desc id="kundali-desc">
        The signs are fixed, with Aries second from the left on the top row.
        {ascendantIndex === null
          ? " No ascendant is marked because the birth time is unknown."
          : ` The ascendant is marked in ${RASHI_NAMES[ascendantIndex]}.`}{" "}
        The tables below give every value.
      </desc>

      {SOUTH_CELLS.map(([column, row], signIndex) => {
        const here = placements.filter((placement) => placement.rashi_index === signIndex);
        const rows = planetRows(here);
        const x = column * cell;
        const y = row * cell;
        const isAscendant = ascendantIndex === signIndex;
        return (
          <g key={signIndex}>
            <rect
              x={x}
              y={y}
              width={cell}
              height={cell}
              pathLength={1}
              className={`chart-ring stroke-amber-400/70 ${isAscendant ? "fill-amber-400/10" : "fill-transparent"}`}
              strokeWidth={1.4}
            />
            <text
              x={x + (isAscendant ? 20 : 6)}
              y={y + 13}
              className="chart-pop fill-slate-500 text-[9px]"
              style={{ animationDelay: "500ms" }}
            >
              {RASHI_NAMES[signIndex]}
            </text>
            {isAscendant && (
              <>
                <line
                  x1={x}
                  y1={y}
                  x2={x + 16}
                  y2={y + 16}
                  className="stroke-amber-300"
                  strokeWidth={1.4}
                />
                <text
                  x={x + cell - 6}
                  y={y + 13}
                  textAnchor="end"
                  className="fill-amber-300 text-[10px] font-semibold"
                >
                  Asc
                </text>
              </>
            )}
            {rows.map((text, rowIndex) => (
              <text
                key={rowIndex}
                x={x + cell / 2}
                y={y + cell / 2 + 6 + (rowIndex - (rows.length - 1) / 2) * 17}
                textAnchor="middle"
                dominantBaseline="central"
                className="chart-pop fill-slate-100 text-[13px] font-medium"
                style={{ animationDelay: `${600 + signIndex * 40}ms`, whiteSpace: "pre" }}
              >
                <PlanetLabels row={text} />
              </text>
            ))}
          </g>
        );
      })}

      <text
        x={200}
        y={196}
        textAnchor="middle"
        className="display fill-amber-300 text-[16px]"
      >
        Rashi
      </text>
      <text x={200} y={216} textAnchor="middle" className="fill-slate-500 text-[11px]">
        D1 · sidereal
      </text>
    </svg>
  );
}

/**
 * The sidereal chart as a Kundali (product spec §11), in either of the two
 * traditional layouts. The North Indian chart is drawn by house and so needs
 * the ascendant; without a birth time only the South Indian chart, which is
 * drawn by sign, can be shown. The same goes for any house system other than
 * whole sign, whose houses would not each be a single sign.
 */
export function KundaliChart({ chart }: { chart: VedicChart }) {
  const ascendantIndex = chart.ascendant?.rashi_index ?? null;
  const wholeSign = (chart.metadata.config?.house_system ?? "whole_sign") === "whole_sign";
  const northPossible = ascendantIndex !== null && wholeSign;
  const [style, setStyle] = useState<Style>("north");
  const shown: Style = northPossible ? style : "south";

  return (
    <figure className="flex flex-col items-center gap-3">
      {northPossible && (
        <div role="group" aria-label="Chart style" className="flex gap-1 text-sm">
          {(["north", "south"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={shown === value}
              onClick={() => setStyle(value)}
              className={`rounded-md px-3 py-1 transition ${
                shown === value
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {value === "north" ? "North Indian" : "South Indian"}
            </button>
          ))}
        </div>
      )}

      {/* Re-keyed per style so the drawing plays again when it changes. */}
      {shown === "north" && ascendantIndex !== null ? (
        <NorthIndian key="north" placements={chart.placements} ascendantIndex={ascendantIndex} />
      ) : (
        <SouthIndian key="south" placements={chart.placements} ascendantIndex={ascendantIndex} />
      )}

      <figcaption className="text-xs text-slate-500">
        (R) retrograde
        {!northPossible && " · The North Indian layout needs a birth time."}
      </figcaption>
    </figure>
  );
}
