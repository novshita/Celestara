import type { ReactNode } from "react";

import type { ChartSystem } from "@/app/actions";

export interface Lens {
  key: ChartSystem;
  /** The full name: it is the form's radio label, which the tests and screen readers use. */
  name: string;
  /** The short name on the result tabs. */
  tab: string;
  description: string;
  /** The line under the wheel while this lens is chosen. */
  system: string;
}

export const LENSES: readonly Lens[] = [
  { key: "vedic", name: "Vedic (Rashi / D1)", tab: "Vedic", description: "Sidereal chart, houses as bhavas", system: "Sidereal zodiac · Lahiri ayanamsa" },
  { key: "western", name: "Western (Tropical)", tab: "Western", description: "Tropical chart with aspects", system: "Tropical zodiac · aspects drawn" },
  { key: "compare", name: "Compare both", tab: "Compare both", description: "Both charts, and why they differ", system: "Sidereal and tropical, side by side" },
  { key: "dasha", name: "Vimshottari Dasha", tab: "Vimshottari Dasha", description: "The timeline of planetary periods", system: "120-year cycle · Mahadasha, Antardasha" },
  { key: "transit", name: "Current transits (Gochar)", tab: "Current transits", description: "The sky today against your chart", system: "Today’s planets · natal bhavas" },
];

export const lensByKey = (key: ChartSystem): Lens => LENSES.find((l) => l.key === key) ?? LENSES[0];

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const LENS_ICON: Record<ChartSystem, ReactNode> = {
  vedic: svg(<><rect x="4" y="4" width="32" height="32" /><path d="M4 4L36 36M36 4L4 36M20 4L36 20L20 36L4 20Z" /></>),
  western: svg(<><circle cx="20" cy="20" r="16" /><circle cx="20" cy="20" r="8" /><path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M31.3 8.7L8.7 31.3" /></>),
  compare: svg(<><circle cx="15" cy="20" r="11" /><circle cx="25" cy="20" r="11" /></>),
  dasha: svg(<><rect x="3" y="15" width="6" height="12" /><rect x="11" y="15" width="3" height="12" /><rect x="16" y="15" width="10" height="12" fill="currentColor" fillOpacity=".25" /><rect x="28" y="15" width="9" height="12" /><path d="M21 6v7" /></>),
  transit: svg(<><ellipse cx="20" cy="20" rx="17" ry="8" transform="rotate(-24 20 20)" /><circle cx="20" cy="20" r="3.5" fill="currentColor" /><circle cx="32" cy="14.5" r="2.4" fill="currentColor" /></>),
};
