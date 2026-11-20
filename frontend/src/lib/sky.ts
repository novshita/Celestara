import "server-only";

import { getCurrentSky } from "@/lib/backend";
import { UNIVERSE_BODIES, toTropical, type SkyBody } from "@/lib/universe";

/** The sky as it is now: where the nine grahas are, and the gap between the two zodiacs. */
export interface HomeSky {
  moment: string;
  ayanamsa: number;
  bodies: SkyBody[];
}

const ORDER = new Map<string, number>(UNIVERSE_BODIES.map((name, index) => [name, index]));

/** The live sky, or `null` when the backend cannot supply it (the page then says so and
 * carries on: the sky is never something the page depends on). */
export async function loadSky(): Promise<HomeSky | null> {
  try {
    const { snapshot, ayanamsa_degrees } = await getCurrentSky();
    const bodies = snapshot.positions
      .filter((position) => ORDER.has(position.graha))
      .map((position) => ({
        name: position.graha,
        tropical: toTropical(position.longitude, ayanamsa_degrees),
        retrograde: position.retrograde,
      }))
      .sort((a, b) => (ORDER.get(a.name) ?? 0) - (ORDER.get(b.name) ?? 0));
    return { moment: snapshot.moment, ayanamsa: ayanamsa_degrees, bodies };
  } catch (error) {
    console.error("could not load the sky", error);
    return null;
  }
}
