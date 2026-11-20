/**
 * The maths behind the Home page's sky (product spec §9, §26), kept free of React so it can be
 * tested on its own. Nothing here calculates astrology: the positions arrive from the backend.
 *
 * The one idea it rests on: the planets are where they are, whichever zodiac you measure them
 * in. A tropical longitude is the sidereal one plus the ayanamsa, so the two zodiacs are the same
 * ring of signs turned relative to each other by that angle (about 24 degrees today).
 */

import { RASHI_NAMES, WESTERN_SIGNS } from "@/lib/chartLabels";
import { normalizeDegrees } from "@/lib/chartGeometry";

export type Mode = "vedic" | "western" | "compare";
export type Zodiac = "vedic" | "western";

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
