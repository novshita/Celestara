/** Real backend responses (see tests/fixtures), typed as the app types them.
 * Regenerate them if the API's response shape changes. */
import type {
  ChartComparison,
  DashaPeriod,
  VedicChart,
  WesternChart,
} from "@/lib/types";

import compareKnown from "../fixtures/compare-known.json";
import dashaKnown from "../fixtures/dasha-known.json";
import vedicKnown from "../fixtures/vedic-known.json";
import vedicUnknown from "../fixtures/vedic-unknown.json";
import westernKnown from "../fixtures/western-known.json";
import westernUnknown from "../fixtures/western-unknown.json";

export const vedic = vedicKnown.chart as unknown as VedicChart;
export const vedicNoTime = vedicUnknown.chart as unknown as VedicChart;
export const western = westernKnown.chart as unknown as WesternChart;
export const westernNoTime = westernUnknown.chart as unknown as WesternChart;
export const comparison = compareKnown.comparison as unknown as ChartComparison;

export const dasha = {
  periods: dashaKnown.timeline.periods as unknown as DashaPeriod[],
  active: dashaKnown.active_now as unknown as DashaPeriod[],
  asOf: dashaKnown.as_of as string,
};
