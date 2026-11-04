import { angularDistance, spreadLongitudes, wheelPoint } from "@/lib/chartGeometry";
import { WESTERN_SIGN_ABBR, planetAbbr } from "@/lib/chartLabels";
import type { WesternChart } from "@/lib/types";

const SIZE = 400;
const C = SIZE / 2;
const R_OUTER = 194;
const R_SIGNS = 166;
const R_LABEL = 142;
const R_INNER = 108;
const R_ASPECT = 104;
const LABEL_GAP_DEGREES = 13;

function aspectColor(harmonious: boolean | null): string {
  if (harmonious === null) return "#fcd34d"; // conjunction
  return harmonious ? "#5eead4" : "#fb7185";
}

function line(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

/**
 * The tropical chart as a wheel (product spec §12): the twelve signs round
 * the rim, the planets inside them, the houses as spokes, and the aspects as
 * lines across the middle. The ascendant is at the left when there is one.
 * It draws what the backend calculated and adds nothing.
 */
export function ZodiacWheel({ chart }: { chart: WesternChart }) {
  const hasHouses = chart.houses.length > 0 && chart.angles !== null;
  const rotation = hasHouses && chart.angles ? chart.angles.ascendant : 0;

  const display = spreadLongitudes(
    chart.positions.map((position) => position.longitude),
    LABEL_GAP_DEGREES,
  );
  const at = (radius: number, longitude: number) =>
    wheelPoint(C, C, radius, longitude, rotation);

  const longitudeOf = new Map(chart.positions.map((p) => [p.body, p.longitude]));
  const summary = chart.positions
    .map((p) => `${p.body} ${p.degrees_in_sign.toFixed(0)}° ${p.sign}${p.retrograde ? " retrograde" : ""}`)
    .join(", ");

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`-18 -18 ${SIZE + 36} ${SIZE + 36}`}
        role="img"
        aria-labelledby="western-wheel-title western-wheel-desc"
        className="w-full max-w-md"
      >
        <title id="western-wheel-title">Western birth chart wheel</title>
        <desc id="western-wheel-desc">
          {summary}.{" "}
          {hasHouses
            ? `Ascendant ${chart.angles?.ascendant_sign}.`
            : "No houses are drawn because the birth time is unknown."}{" "}
          The tables below give every value.
        </desc>

        {/* rings */}
        {[R_OUTER, R_SIGNS, R_INNER].map((radius) => (
          <circle
            key={radius}
            cx={C}
            cy={C}
            r={radius}
            pathLength={1}
            fill="none"
            className="chart-ring stroke-amber-400/60"
            strokeWidth={radius === R_OUTER ? 1.5 : 1}
          />
        ))}

        {/* signs: a boundary every 30 degrees and the sign label between */}
        {WESTERN_SIGN_ABBR.map((abbr, index) => {
          const boundary = index * 30;
          return (
            <g key={abbr}>
              <line
                {...line(at(R_SIGNS, boundary), at(R_OUTER, boundary))}
                className="chart-ring stroke-amber-400/60"
                pathLength={1}
                strokeWidth={1}
              />
              <text
                {...at((R_SIGNS + R_OUTER) / 2, boundary + 15)}
                textAnchor="middle"
                dominantBaseline="central"
                className="chart-pop fill-amber-200 text-[11px]"
                style={{ animationDelay: `${index * 40 + 300}ms` }}
              >
                {abbr}
              </text>
            </g>
          );
        })}

        {/* houses: spokes at the cusps, numbered between them */}
        {hasHouses &&
          chart.houses.map((house, index) => {
            const next = chart.houses[(index + 1) % chart.houses.length];
            const mid =
              house.cusp_longitude +
              (((next.cusp_longitude - house.cusp_longitude + 360) % 360) / 2);
            const angle = house.number === 1 || house.number === 10;
            return (
              <g key={house.number}>
                <line
                  {...line(at(R_INNER, house.cusp_longitude), at(R_SIGNS, house.cusp_longitude))}
                  pathLength={1}
                  className={`chart-ring ${angle ? "stroke-amber-300" : "stroke-slate-600"}`}
                  strokeWidth={angle ? 1.6 : 0.8}
                />
                <text
                  {...at(R_INNER + 9, mid)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="chart-pop fill-slate-500 text-[9px]"
                  style={{ animationDelay: "600ms" }}
                >
                  {house.number}
                </text>
              </g>
            );
          })}

        {hasHouses && chart.angles && (
          <>
            {(
              [
                ["ASC", chart.angles.ascendant],
                ["MC", chart.angles.midheaven],
              ] as const
            ).map(([label, longitude]) => (
              <text
                key={label}
                {...at(R_OUTER + 11, longitude)}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-amber-300 text-[10px] font-semibold"
              >
                {label}
              </text>
            ))}
          </>
        )}

        {/* aspects: one line per aspect, between the true positions */}
        {chart.aspects.map((aspect, index) => {
          const first = longitudeOf.get(aspect.first);
          const second = longitudeOf.get(aspect.second);
          if (first === undefined || second === undefined) return null;
          const tightness = 1 - Math.min(aspect.orb / 8, 1);
          return (
            <line
              key={`${aspect.first}-${aspect.second}-${aspect.aspect}`}
              {...line(at(R_ASPECT, first), at(R_ASPECT, second))}
              pathLength={1}
              stroke={aspectColor(aspect.harmonious)}
              strokeOpacity={0.35 + 0.55 * tightness}
              strokeWidth={aspect.aspect === "Conjunction" ? 1.4 : 1}
              className="chart-ring"
              style={{ animationDelay: `${900 + index * 60}ms` }}
            >
              <title>
                {aspect.first} {aspect.aspect} {aspect.second}, orb {aspect.orb.toFixed(1)}°
              </title>
            </line>
          );
        })}

        {/* planets: a tick at the true longitude, the label nudged clear */}
        {chart.positions.map((position, index) => {
          const label = at(R_LABEL, display[index]);
          const moved = angularDistance(position.longitude, display[index]) > 0.5;
          return (
            <g
              key={position.body}
              className="chart-pop"
              style={{ animationDelay: `${500 + index * 70}ms` }}
            >
              <line
                {...line(at(R_SIGNS, position.longitude), at(R_SIGNS - 6, position.longitude))}
                className="stroke-amber-200"
                strokeWidth={1.4}
              />
              {moved && (
                <line
                  {...line(at(R_SIGNS - 6, position.longitude), at(R_LABEL + 10, display[index]))}
                  className="stroke-slate-600"
                  strokeWidth={0.6}
                />
              )}
              <circle
                cx={label.x}
                cy={label.y}
                r={10}
                className="fill-slate-950 stroke-amber-300"
                strokeWidth={1}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-100 text-[9px] font-medium"
              >
                {planetAbbr(position.body)}
              </text>
              {position.retrograde && (
                <text
                  x={label.x + 9}
                  y={label.y - 9}
                  className="fill-amber-400 text-[8px]"
                >
                  R
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><span className="text-[#5eead4]">━</span> trine, sextile</span>
        <span><span className="text-[#fb7185]">━</span> square, opposition</span>
        <span><span className="text-[#fcd34d]">━</span> conjunction</span>
        {!hasHouses && <span>Houses need a birth time.</span>}
      </figcaption>
    </figure>
  );
}
