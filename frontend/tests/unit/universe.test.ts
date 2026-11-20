import { describe, expect, it } from "vitest";

import { UNIVERSE_BODIES, signAt, toTropical } from "@/lib/universe";

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
