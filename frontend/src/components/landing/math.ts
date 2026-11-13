/**
 * Pure helpers behind the landing page's scroll story: easing, progress
 * segments, and the zodiac-wheel drawing. Kept free of the DOM so they can be
 * tested; the DOM-driving engine lives in engine.ts.
 */

export const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));

/** Progress of `p` through the stretch [a, b], clamped to 0..1. */
export const seg = (p: number, a: number, b: number): number => clamp((p - a) / (b - a));

export const e3 = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const e2 = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** The twelve signs, as the wheel labels them. */
export const WHEEL_LABELS = [
  "ARI", "TAU", "GEM", "CAN", "LEO", "VIR", "LIB", "SCO", "SAG", "CAP", "AQU", "PIS",
] as const;

/** A sample chart: two-letter planet codes and their wheel angle in degrees.
 * Illustrative only - the landing page shows no one's real chart. */
export const SAMPLE_PLANETS: readonly (readonly [string, number])[] = [
  ["Su", 20], ["Mo", 75], ["Ma", 140], ["Me", 200], ["Ju", 250],
  ["Ve", 295], ["Sa", 330], ["Ra", 100], ["Ke", 280],
];

/** Pairs of SAMPLE_PLANETS indices joined by an aspect line. */
const SAMPLE_ASPECTS: readonly (readonly [number, number])[] = [
  [0, 4], [4, 8], [0, 2], [1, 6], [3, 5],
];

/** A point on a circle of radius `r` around (500, 500), `deg` clockwise from 3 o'clock. */
export function pol(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [500 + r * Math.cos(a), 500 + r * Math.sin(a)];
}

const f = (n: number): string => n.toFixed(2);

/** The wheel as SVG markup; with `planets`, the sample planets and aspects too. */
export function wheel(planets: boolean): string {
  let s = '<svg viewBox="0 0 1000 1000" aria-hidden="true">';
  s +=
    '<circle class="wb" cx="500" cy="500" r="455"/><circle class="w1" cx="500" cy="500" r="490"/>' +
    '<circle class="w2" cx="500" cy="500" r="420"/><circle class="w2" cx="500" cy="500" r="300"/>' +
    '<circle class="w3" cx="500" cy="500" r="210"/>';
  for (let i = 0; i < 12; i++) {
    const a = pol(300, 180 + i * 30);
    const b = pol(490, 180 + i * 30);
    s += `<line class="ws" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    const p = pol(455, 180 + i * 30 + 15);
    s +=
      `<text class="wl" x="${f(p[0])}" y="${f(p[1])}" ` +
      `transform="rotate(${180 + i * 30 + 15 + 90} ${f(p[0])} ${f(p[1])})">${WHEEL_LABELS[i]}</text>`;
  }
  for (let i = 0; i < 72; i++) {
    const a = pol(420, i * 5);
    const b = pol(i % 6 === 0 ? 440 : 430, i * 5);
    s += `<line class="wt" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
  }
  if (planets) {
    for (const [i, j] of SAMPLE_ASPECTS) {
      const a = pol(290, SAMPLE_PLANETS[i][1]);
      const b = pol(290, SAMPLE_PLANETS[j][1]);
      s += `<line class="wa" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    }
    for (const [code, deg] of SAMPLE_PLANETS) {
      const q = pol(360, deg);
      s +=
        `<circle class="wp${code === "Su" ? " sun" : ""}" cx="${f(q[0])}" cy="${f(q[1])}" r="19"/>` +
        `<text class="wpl" x="${f(q[0])}" y="${f(q[1])}">${code}</text>`;
    }
  }
  return s + "</svg>";
}
