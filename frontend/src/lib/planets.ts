import type { ExploreSystem } from "./types";

/** The bodies each system's chart contains, in traditional order. The backend
 * answers for exactly these (and rejects anything else), so the picker offers
 * no choice that cannot be explored. */
export const EXPLORE_BODIES: Record<ExploreSystem, readonly string[]> = {
  vedic: ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"],
  western: [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto",
  ],
};

export function isExploreSystem(value: unknown): value is ExploreSystem {
  return value === "vedic" || value === "western";
}
