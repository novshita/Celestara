import type { DashaPeriod } from "./types";

/** Fixed locale and zone so the server and the browser print the same text
 * (a locale-dependent date would mismatch on hydration). */
export function formatDashaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ms(iso: string): number {
  return Date.parse(iso);
}

/** Where `moment` falls across the whole cycle, 0 to 1, or `null` when it is
 * outside it. */
export function positionInCycle(periods: DashaPeriod[], moment: string): number | null {
  if (periods.length === 0) return null;
  const start = ms(periods[0].start);
  const end = ms(periods[periods.length - 1].end);
  const at = ms(moment);
  if (!(end > start) || at < start || at > end) return null;
  return (at - start) / (end - start);
}

/** A period's share of its parent's span, 0 to 1. Uses the real dates, so a
 * partial first period is drawn at the length it actually has. */
export function shareOf(period: DashaPeriod, parentStart: string, parentEnd: string): number {
  const span = ms(parentEnd) - ms(parentStart);
  return span > 0 ? (ms(period.end) - ms(period.start)) / span : 0;
}

/** The index of the Mahadasha containing the active one, else 0. */
export function activeIndex(periods: DashaPeriod[], active: DashaPeriod[]): number {
  const maha = active.find((period) => period.level === "maha");
  if (!maha) return 0;
  const index = periods.findIndex(
    (period) => period.lord === maha.lord && period.start === maha.start,
  );
  return index === -1 ? 0 : index;
}

export function isActive(period: DashaPeriod, active: DashaPeriod[]): boolean {
  return active.some(
    (item) =>
      item.level === period.level &&
      item.lord === period.lord &&
      item.start === period.start,
  );
}
