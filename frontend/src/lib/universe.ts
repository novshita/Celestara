/**
 * The maths behind the Celestial Universe (product spec §9, §26), kept free of
 * React so it can be tested on its own. Nothing here calculates astrology: the
 * positions arrive from the backend.
 *
 * The one idea it rests on: the planets are where they are, whichever zodiac
 * you measure them in. A tropical longitude is the sidereal one plus the
 * ayanamsa, so the two zodiacs are the same ring of signs turned relative to
 * each other by that angle (about 24 degrees today). The drawing therefore
 * keeps every body fixed in space and turns the ring of signs - which is also
 * what makes the move from Vedic to Western a real transformation of the whole
 * scene, not a swap of labels.
 */

import { RASHI_NAMES, WESTERN_SIGNS } from "@/lib/chartLabels";
import { normalizeDegrees } from "@/lib/chartGeometry";

export type Mode = "vedic" | "western" | "compare";
export type Zodiac = "vedic" | "western";

export const MODES: readonly { value: Mode; label: string }[] = [
  { value: "vedic", label: "Vedic" },
  { value: "western", label: "Western" },
  { value: "compare", label: "Compare" },
];

/** The nine grahas, which both zodiacs can place (the Western outer planets
 * have no Vedic counterpart, so a side-by-side view leaves them out). */
export const UNIVERSE_BODIES = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

export interface SkyBody {
  name: string;
  /** Where it is, measured from the tropical zero point (0° Aries). */
  tropical: number;
  retrograde: boolean;
}

/** A tropical longitude from a sidereal one. */
export function toTropical(sidereal: number, ayanamsa: number): number {
  return normalizeDegrees(sidereal + ayanamsa);
}

/** The sign a body is in, and how far into it, in the chosen zodiac. */
export function signAt(
  tropical: number,
  ayanamsa: number,
  zodiac: Zodiac,
): { sign: string; degrees: number } {
  const longitude =
    zodiac === "western"
      ? normalizeDegrees(tropical)
      : normalizeDegrees(tropical - ayanamsa);
  const index = Math.min(11, Math.floor(longitude / 30));
  const names = zodiac === "western" ? WESTERN_SIGNS : RASHI_NAMES;
  return { sign: names[index], degrees: longitude - index * 30 };
}

/**
 * The CSS rotation (degrees, clockwise) that puts something at `longitude` on
 * the wheel, when it starts at 3 o'clock. Longitude 0 sits at 9 o'clock and
 * increases counter-clockwise, as in the chart drawings.
 */
export function placeAngle(longitude: number): number {
  return 180 - normalizeDegrees(longitude);
}

export interface RingState {
  opacity: number;
  /** Degrees, clockwise, as CSS wants it. */
  rotate: number;
  scale: number;
}

export interface Frame {
  western: RingState;
  vedic: RingState;
  /** How far from the centre the current sky's bodies sit. */
  skyRadius: number;
}

/** Radius of the current sky's track: further out when one ring shows, tucked
 * inside both when the two are shown together. */
const SKY_RADIUS = { single: 198, compare: 156 } as const;

/** Scale of the Vedic ring when it sits inside the Western one. */
export const COMPARE_INNER_SCALE = 0.8;

/**
 * Where each ring of signs should be for a mode.
 *
 * The Vedic ring is the Western one turned back by the ayanamsa (its zero is
 * at tropical longitude `ayanamsa`, and longitude runs counter-clockwise). A
 * ring that is not shown is parked at the pose of the ring that is, so that
 * changing mode turns both through the same angle while one fades out and the
 * other in: the scene turns, rather than one picture replacing another. Compare
 * shows both, the Vedic one moved inside the Western one.
 */
export function frameFor(mode: Mode, ayanamsa: number): Frame {
  const turned = -ayanamsa;
  switch (mode) {
    case "western":
      return {
        western: { opacity: 1, rotate: 0, scale: 1 },
        vedic: { opacity: 0, rotate: 0, scale: 1 },
        skyRadius: SKY_RADIUS.single,
      };
    case "vedic":
      return {
        western: { opacity: 0, rotate: turned, scale: 1 },
        vedic: { opacity: 1, rotate: turned, scale: 1 },
        skyRadius: SKY_RADIUS.single,
      };
    case "compare":
      return {
        western: { opacity: 1, rotate: 0, scale: 1 },
        vedic: { opacity: 1, rotate: turned, scale: COMPARE_INNER_SCALE },
        skyRadius: SKY_RADIUS.compare,
      };
  }
}

/** The CSS `transform` for a ring state. */
export function ringTransform(state: RingState): string {
  return `rotate(${state.rotate}deg) scale(${state.scale})`;
}

/** "Saturn · Meena 14° (Vedic) · Pisces 8° (Western)" for text and tooltips. */
export function describeBody(
  body: SkyBody,
  ayanamsa: number,
  mode: Mode,
): string {
  const parts: string[] = [];
  const vedic = signAt(body.tropical, ayanamsa, "vedic");
  const western = signAt(body.tropical, ayanamsa, "western");
  if (mode !== "western")
    parts.push(`${vedic.sign} ${Math.floor(vedic.degrees)}° (Vedic)`);
  if (mode !== "vedic")
    parts.push(`${western.sign} ${Math.floor(western.degrees)}° (Western)`);
  return `${body.name}${body.retrograde ? " (retrograde)" : ""} · ${parts.join(" · ")}`;
}
