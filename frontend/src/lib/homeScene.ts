/**
 * The geometry and copy of the Home page's portal scene (design/Celestara Home.html): a
 * stair climbing to a glowing doorway under a great planet, with an arc over the doorway that
 * carries the nine grahas. Kept free of React so it can be tested on its own. Nothing here
 * calculates astrology: positions arrive from the backend.
 *
 * The one idea: the planets are where they are, whichever zodiac you measure them in. The two
 * zodiacs are the same twelve signs, turned relative to each other by the ayanamsa, so the
 * arc keeps every planet fixed and moves the signs around them.
 */

import { RASHI_NAMES, WESTERN_SIGNS } from "@/lib/chartLabels";
import { normalizeDegrees } from "@/lib/chartGeometry";
import { signAt, type Mode } from "@/lib/universe";

/** The stage the scene is drawn on, in its own units; it is scaled to fit the page. */
export const STAGE = { width: 600, height: 740 } as const;

/** Centre of the arc, its radius, and how many degrees of arc one degree of longitude takes
 * (the 360° zodiac, with a little to spare either side, spans 220° of arc). */
export const ARC = { cx: 300, cy: 430, radius: 250, k: 220 / 370 } as const;

/** The nine grahas, as the design's short codes and the names the backend uses. */
export const GRAHAS = [
  ["Su", "Sun"], ["Mo", "Moon"], ["Ma", "Mars"], ["Me", "Mercury"], ["Ju", "Jupiter"],
  ["Ve", "Venus"], ["Sa", "Saturn"], ["Ra", "Rahu"], ["Ke", "Ketu"],
] as const;

/** Arc angle (degrees, counter-clockwise from 3 o'clock) at which a tropical longitude sits. */
export const arcAngle = (longitude: number): number => 200 - ARC.k * longitude;

/** The point on the arc, `radius` from its centre, for a longitude (y grows downward). */
export function arcPoint(longitude: number, radius: number): [number, number] {
  const a = (arcAngle(longitude) * Math.PI) / 180;
  return [ARC.cx + radius * Math.cos(a), ARC.cy - radius * Math.sin(a)];
}

/** The SVG path of the arc, from a little before 0° to a little past 360°. */
export function arcPathData(): string {
  let d = "";
  for (let longitude = -12; longitude <= 382; longitude += 4) {
    const [x, y] = arcPoint(longitude, ARC.radius);
    d += `${d ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/**
 * Spacing so that no two planet discs come within a 24px target of each other even on the
 * narrowest phone (WCAG 2.5.8). The stage is drawn 600 wide and shrinks to about 330px there,
 * a scale of 0.55, so 24px is about 44 stage units: at 2.6 units a degree that is 17° along the
 * arc, and a neighbour moved onto another track must be about that far across it.
 */
export const ORB_CLEARANCE = 17.5;
export const ORB_STAGGER = 46;

/**
 * How far in or out each planet sits (0 = on the line). A planet close to one already placed would
 * cover it, and the live sky does have conjunctions, so a close neighbour is moved to an outer or
 * inner track instead: the discs stay separate, and each is still on its own longitude. Planets are
 * handled in order of longitude; the result is in the order given. `circular` is for a wheel, where
 * the end of the zodiac meets the start: the order then begins after the widest gap, so two planets
 * either side of 0° are treated as the neighbours they are.
 */
export function spreadOffsets(
  longitudes: readonly number[],
  clearance: number,
  stagger: number,
  circular = false,
): number[] {
  const tracks = [0, stagger, -stagger];
  const lastOnTrack: number[] = [-Infinity, -Infinity, -Infinity];
  const offsets = new Array<number>(longitudes.length).fill(0);
  let order = longitudes.map((longitude, index) => ({ longitude, index })).sort((a, b) => a.longitude - b.longitude);
  if (circular && order.length > 1) {
    // start after the widest gap, and carry on past 360 for those that come before it
    let widest = -1;
    let at = 0;
    order.forEach((item, i) => {
      const next = order[(i + 1) % order.length];
      const gap = (next.longitude - item.longitude + 360) % 360 || 360;
      if (gap > widest) {
        widest = gap;
        at = (i + 1) % order.length;
      }
    });
    order = [...order.slice(at), ...order.slice(0, at).map((o) => ({ ...o, longitude: o.longitude + 360 }))];
  }
  for (const { longitude, index } of order) {
    let track = lastOnTrack.findIndex((last) => longitude - last >= clearance);
    if (track === -1) track = lastOnTrack.indexOf(Math.min(...lastOnTrack)); // crowded: the track that has been quiet longest
    lastOnTrack[track] = longitude;
    offsets[index] = tracks[track];
  }
  return offsets;
}

/** The arc's version: planets in a line, so no wrap-around. */
export const orbOffsets = (longitudes: readonly number[]): number[] =>
  spreadOffsets(longitudes, ORB_CLEARANCE, ORB_STAGGER);

export type System = "tropical" | "sidereal";

export interface RingItem {
  system: System;
  index: number;
  name: string;
}

/** Twelve Western and twelve Vedic signs, each drawn as a tick and a label. */
export const RING_ITEMS: readonly RingItem[] = [
  ...WESTERN_SIGNS.map((name, index) => ({ system: "tropical" as const, index, name })),
  ...RASHI_NAMES.map((name, index) => ({ system: "sidereal" as const, index, name })),
];

export interface RingStyle {
  tick: { transform: string };
  label: { transform: string };
  opacity: number;
}

/**
 * Where one sign's tick and label go for a mode. Vedic signs are the Western ones turned back
 * by the ayanamsa. Only the zodiac(s) the mode shows are visible; in Compare, the Vedic signs
 * move inside the Western ones.
 */
export function ringStyle(item: RingItem, mode: Mode, ayanamsa: number): RingStyle {
  const offset = item.system === "sidereal" ? ayanamsa : 0;
  const visible =
    mode === "compare" || (mode === "vedic" && item.system === "sidereal") || (mode === "western" && item.system === "tropical");
  const inner = item.system === "sidereal" && mode === "compare";
  const tickRadius = inner ? ARC.radius - 40 : ARC.radius;
  const labelRadius = inner ? ARC.radius - 62 : ARC.radius - 22;
  const a1 = arcAngle(item.index * 30 + offset);
  const a2 = arcAngle(item.index * 30 + 15 + offset);
  return {
    tick: { transform: `rotate(${-a1}deg) translateX(${tickRadius}px)` },
    label: { transform: `rotate(${-a2}deg) translateX(${labelRadius}px) rotate(${a2}deg) translate(-50%,-50%)` },
    opacity: visible ? 1 : 0,
  };
}

/** The sign a planet is in, in each zodiac. */
export function signsOf(tropical: number, ayanamsa: number): { western: string; vedic: string } {
  return {
    western: signAt(tropical, ayanamsa, "western").sign,
    vedic: signAt(tropical, ayanamsa, "vedic").sign,
  };
}

export const ZODIAC_COPY: Record<Mode, string> = {
  vedic: "The sidereal zodiac, which the Vedic tradition uses: signs are measured against the fixed stars.",
  western:
    "The tropical zodiac, which the Western tradition uses: signs are measured from the March equinox, so they follow the seasons.",
  compare: "Both zodiacs at once. Western signs sit outside the arc, Vedic signs inside it.",
};

export const ayanamsaNote = (ayanamsa: number): string =>
  `The two zodiacs differ by ${ayanamsa.toFixed(2)}°, the ayanamsa. The planets do not move when you change zodiac; the signs turn around them.`;

/** "As of 20 Nov 2026, 14:05 UTC" from an ISO moment. */
export function asOf(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const two = (v: number) => (v < 10 ? `0${v}` : String(v));
  return `As of ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The doorway's steps and columns, as SVG markup (350 high, drawn from stage y 390). Fixed:
 * it contains no user input and is the same on the server and in the browser. */
export function archMarkup(): string {
  const r = rng(14);
  let s =
    '<defs><linearGradient id="hmcol" x1="0" x2="1"><stop offset="0" stop-color="#efe5cb"/><stop offset=".6" stop-color="#b8aa88"/><stop offset="1" stop-color="#6b6149"/></linearGradient>' +
    '<linearGradient id="hmrs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3f31"/><stop offset="1" stop-color="#241d17"/></linearGradient>' +
    '<linearGradient id="hmgl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(242,197,92,.28)"/><stop offset="1" stop-color="rgba(242,197,92,0)"/></linearGradient></defs>';
  for (let i = 0; i < 8; i++) {
    const y = 170 + i * 22;
    const hw = 100 + i * 36;
    s +=
      `<rect x="${300 - hw}" y="${y + 8}" width="${hw * 2}" height="14" fill="url(#hmrs)"/>` +
      `<rect x="${300 - hw}" y="${y}" width="${hw * 2}" height="8" fill="${i % 2 ? "#b3a27a" : "#c3b389"}"/>` +
      `<rect x="${300 - hw}" y="${y}" width="${hw * 2}" height="1.5" fill="#efe3bd" opacity=".8"/>` +
      `<rect x="${300 - hw}" y="${y + 8}" width="${hw * 2}" height="14" fill="url(#hmgl)" opacity="${1 - i * 0.1}"/>`;
    for (let j = 0; j < Math.round(hw / 12); j++) {
      s += `<circle cx="${(300 - hw + r() * hw * 2).toFixed(1)}" cy="${(y + 9 + r() * 12).toFixed(1)}" r="${(0.5 + r() * 0.8).toFixed(1)}" fill="${r() < 0.5 ? "#f6e2a8" : "#bfd7ff"}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
    }
  }
  s += '<g filter="drop-shadow(0 0 10px rgba(242,197,92,.35))">';
  for (const cx of [216, 364]) {
    s +=
      `<rect x="${cx}" y="80" width="20" height="96" fill="url(#hmcol)"/><rect x="${cx - 5}" y="170" width="30" height="8" fill="#d6c9a6"/>` +
      `<rect x="${cx - 4}" y="72" width="28" height="9" fill="#e6dab8"/><circle cx="${cx - 3}" cy="77" r="4.5" fill="#d9ccaa"/><circle cx="${cx + 23}" cy="77" r="4.5" fill="#d9ccaa"/>`;
  }
  s +=
    '<path d="M227 80A73 73 0 0 1 373 80" fill="none" stroke="url(#hmcol)" stroke-width="22"/>' +
    '<path d="M216 80A84 84 0 0 1 384 80" fill="none" stroke="#f3e8c8" stroke-width="1.2" opacity=".8"/>' +
    '<path d="M238 80A62 62 0 0 1 362 80" fill="none" stroke="#f3e8c8" stroke-width="1" opacity=".5"/></g>';
  return s;
}

// ---- the journey into the doorway ---------------------------------------------------------
//
// Choosing a zodiac, clicking the doorway, or scrolling over it zooms the scene into the door:
// the great planet, the clouds and the arc fade away, the doorway grows until its galaxy fills
// the scene, and a chart wheel fades in on top of it. Everything below is pure, so the way the
// zoom is eased and where the chart's pieces fall can be tested without a browser.

/** The doorway is the centre of the zoom; it ends up centred at `targetY` on the stage. */
export const JOURNEY = { originX: 300, originY: 487, targetY: 370, zoom: 4.3 } as const;

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Eases 0..1 so the zoom starts and ends gently. */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export interface JourneyFrame {
  /** The eased progress. */
  ease: number;
  /** The doorway's whole scene, moved and scaled. */
  worldTransform: string;
  /** Opacity of what the zoom leaves behind (the great planet, clouds and arc). */
  fade: number;
  /** The doorway's top corners straighten as it fills the scene. */
  radius: number;
  /** Opacity of the chart that appears inside the door. */
  overlay: number;
}

/** How the scene looks `progress` (0 = at rest, 1 = inside the door) of the way through. */
export function journeyFrame(progress: number): JourneyFrame {
  const ease = smoothstep(clamp01(progress));
  return {
    ease,
    worldTransform: `translate3d(0,${((JOURNEY.targetY - JOURNEY.originY) * ease).toFixed(1)}px,0) scale(${(1 + JOURNEY.zoom * ease).toFixed(3)})`,
    fade: clamp01(1 - (progress - 0.25) * 2.2),
    radius: 62 * (1 - ease),
    overlay: clamp01((progress - 0.62) / 0.3),
  };
}

// ---- the chart wheel inside the door --------------------------------------------------------

export const CHART = { cx: 300, cy: 350, disc: 236 } as const;

/** A point `radius` from the wheel's centre at `angle` degrees (counter-clockwise from 3 o'clock). */
export function chartPoint(radius: number, angle: number): [number, number] {
  const t = (angle * Math.PI) / 180;
  return [CHART.cx + radius * Math.cos(t), CHART.cy - radius * Math.sin(t)];
}

const f1 = (p: readonly [number, number]): string => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

export interface ChartRing {
  system: System;
  names: readonly string[];
  inner: number;
  outer: number;
  /** How far the signs are turned, in degrees: the ayanamsa for the Vedic ring beside the Western one. */
  offset: number;
  gold: boolean;
}

/** Which rings of signs the wheel shows for a mode, and where. Compare shows both, side by side:
 * the Western ring outside, the Vedic one turned by the ayanamsa inside it. */
export function chartRings(mode: Mode, ayanamsa: number): ChartRing[] {
  const both = mode === "compare";
  const rings: ChartRing[] = [];
  if (mode === "western" || both) {
    rings.push({ system: "tropical", names: WESTERN_SIGNS, inner: both ? 178 : 168, outer: 212, offset: 0, gold: false });
  }
  if (mode === "vedic" || both) {
    rings.push({
      system: "sidereal",
      names: RASHI_NAMES,
      inner: both ? 140 : 168,
      outer: both ? 174 : 212,
      offset: both ? ayanamsa : 0,
      gold: true,
    });
  }
  return rings;
}

export interface ChartSector {
  path: string;
  fill: string;
  stroke: string;
  label: { x: number; y: number; rotate: number; text: string };
}

/** The twelve sectors of a ring: each a curved band, with its name set upright along the wheel. */
export function ringSectors(ring: ChartRing): ChartSector[] {
  const sectors: ChartSector[] = [];
  for (let k = 0; k < 12; k++) {
    const a1 = 180 - (k * 30 + ring.offset);
    const a2 = a1 - 30;
    const mid = a1 - 15;
    const path =
      `M${f1(chartPoint(ring.outer, a1))}A${ring.outer} ${ring.outer} 0 0 1 ${f1(chartPoint(ring.outer, a2))}` +
      `L${f1(chartPoint(ring.inner, a2))}A${ring.inner} ${ring.inner} 0 0 0 ${f1(chartPoint(ring.inner, a1))}Z`;
    // Turn each name so it reads upright whichever side of the wheel it is on
    const theta = ((((mid + 180) % 360) + 360) % 360) - 180;
    const rotate = 90 - theta + (theta < 0 ? 180 : 0);
    const [x, y] = chartPoint((ring.inner + ring.outer) / 2, mid);
    sectors.push({
      path,
      fill: k % 2 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.075)",
      stroke: ring.gold ? "rgba(242,197,92,.55)" : "rgba(201,212,230,.4)",
      label: { x, y, rotate, text: ring.names[k] },
    });
  }
  return sectors;
}

/** How far from the centre the planets sit on the wheel for a mode. */
export const planetRadius = (mode: Mode): number => (mode === "compare" ? 108 : 138);

/** Across the wheel the planets are ~34px discs; this is how far apart they must stand, in degrees, at
 * the wheel's planet radius, and how far a crowded neighbour moves in or out. */
export function chartOffsets(longitudes: readonly number[], mode: Mode): number[] {
  const clearance = 40 / ((planetRadius(mode) * Math.PI) / 180);
  return spreadOffsets(longitudes, clearance, mode === "compare" ? 26 : 34, true);
}

export interface ChartPlanet {
  x: number;
  y: number;
  angle: number;
  /** In Compare: is the planet in a different sign in the two zodiacs? (Marked with a dashed ring.) */
  moved: boolean;
}

/** Where a planet stands on the wheel. The planets are in the same place in space whichever zodiac
 * is drawn; only the Vedic-only wheel measures from the sidereal zero, so there they sit
 * `ayanamsa` degrees on from where the Western wheel puts them. */
export function chartPlanet(tropical: number, mode: Mode, ayanamsa: number, radialOffset = 0): ChartPlanet {
  const sidereal = normalizeDegrees(tropical - ayanamsa);
  const angle = 180 - (mode === "vedic" ? sidereal : tropical);
  const [x, y] = chartPoint(planetRadius(mode) + radialOffset, angle);
  return { x, y, angle, moved: Math.floor(tropical / 30) !== Math.floor(sidereal / 30) };
}

export interface ChartCaptions {
  title: string;
  centre: string;
  centreNote: string;
  hint: string;
}

/** The words on the wheel: its title, the name in its middle, and the line under it. */
export function chartCaptions(mode: Mode, ayanamsa: number): ChartCaptions {
  const gap = ayanamsa.toFixed(2);
  switch (mode) {
    case "vedic":
      return { title: "Vedic · the sky now", centre: "Vedic", centreNote: "Sidereal", hint: `Sidereal · Lahiri ${gap}°. Choose a planet.` };
    case "western":
      return { title: "Western · the sky now", centre: "Western", centreNote: "Tropical", hint: "Tropical · from the March equinox. Choose a planet." };
    case "compare":
      return {
        title: "Both zodiacs · the sky now",
        centre: "Both",
        centreNote: "planets stay put",
        hint: "Dashed ring: this planet is in a different sign in each zodiac.",
      };
  }
}

/** Each graha's picture (public/grahas) and the size it is shown at, in stage units. The sizes keep
 * the planets in rough proportion to each other without making the smallest hard to see. */
export const GRAHA_LOOK: Record<string, { slug: string; width: number; height: number }> = {
  Sun: { slug: "sun", width: 46, height: 46 },
  Moon: { slug: "moon", width: 34, height: 34 },
  Mars: { slug: "mars", width: 34, height: 34 },
  Mercury: { slug: "mercury", width: 30, height: 30 },
  Jupiter: { slug: "jupiter", width: 46, height: 46 },
  Venus: { slug: "venus", width: 39, height: 39 },
  Saturn: { slug: "saturn", width: 72, height: 35 },
  Rahu: { slug: "rahu", width: 43, height: 43 },
  Ketu: { slug: "ketu", width: 39, height: 39 },
};
