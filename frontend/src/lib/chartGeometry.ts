/**
 * The maths behind the chart drawings, kept free of React so it can be
 * tested on its own. Nothing here calculates astrology - positions arrive
 * from the backend - it only turns them into places on a page.
 */

export interface Point {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Where a zodiac longitude falls on a wheel centred at (`cx`, `cy`).
 *
 * `rotation` is the longitude drawn at the left (9 o'clock): the ascendant,
 * by convention, or 0 (the first sign) when the chart has none. Longitude
 * increases counter-clockwise, so the second house sits below the first.
 */
export function wheelPoint(
  cx: number,
  cy: number,
  radius: number,
  longitude: number,
  rotation: number,
): Point {
  const angle = Math.PI + ((normalizeDegrees(longitude - rotation) * Math.PI) / 180);
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

/**
 * Moves bodies apart along the circle so their labels do not overlap, while
 * keeping each as near to its true longitude as it can. Returns the display
 * longitude for each input, in the input's order. The true longitude is still
 * what the tick and the aspect lines use; only the label is nudged.
 */
export function spreadLongitudes(longitudes: number[], minGap: number): number[] {
  const count = longitudes.length;
  if (count < 2) return longitudes.map(normalizeDegrees);

  const order = longitudes
    .map((value, index) => ({ value: normalizeDegrees(value), index }))
    .sort((a, b) => a.value - b.value);
  const positions = order.map((item) => item.value);

  // A full circle cannot hold more labels than it has room for.
  const gap = Math.min(minGap, 360 / count);

  for (let pass = 0; pass < 200; pass += 1) {
    let moved = false;
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count;
      let distance = positions[next] - positions[i];
      if (next === 0) distance += 360;
      if (distance < gap - 1e-9) {
        const push = (gap - distance) / 2;
        positions[i] -= push;
        positions[next] += push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const result: number[] = new Array(count);
  order.forEach((item, sorted) => {
    result[item.index] = normalizeDegrees(positions[sorted]);
  });
  return result;
}

/** The smallest angle between two longitudes, 0 to 180. */
export function angularDistance(a: number, b: number): number {
  const difference = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return difference > 180 ? 360 - difference : difference;
}

// --- North Indian chart --------------------------------------------------------

export const NORTH_SIZE = 400;

type Vertex = readonly [number, number];

const A: Vertex = [0, 0];
const B: Vertex = [400, 0];
const C: Vertex = [400, 400];
const D: Vertex = [0, 400];
const T: Vertex = [200, 0];
const R: Vertex = [400, 200];
const M: Vertex = [200, 400];
const L: Vertex = [0, 200];
const O: Vertex = [200, 200];
const a: Vertex = [100, 100];
const b: Vertex = [300, 100];
const c: Vertex = [300, 300];
const d: Vertex = [100, 300];

/** The twelve houses of the North Indian chart, index 0 being the first
 * house (the top diamond), then counter-clockwise. The layout is fixed:
 * the houses never move, the signs rotate through them. */
export const NORTH_HOUSES: readonly (readonly Vertex[])[] = [
  [a, T, b, O], // 1
  [A, T, a], // 2
  [A, a, L], // 3
  [a, L, d, O], // 4
  [L, d, D], // 5
  [D, d, M], // 6
  [d, M, c, O], // 7
  [M, c, C], // 8
  [C, c, R], // 9
  [b, R, c, O], // 10
  [R, b, B], // 11
  [B, b, T], // 12
];

export function centroid(vertices: readonly Vertex[]): Point {
  const sum = vertices.reduce(
    (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

/** The sign number (1-12) belonging in house `house` (1-12) when the
 * ascendant is in the sign with zero-based index `ascendantIndex`. */
export function signNumberForHouse(ascendantIndex: number, house: number): number {
  return ((ascendantIndex + house - 1) % 12) + 1;
}

// --- South Indian chart --------------------------------------------------------

/** Grid cell (column, row) of each sign, by zero-based sign index. The signs
 * stay put, with Aries second from the left on the top row. */
export const SOUTH_CELLS: readonly (readonly [number, number])[] = [
  [1, 0], // Aries
  [2, 0], // Taurus
  [3, 0], // Gemini
  [3, 1], // Cancer
  [3, 2], // Leo
  [3, 3], // Virgo
  [2, 3], // Libra
  [1, 3], // Scorpio
  [0, 3], // Sagittarius
  [0, 2], // Capricorn
  [0, 1], // Aquarius
  [0, 0], // Pisces
];

export const FULL_TURN = TAU;
