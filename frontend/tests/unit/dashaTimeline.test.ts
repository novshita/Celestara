import { describe, expect, it } from "vitest";

import {
  activeIndex,
  formatDashaDate,
  isActive,
  positionInCycle,
  shareOf,
} from "@/lib/dashaTimeline";

import { dasha } from "./fixtures";

const { periods, active, asOf } = dasha;

describe("positionInCycle", () => {
  it("places now within the cycle", () => {
    const position = positionInCycle(periods, asOf);
    expect(position).not.toBeNull();
    expect(position).toBeGreaterThan(0);
    expect(position).toBeLessThan(1);
  });

  it("is null outside the cycle, and for no periods", () => {
    expect(positionInCycle(periods, "1800-01-01T00:00:00Z")).toBeNull();
    expect(positionInCycle(periods, "2999-01-01T00:00:00Z")).toBeNull();
    expect(positionInCycle([], asOf)).toBeNull();
  });
});

describe("shareOf", () => {
  const start = periods[0].start;
  const end = periods[periods.length - 1].end;

  it("makes the Mahadasha shares add up to the whole cycle", () => {
    const total = periods.reduce((sum, p) => sum + shareOf(p, start, end), 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("makes each Antardasha share add up to its Mahadasha", () => {
    for (const maha of periods) {
      const total = maha.sub_periods.reduce(
        (sum, sub) => sum + shareOf(sub, maha.start, maha.end),
        0,
      );
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("is zero for an empty span", () => {
    expect(shareOf(periods[0], start, start)).toBe(0);
  });
});

describe("the active period", () => {
  it("finds the Mahadasha that contains now", () => {
    const maha = active.find((p) => p.level === "maha")!;
    expect(periods[activeIndex(periods, active)].lord).toBe(maha.lord);
  });

  it("falls back to the first period when nothing is active", () => {
    expect(activeIndex(periods, [])).toBe(0);
  });

  it("falls back to the first period when the active one is not in the list", () => {
    const stray = { ...active.find((p) => p.level === "maha")!, start: "1900-01-01T00:00:00Z" };
    expect(activeIndex(periods, [stray])).toBe(0);
  });

  it("marks exactly the active periods", () => {
    const maha = active.find((p) => p.level === "maha")!;
    expect(isActive(maha, active)).toBe(true);
    const other = periods.find((p) => p.lord !== maha.lord)!;
    expect(isActive(other, active)).toBe(false);
  });
});

describe("formatDashaDate", () => {
  it("prints the same text anywhere, in UTC", () => {
    expect(formatDashaDate("2026-11-04T23:30:00Z")).toBe("4 Nov 2026");
    expect(formatDashaDate("2026-01-01T00:00:00Z")).toBe("1 Jan 2026");
  });
});
