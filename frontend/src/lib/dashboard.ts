import "server-only";

import { cache } from "react";

import { calculateTransitReport, calculateVimshottariDasha } from "@/lib/backend";
import type { BirthData, GrahaTransit, DashaPeriod } from "@/lib/types";

/** The grahas worth a glance on a dashboard: the Moon moves fastest, Jupiter
 * and Saturn set the long background. The full table is on the chart page. */
const HIGHLIGHT_GRAHAS = ["Moon", "Jupiter", "Saturn"] as const;

export interface DashboardData {
  /** Mahadasha first, then Antardasha, as far as the backend reports. */
  dasha: DashaPeriod[];
  transits: GrahaTransit[];
  asOf: string;
}

/**
 * What the Home dashboard shows for a saved birth profile, or `null` when it
 * cannot be calculated. The dashboard is secondary to the birth chart (product
 * spec §9), so a failure here hides the panel and never breaks the page.
 */
export const getDashboard = cache(
  async (birth: BirthData): Promise<DashboardData | null> => {
    try {
      const [dasha, transit] = await Promise.all([
        calculateVimshottariDasha(birth),
        calculateTransitReport(birth),
      ]);
      const transits = HIGHLIGHT_GRAHAS.flatMap((name) =>
        transit.report.transits.filter((item) => item.graha === name),
      );
      return {
        dasha: dasha.active_now,
        transits,
        asOf: transit.report.snapshot.moment,
      };
    } catch (error) {
      console.error("could not calculate the dashboard", error);
      return null;
    }
  },
);

/**
 * Questions worth asking right now, built only from what was calculated -
 * never a prediction. Capped so the panel stays a prompt, not a menu.
 */
export function suggestedQuestions(data: DashboardData): string[] {
  const questions: string[] = [];

  const [mahadasha, antardasha] = data.dasha;
  if (mahadasha) {
    questions.push(
      `What themes does my ${mahadasha.lord} Mahadasha bring out in my chart?`,
    );
  }
  if (mahadasha && antardasha) {
    questions.push(
      `How does ${antardasha.lord} Antardasha interact with ${mahadasha.lord} Mahadasha?`,
    );
  }
  const saturn = data.transits.find((item) => item.graha === "Saturn");
  if (saturn) {
    questions.push(
      `What does Saturn moving through ${saturn.transit.rashi} mean for my chart?`,
    );
  }
  questions.push("What does my Moon's nakshatra say about my temperament?");

  return questions.slice(0, 4);
}
