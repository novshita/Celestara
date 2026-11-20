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
  /** Every Mahadasha of the timeline, in order, for drawing it to scale. */
  periods: DashaPeriod[];
  /** The moment the Dasha was reckoned for. */
  dashaAsOf: string;
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
        periods: dasha.timeline.periods,
        dashaAsOf: dasha.as_of,
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

// ---- the Home page's saved-profile strip ------------------------------------------------

export interface StripDashboard {
  /** "Jupiter · Saturn": the current Mahadasha and Antardasha. */
  current: { maha: string; antar: string | null };
  /** The Mahadashas in order, as widths (their length in years), with the current one marked. */
  bar: { lord: string; years: number; current: boolean }[];
  /** How far through the whole timeline the present moment is, 0 to 1. */
  nowFraction: number;
  /** Where the Moon, Jupiter and Saturn are now, in the Vedic zodiac. */
  sky: { graha: string; rashi: string; retrograde: boolean }[];
  /** Questions worth asking, built only from what was calculated. */
  questions: string[];
}

/** The strip's state: not signed in, signed in without a profile, a profile, or a failure. */
export type ProfileStrip =
  | { status: "anonymous" | "none" | "unavailable" }
  | { status: "saved"; dashboard: StripDashboard | null };

/** What the strip shows, from the dashboard data. Pure, so it can be tested on its own. */
export function stripFrom(data: DashboardData): StripDashboard {
  const [maha, antar] = data.dasha;
  const periods = data.periods;
  const start = periods.length ? new Date(periods[0].start).getTime() : 0;
  const end = periods.length ? new Date(periods[periods.length - 1].end).getTime() : 0;
  const now = new Date(data.dashaAsOf).getTime();
  const span = end - start;
  return {
    current: { maha: maha?.lord ?? "", antar: antar?.lord ?? null },
    bar: periods.map((period) => ({
      lord: period.lord,
      years: period.duration_years,
      current: period.lord === maha?.lord && period.start === maha?.start,
    })),
    nowFraction: span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : 0,
    sky: data.transits.map((item) => ({
      graha: item.graha,
      rashi: item.transit.rashi,
      retrograde: item.transit.retrograde,
    })),
    questions: suggestedQuestions(data),
  };
}
