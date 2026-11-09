import { describe, expect, it } from "vitest";

import { buildBirthData } from "@/lib/birthFormData";
import { PLANET_ABBR, planetAbbr } from "@/lib/chartLabels";
import { suggestedQuestions, type DashboardData } from "@/lib/dashboard";
import { EXPLORE_BODIES, isExploreSystem } from "@/lib/planets";
import type { DashaPeriod, GrahaTransit } from "@/lib/types";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const BASE = {
  birth_date: "1990-08-15",
  time_confidence: "EXACT",
  birth_time: "14:30",
  latitude: "18.9756",
  longitude: "72.8258",
  timezone_name: "Asia/Kolkata",
};

describe("buildBirthData", () => {
  it("adds seconds to the browser's HH:MM time and parses coordinates", () => {
    expect(buildBirthData(form(BASE))).toEqual({
      birth_date: "1990-08-15",
      birth_time: "14:30:00",
      time_confidence: "EXACT",
      latitude: 18.9756,
      longitude: 72.8258,
      timezone_name: "Asia/Kolkata",
    });
  });

  it("keeps a time that already has seconds", () => {
    expect(buildBirthData(form({ ...BASE, birth_time: "14:30:15" })).birth_time).toBe(
      "14:30:15",
    );
  });

  it("drops the time when it is unknown, even if one was typed", () => {
    const data = buildBirthData(form({ ...BASE, time_confidence: "UNKNOWN" }));
    expect(data.birth_time).toBeNull();
    expect(data.time_confidence).toBe("UNKNOWN");
  });

  it("sends no timezone when the field is blank, so the backend detects it", () => {
    expect(buildBirthData(form({ ...BASE, timezone_name: "" })).timezone_name).toBeNull();
  });
});

describe("planet picker", () => {
  it("offers the nine grahas for Vedic and ten bodies for Western", () => {
    expect(EXPLORE_BODIES.vedic).toHaveLength(9);
    expect(EXPLORE_BODIES.western).toHaveLength(10);
    expect(EXPLORE_BODIES.vedic).toContain("Rahu");
    expect(EXPLORE_BODIES.western).not.toContain("Rahu");
  });

  it("recognises only the two systems", () => {
    expect(isExploreSystem("vedic")).toBe(true);
    expect(isExploreSystem("western")).toBe(true);
    expect(isExploreSystem("compare")).toBe(false);
    expect(isExploreSystem(undefined)).toBe(false);
  });

  it("abbreviates every body it offers, uniquely", () => {
    const names = new Set([...EXPLORE_BODIES.vedic, ...EXPLORE_BODIES.western]);
    const abbreviations = [...names].map(planetAbbr);
    expect(new Set(abbreviations).size).toBe(names.size);
    for (const name of names) expect(PLANET_ABBR[name]).toBeDefined();
  });

  it("falls back to the first two letters for an unknown body", () => {
    expect(planetAbbr("Chiron")).toBe("Ch");
  });
});

describe("suggestedQuestions", () => {
  const period = (lord: string, level: DashaPeriod["level"]): DashaPeriod => ({
    lord,
    level,
    start: "2020-01-01T00:00:00Z",
    end: "2030-01-01T00:00:00Z",
    duration_years: 10,
    is_partial: false,
    sub_periods: [],
  });
  const saturn = {
    graha: "Saturn",
    transit: { rashi: "Meena" },
  } as unknown as GrahaTransit;
  const data = (over: Partial<DashboardData> = {}): DashboardData => ({
    dasha: [period("Venus", "maha"), period("Sun", "antar")],
    transits: [saturn],
    asOf: "2026-11-04T00:00:00Z",
    ...over,
  });

  it("builds questions from what was calculated, never a prediction", () => {
    const questions = suggestedQuestions(data());
    expect(questions).toEqual([
      "What themes does my Venus Mahadasha bring out in my chart?",
      "How does Sun Antardasha interact with Venus Mahadasha?",
      "What does Saturn moving through Meena mean for my chart?",
      "What does my Moon's nakshatra say about my temperament?",
    ]);
  });

  it("still has something to ask when there is no Dasha or transit", () => {
    expect(suggestedQuestions(data({ dasha: [], transits: [] }))).toEqual([
      "What does my Moon's nakshatra say about my temperament?",
    ]);
  });

  it("never offers more than four", () => {
    expect(suggestedQuestions(data()).length).toBeLessThanOrEqual(4);
  });
});
