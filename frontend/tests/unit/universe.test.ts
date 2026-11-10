import { describe, expect, it } from "vitest";

import { wheelPoint } from "@/lib/chartGeometry";
import {
  COMPARE_INNER_SCALE,
  UNIVERSE_BODIES,
  describeBody,
  frameFor,
  placeAngle,
  ringTransform,
  signAt,
  toTropical,
} from "@/lib/universe";

import { vedic, western } from "./fixtures";

const AYANAMSA = vedic.metadata.ayanamsa_degrees;

describe("the two zodiacs", () => {
  it("agree: a sidereal longitude plus the ayanamsa is the Western longitude", () => {
    for (const placement of vedic.placements) {
      const counterpart = western.positions.find((p) => p.body === placement.graha);
      if (!counterpart) continue; // Rahu and Ketu have no Western counterpart here
      expect(toTropical(placement.longitude, AYANAMSA)).toBeCloseTo(counterpart.longitude, 3);
    }
  });

  it("wraps past 360", () => {
    expect(toTropical(350, 24)).toBeCloseTo(14, 9);
  });

  it("names the same sign the charts do, in both systems", () => {
    for (const placement of vedic.placements) {
      const tropical = toTropical(placement.longitude, AYANAMSA);
      const asVedic = signAt(tropical, AYANAMSA, "vedic");
      expect(asVedic.sign).toBe(placement.rashi);
      expect(asVedic.degrees).toBeCloseTo(placement.degrees_in_rashi, 3);

      const counterpart = western.positions.find((p) => p.body === placement.graha);
      if (!counterpart) continue;
      const asWestern = signAt(tropical, AYANAMSA, "western");
      expect(asWestern.sign).toBe(counterpart.sign);
      expect(asWestern.degrees).toBeCloseTo(counterpart.degrees_in_sign, 3);
    }
  });

  it("puts a body at the very start of a sign at zero degrees, not thirty of the last", () => {
    expect(signAt(0, 24, "western")).toEqual({ sign: "Aries", degrees: 0 });
    expect(signAt(24, 24, "vedic")).toEqual({ sign: "Mesha", degrees: 0 });
    expect(signAt(359.999, 24, "western").sign).toBe("Pisces");
  });

  it("lists the nine grahas", () => {
    expect(UNIVERSE_BODIES).toHaveLength(9);
  });
});

describe("placing a body on the wheel", () => {
  it("matches the chart drawings' geometry", () => {
    // A body put at 3 o'clock, turned by placeAngle, lands where wheelPoint says.
    for (const longitude of [0, 30, 90, 180, 271.5, 359]) {
      const radius = 100;
      const theta = (placeAngle(longitude) * Math.PI) / 180;
      const x = 300 + radius * Math.cos(theta);
      const y = 300 + radius * Math.sin(theta);
      const expected = wheelPoint(300, 300, radius, longitude, 0);
      expect(x).toBeCloseTo(expected.x, 6);
      expect(y).toBeCloseTo(expected.y, 6);
    }
  });

  it("starts at 9 o'clock and runs counter-clockwise", () => {
    expect(placeAngle(0)).toBe(180);
    expect(placeAngle(90)).toBe(90); // 6 o'clock
    expect(placeAngle(180)).toBe(0); // 3 o'clock
    expect(placeAngle(270)).toBe(-90); // 12 o'clock
  });
});

describe("the frame for each mode", () => {
  it("shows only the Western ring in Western mode, at rest", () => {
    const frame = frameFor("western", AYANAMSA);
    expect(frame.western).toEqual({ opacity: 1, rotate: 0, scale: 1 });
    expect(frame.vedic.opacity).toBe(0);
  });

  it("shows only the Vedic ring in Vedic mode, turned back by the ayanamsa", () => {
    const frame = frameFor("vedic", AYANAMSA);
    expect(frame.vedic).toEqual({ opacity: 1, rotate: -AYANAMSA, scale: 1 });
    expect(frame.western.opacity).toBe(0);
  });

  it("turns the scene by the ayanamsa between Western and Vedic", () => {
    const from = frameFor("western", AYANAMSA);
    const to = frameFor("vedic", AYANAMSA);
    // The ring on show turns through the ayanamsa...
    expect(to.vedic.rotate - from.western.rotate).toBeCloseTo(-AYANAMSA, 9);
    // ...and the ring leaving and the ring arriving start and end in step, so
    // both turn together while one fades out and the other in.
    expect(from.vedic.rotate).toBe(from.western.rotate);
    expect(to.western.rotate).toBe(to.vedic.rotate);
  });

  it("shows both rings in Compare, the Vedic one inside the Western one", () => {
    const frame = frameFor("compare", AYANAMSA);
    expect(frame.western.opacity).toBe(1);
    expect(frame.vedic.opacity).toBe(1);
    expect(frame.vedic.scale).toBe(COMPARE_INNER_SCALE);
    expect(frame.western.scale).toBe(1);
    expect(frame.vedic.rotate).toBe(-AYANAMSA);
    expect(frame.western.rotate).toBe(0);
  });

  it("tucks the sky's track inside both rings in Compare", () => {
    expect(frameFor("compare", AYANAMSA).skyRadius).toBeLessThan(frameFor("vedic", AYANAMSA).skyRadius);
    expect(frameFor("vedic", AYANAMSA).skyRadius).toBe(frameFor("western", AYANAMSA).skyRadius);
  });

  it("keeps the Compare bodies clear of the inner ring", () => {
    // The Vedic ring's inner edge at its scaled size (drawn at 236) is 236*0.8.
    expect(frameFor("compare", AYANAMSA).skyRadius).toBeLessThan(236 * COMPARE_INNER_SCALE);
  });

  it("writes a transform CSS can animate", () => {
    expect(ringTransform({ opacity: 1, rotate: -24.5, scale: 0.8 })).toBe(
      "rotate(-24.5deg) scale(0.8)",
    );
  });
});

describe("describeBody", () => {
  const saturn = { name: "Saturn", tropical: 289.869, retrograde: true };

  it("gives one sign per zodiac shown", () => {
    expect(describeBody(saturn, AYANAMSA, "vedic")).toBe("Saturn (retrograde) · Dhanu 26° (Vedic)");
    expect(describeBody(saturn, AYANAMSA, "western")).toBe(
      "Saturn (retrograde) · Capricorn 19° (Western)",
    );
    expect(describeBody(saturn, AYANAMSA, "compare")).toBe(
      "Saturn (retrograde) · Dhanu 26° (Vedic) · Capricorn 19° (Western)",
    );
  });

  it("leaves out 'retrograde' for a direct body", () => {
    expect(describeBody({ ...saturn, retrograde: false }, AYANAMSA, "vedic")).not.toContain("retrograde");
  });
});
