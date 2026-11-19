import { describe, expect, it } from "vitest";

import { ARC_LENGTH, PREVIEW_PLANETS, SIGN_CODES, point, wheelMarkup } from "@/lib/chartInstrument";
import {
  chartErrors,
  plateOffset,
  stepsSet,
  type ChartInputs,
} from "@/lib/chartValidation";

const GOOD: ChartInputs = {
  date: "1990-08-15",
  time: "14:30",
  confidence: "EXACT",
  latitude: "18.9756",
  longitude: "72.8258",
};

describe("chart form checks", () => {
  it("accepts a complete record", () => {
    expect(chartErrors(GOOD)).toEqual({});
    expect(stepsSet(GOOD)).toBe(5);
  });

  it("asks for every missing field in plain words", () => {
    const errors = chartErrors({ date: "", time: "", confidence: "EXACT", latitude: "", longitude: "" });
    expect(errors).toEqual({
      date: "Add the birth date.",
      time: "Add the birth time, or choose “I don’t know the time”.",
      latitude: "Add the latitude.",
      longitude: "Add the longitude.",
    });
  });

  it("needs no time when it is unknown, but still asks for it when estimated", () => {
    expect(chartErrors({ ...GOOD, time: "", confidence: "UNKNOWN" })).toEqual({});
    expect(chartErrors({ ...GOOD, time: "", confidence: "ESTIMATED" }).time).toBeTruthy();
  });

  it("keeps coordinates in range", () => {
    expect(chartErrors({ ...GOOD, latitude: "91" }).latitude).toBe("Latitude is between −90 and 90.");
    expect(chartErrors({ ...GOOD, latitude: "-90" }).latitude).toBeUndefined();
    expect(chartErrors({ ...GOOD, longitude: "-181" }).longitude).toBe("Longitude is between −180 and 180.");
    expect(chartErrors({ ...GOOD, longitude: "abc" }).longitude).toBeTruthy();
  });

  it("rejects dates before 1800", () => {
    expect(chartErrors({ ...GOOD, date: "1799-12-31" }).date).toBeTruthy();
    expect(chartErrors({ ...GOOD, date: "1800-01-01" }).date).toBeUndefined();
  });

  it("counts the steps set, with the lens always counted", () => {
    expect(stepsSet({ date: "", time: "", confidence: "EXACT", latitude: "", longitude: "" })).toBe(1);
    expect(stepsSet({ date: "", time: "", confidence: "UNKNOWN", latitude: "", longitude: "" })).toBe(2);
    expect(stepsSet({ ...GOOD, longitude: "" })).toBe(4);
  });

  it("places coordinates on the world grid, west left and north up", () => {
    expect(plateOffset({ ...GOOD, latitude: "0", longitude: "0" })).toEqual({ x: 50, y: 50 });
    expect(plateOffset({ ...GOOD, latitude: "90", longitude: "-180" })).toEqual({ x: 0, y: 0 });
    expect(plateOffset({ ...GOOD, latitude: "-90", longitude: "180" })).toEqual({ x: 100, y: 100 });
    expect(plateOffset({ ...GOOD, latitude: "" })).toBeNull();
  });
});

describe("the instrument wheel", () => {
  const svg = wheelMarkup();

  it("is decorative and draws the twelve signs, nine planets and the centre", () => {
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/class="cx-nm"/g)).toHaveLength(12);
    for (const code of SIGN_CODES) expect(svg).toContain(`>${code}</text>`);
    expect(PREVIEW_PLANETS).toHaveLength(9);
    expect(svg.match(/class="cx-pd( cx-su)?"/g)).toHaveLength(9);
    expect(svg).toContain('id="houses"');
    expect(svg).toContain('id="planets"');
  });

  it("is the same every time, so server and browser agree", () => {
    expect(wheelMarkup()).toBe(svg);
  });

  it("measures the progress arc at the wheel's circumference", () => {
    expect(ARC_LENGTH).toBeCloseTo(3103.9, 0);
    expect(svg).toContain(`stroke-dasharray="${ARC_LENGTH.toFixed(1)}"`);
    const [x, y] = point(100, 0);
    expect([x, y]).toEqual([600, 500]);
  });
});
