import {
  CelestialUniverse,
  type UniverseNatal,
  type UniverseSky,
} from "@/components/CelestialUniverse";
import { calculateVedicChart, getCurrentSky } from "@/lib/backend";
import type { BirthData } from "@/lib/types";
import { UNIVERSE_BODIES, toTropical, type SkyBody } from "@/lib/universe";

const ORDER = new Map<string, number>(
  UNIVERSE_BODIES.map((name, index) => [name, index]),
);

function inOrder(bodies: SkyBody[]): SkyBody[] {
  return bodies
    .filter((body) => ORDER.has(body.name))
    .sort((a, b) => (ORDER.get(a.name) ?? 0) - (ORDER.get(b.name) ?? 0));
}

async function loadSky(): Promise<UniverseSky | null> {
  try {
    const { snapshot, ayanamsa_degrees } = await getCurrentSky();
    return {
      moment: snapshot.moment,
      ayanamsa: ayanamsa_degrees,
      bodies: inOrder(
        snapshot.positions.map((position) => ({
          name: position.graha,
          tropical: toTropical(position.longitude, ayanamsa_degrees),
          retrograde: position.retrograde,
        })),
      ),
    };
  } catch (error) {
    console.error("could not load the sky", error);
    return null;
  }
}

async function loadNatal(birth: BirthData): Promise<UniverseNatal | undefined> {
  try {
    const { chart } = await calculateVedicChart(birth);
    const ayanamsa = chart.metadata.ayanamsa_degrees;
    return {
      ayanamsa,
      ascendant: chart.ascendant
        ? toTropical(chart.ascendant.longitude, ayanamsa)
        : null,
      bodies: inOrder(
        chart.placements.map((placement) => ({
          name: placement.graha,
          tropical: toTropical(placement.longitude, ayanamsa),
          retrograde: placement.retrograde,
        })),
      ),
    };
  } catch (error) {
    console.error("could not calculate the natal ring", error);
    return undefined;
  }
}

/**
 * Product spec §9: the home page's celestial environment. It always shows the
 * sky as it is now; for someone with a saved profile it also holds their birth
 * chart. It is secondary to nothing but is also never something the page
 * depends on, so if the sky cannot be fetched the section simply is not there.
 */
export async function CelestialUniverseSection({
  birth,
}: {
  birth?: BirthData;
}) {
  const [sky, natal] = await Promise.all([
    loadSky(),
    birth ? loadNatal(birth) : undefined,
  ]);
  if (!sky) {
    return null;
  }
  return <CelestialUniverse sky={sky} natal={natal} />;
}
