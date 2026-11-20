import { describe, expect, it } from "vitest";

import { stripFrom, type DashboardData } from "@/lib/dashboard";
import {
  ARC,
  GRAHAS,
  RING_ITEMS,
  arcAngle,
  arcPathData,
  arcPoint,
  archMarkup,
  CHART,
  JOURNEY,
  ORB_CLEARANCE,
  ORB_STAGGER,
  asOf,
  chartCaptions,
  chartOffsets,
  chartPlanet,
  chartPoint,
  chartRings,
  journeyFrame,
  orbOffsets,
  planetRadius,
  spreadOffsets,
  ringSectors,
  ringStyle,
  signsOf,
} from "@/lib/homeScene";

describe("the arc of signs", () => {
  it("lays longitude along a 220° arc, 0° at the left and 360° at the right", () => {
    expect(arcAngle(0)).toBe(200);
    expect(arcAngle(370)).toBeCloseTo(-20, 6);
    expect(arcAngle(180)).toBeCloseTo(200 - ARC.k * 180, 6);
    const [x0] = arcPoint(0, ARC.radius);
    const [x360] = arcPoint(360, ARC.radius);
    expect(x0).toBeLessThan(ARC.cx);
    expect(x360).toBeGreaterThan(ARC.cx);
  });

  it("puts the middle of the zodiac over the doorway, at the top of the arc", () => {
    const [x, y] = arcPoint(370 * (110 / 220), ARC.radius); // arc angle 90°: straight up
    expect(x).toBeCloseTo(ARC.cx, 6);
    expect(y).toBeCloseTo(ARC.cy - ARC.radius, 6);
  });

  it("draws one continuous path from before Aries to after Pisces", () => {
    const d = arcPathData();
    expect(d.startsWith("M")).toBe(true);
    expect(d.match(/L/g)!.length).toBe(98);
  });

  it("has nine grahas and twenty-four signs", () => {
    expect(GRAHAS).toHaveLength(9);
    expect(RING_ITEMS).toHaveLength(24);
    expect(RING_ITEMS.filter((i) => i.system === "tropical").map((i) => i.name)[0]).toBe("Aries");
    expect(RING_ITEMS.filter((i) => i.system === "sidereal").map((i) => i.name)[0]).toBe("Mesha");
  });
});

describe("changing zodiac turns the signs, not the planets", () => {
  const AY = 24.23;
  const aries = RING_ITEMS.find((i) => i.system === "tropical" && i.index === 0)!;
  const mesha = RING_ITEMS.find((i) => i.system === "sidereal" && i.index === 0)!;

  it("shows only the chosen zodiac, and both in Compare", () => {
    expect(ringStyle(aries, "western", AY).opacity).toBe(1);
    expect(ringStyle(mesha, "western", AY).opacity).toBe(0);
    expect(ringStyle(aries, "vedic", AY).opacity).toBe(0);
    expect(ringStyle(mesha, "vedic", AY).opacity).toBe(1);
    expect(ringStyle(aries, "compare", AY).opacity).toBe(1);
    expect(ringStyle(mesha, "compare", AY).opacity).toBe(1);
  });

  it("sets the Vedic signs back from the Western ones by exactly the ayanamsa", () => {
    // Mesha sits where Aries does, moved on along the arc by the ayanamsa
    const tick = (r: ReturnType<typeof ringStyle>) => Number(/rotate\(([-\d.]+)deg\)/.exec(r.tick.transform)![1]);
    const western = tick(ringStyle(aries, "western", AY));
    const vedic = tick(ringStyle(mesha, "vedic", AY));
    expect(vedic - western).toBeCloseTo(ARC.k * AY, 6);
  });

  it("tucks the Vedic ring inside the Western one in Compare, and only then", () => {
    const radius = (r: ReturnType<typeof ringStyle>) => Number(/translateX\(([-\d.]+)px\)/.exec(r.tick.transform)![1]);
    expect(radius(ringStyle(mesha, "vedic", AY))).toBe(ARC.radius);
    expect(radius(ringStyle(mesha, "compare", AY))).toBe(ARC.radius - 40);
    expect(radius(ringStyle(aries, "compare", AY))).toBe(ARC.radius);
  });

  it("names a planet's sign in each zodiac, using the same longitude", () => {
    // 0° Aries tropical is 5° 46' Pisces sidereal when the ayanamsa is 24.23°
    expect(signsOf(0, 24.23)).toEqual({ western: "Aries", vedic: "Meena" });
    expect(signsOf(30, 24.23)).toEqual({ western: "Taurus", vedic: "Mesha" });
    expect(signsOf(359.9, 24.23).western).toBe("Pisces");
  });
});

describe("planets that stand close together", () => {
  it("leaves planets on the arc when they are apart", () => {
    expect(orbOffsets([10, 60, 120, 200, 300])).toEqual([0, 0, 0, 0, 0]);
  });

  it("moves a close neighbour off the arc so the discs do not cover each other", () => {
    const offsets = orbOffsets([100, 105]);
    expect(offsets[0]).toBe(0);
    expect(Math.abs(offsets[1])).toBe(ORB_STAGGER);
  });

  it("keeps the order given, whatever the longitudes' order", () => {
    // the planet at 105 is second in the list but later round the arc
    expect(orbOffsets([105, 100])).toEqual([ORB_STAGGER, 0]);
  });

  it("treats exactly the clearance as clear, and a hair less as crowded", () => {
    expect(orbOffsets([50, 50 + ORB_CLEARANCE])).toEqual([0, 0]);
    expect(orbOffsets([50, 50 + ORB_CLEARANCE - 0.1])[1]).not.toBe(0);
  });

  it("separates three at once, using the inner and outer tracks", () => {
    const offsets = orbOffsets([100, 102, 104]);
    expect(new Set(offsets).size).toBe(3);
  });

  it("keeps every pair of planets that share a track at least the clearance apart, over many skies", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let checked = 0;
    for (let trial = 0; trial < 400; trial++) {
      const longitudes = Array.from({ length: 9 }, () => random() * 360);
      const sorted = [...longitudes].sort((a, b) => a - b);
      // a crowd of four or more inside one clearance cannot be kept apart by three tracks: skip those
      const crowded = sorted.some((l, i) => sorted.filter((m) => m >= l && m < l + ORB_CLEARANCE).length > 3 && i >= 0);
      if (crowded) continue;
      const offsets = orbOffsets(longitudes);
      for (let i = 0; i < 9; i++) {
        for (let j = i + 1; j < 9; j++) {
          if (offsets[i] === offsets[j]) expect(Math.abs(longitudes[i] - longitudes[j])).toBeGreaterThanOrEqual(ORB_CLEARANCE);
        }
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("never loses a planet when a crowd is bigger than the tracks", () => {
    const offsets = orbOffsets([100, 101, 102, 103, 104]);
    expect(offsets).toHaveLength(5);
    expect(offsets.every((o) => [0, ORB_STAGGER, -ORB_STAGGER].includes(o))).toBe(true);
  });
});

describe("spreading planets round a wheel", () => {
  it("treats the end of the zodiac as meeting its start", () => {
    // 359° and 1° are two degrees apart on a wheel, though 358 apart in a list
    const arc = spreadOffsets([359, 1], 17.5, 46);
    const wheel = spreadOffsets([359, 1], 17.5, 46, true);
    expect(arc).toEqual([0, 0]);
    expect(new Set(wheel).size).toBe(2);
  });

  it("is no different from the arc's rule when nothing is near the seam", () => {
    const lons = [20, 80, 140, 200, 260];
    expect(spreadOffsets(lons, 17.5, 46, true)).toEqual(spreadOffsets(lons, 17.5, 46, false));
  });

  it("keeps planets that share a track a full clearance apart round the circle, over many skies", () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let checked = 0;
    for (let trial = 0; trial < 400; trial++) {
      const lons = Array.from({ length: 9 }, () => random() * 360);
      const clearance = 40 / ((138 * Math.PI) / 180);
      const near = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
      // four or more inside one clearance cannot be separated by three tracks: skip those skies
      if (lons.some((l) => lons.filter((m) => near(l, m) < clearance).length > 3)) continue;
      const offsets = spreadOffsets(lons, clearance, 34, true);
      for (let i = 0; i < 9; i++) {
        for (let j = i + 1; j < 9; j++) {
          if (offsets[i] === offsets[j]) expect(near(lons[i], lons[j])).toBeGreaterThanOrEqual(clearance);
        }
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("needs more room round a smaller wheel (Compare), and less in a wider one", () => {
    const close = [100, 112];
    expect(new Set(chartOffsets(close, "compare")).size).toBe(2); // 12° apart is too close at the smaller radius
    expect(chartOffsets([100, 130], "western")).toEqual([0, 0]);
  });
});

describe("small pieces of copy and markup", () => {
  it("dates the sky in UTC", () => {
    expect(asOf("2026-11-20T09:05:00Z")).toBe("As of 20 Nov 2026, 09:05 UTC");
    expect(asOf("2026-01-02T23:59:00Z")).toBe("As of 2 Jan 2026, 23:59 UTC");
  });

  it("draws the doorway the same every time", () => {
    const markup = archMarkup();
    expect(archMarkup()).toBe(markup);
    expect(markup.match(/<rect/g)!.length).toBeGreaterThan(30);
    expect(markup).toContain("hmcol");
  });
});

describe("the saved-profile strip", () => {
  const period = (lord: string, start: string, end: string, years: number) => ({
    lord, level: "maha" as const, start, end, duration_years: years, is_partial: false, sub_periods: [],
  });
  const data: DashboardData = {
    dasha: [period("Jupiter", "2010-01-01", "2026-01-01", 16), { ...period("Saturn", "2024-01-01", "2026-09-01", 2.7), level: "antar" }],
    periods: [
      period("Moon", "1990-01-01", "2000-01-01", 10),
      period("Mars", "2000-01-01", "2010-01-01", 10),
      period("Jupiter", "2010-01-01", "2026-01-01", 16),
      period("Saturn", "2026-01-01", "2046-01-01", 20),
    ],
    dashaAsOf: "2016-01-01T00:00:00Z",
    transits: [{ graha: "Moon", transit: { rashi: "Karka", retrograde: false } } as never],
    asOf: "2026-11-20T00:00:00Z",
  };

  it("names the current Mahadasha and Antardasha, and marks the current one on the bar", () => {
    const strip = stripFrom(data);
    expect(strip.current).toEqual({ maha: "Jupiter", antar: "Saturn" });
    expect(strip.bar.map((b) => [b.lord, b.current])).toEqual([
      ["Moon", false], ["Mars", false], ["Jupiter", true], ["Saturn", false],
    ]);
  });

  it("puts the 'now' marker proportionally along the timeline", () => {
    const { nowFraction } = stripFrom(data);
    // 26 years of 56 have passed by 2016
    expect(nowFraction).toBeCloseTo(26 / 56, 2);
    expect(stripFrom({ ...data, dashaAsOf: "1900-01-01T00:00:00Z" }).nowFraction).toBe(0);
    expect(stripFrom({ ...data, dashaAsOf: "2100-01-01T00:00:00Z" }).nowFraction).toBe(1);
  });

  it("copes with a dasha that reports nothing", () => {
    const strip = stripFrom({ ...data, dasha: [], periods: [] });
    expect(strip.current).toEqual({ maha: "", antar: null });
    expect(strip.bar).toEqual([]);
    expect(strip.nowFraction).toBe(0);
  });

  it("offers questions built from what was calculated", () => {
    const strip = stripFrom(data);
    expect(strip.questions[0]).toContain("Jupiter Mahadasha");
    expect(strip.questions.at(-1)).toContain("Moon's nakshatra");
  });
});

describe("the zoom into the doorway", () => {
  it("is at rest at 0: the scene untouched, the chart not yet there", () => {
    const f = journeyFrame(0);
    expect(f.ease).toBe(0);
    expect(f.worldTransform).toBe("translate3d(0,0.0px,0) scale(1.000)");
    expect(f.fade).toBe(1);
    expect(f.overlay).toBe(0);
    expect(f.radius).toBe(62);
  });

  it("ends at 1 with the doorway enlarged to fill the scene and the chart fully shown", () => {
    const f = journeyFrame(1);
    expect(f.ease).toBe(1);
    expect(f.worldTransform).toBe(`translate3d(0,${(JOURNEY.targetY - JOURNEY.originY).toFixed(1)}px,0) scale(${(1 + JOURNEY.zoom).toFixed(3)})`);
    expect(f.fade).toBe(0);
    expect(f.overlay).toBe(1);
    expect(f.radius).toBe(0);
  });

  it("moves the doorway's centre to the target, wherever the zoom has got to", () => {
    // a point at the doorway's centre, after scale-about-the-origin then the shift
    for (const p of [0, 0.3, 0.7, 1]) {
      const m = /translate3d\(0,([-\d.]+)px,0\) scale\(([\d.]+)\)/.exec(journeyFrame(p).worldTransform)!;
      const y = JOURNEY.originY + (JOURNEY.originY - JOURNEY.originY) * Number(m[2]) + Number(m[1]);
      const e = journeyFrame(p).ease;
      expect(y).toBeCloseTo(JOURNEY.originY + (JOURNEY.targetY - JOURNEY.originY) * e, 0);
    }
  });

  it("only ever eases forward: bigger, then the rest fades, then the chart appears", () => {
    let last = journeyFrame(0);
    for (let p = 0.02; p <= 1.0001; p += 0.02) {
      const f = journeyFrame(p);
      expect(f.ease).toBeGreaterThanOrEqual(last.ease);
      expect(f.fade).toBeLessThanOrEqual(last.fade);
      expect(f.overlay).toBeGreaterThanOrEqual(last.overlay);
      last = f;
    }
    // the planet, clouds and arc are gone before the chart shows up, so the two never overlap
    expect(journeyFrame(0.6).overlay).toBe(0);
    expect(journeyFrame(0.62).overlay).toBe(0);
    expect(journeyFrame(0.62).fade).toBeLessThan(0.2);
  });

  it("stays in range however far the gesture overshoots", () => {
    expect(journeyFrame(-3).ease).toBe(0);
    expect(journeyFrame(7).ease).toBe(1);
    expect(journeyFrame(7).overlay).toBe(1);
    expect(journeyFrame(-3).fade).toBe(1);
  });
});

describe("the chart wheel inside the door", () => {
  const AY = 24.23;

  it("shows the rings each mode calls for, Compare with the Vedic ring inside and turned", () => {
    expect(chartRings("vedic", AY).map((r) => r.system)).toEqual(["sidereal"]);
    expect(chartRings("western", AY).map((r) => r.system)).toEqual(["tropical"]);
    const both = chartRings("compare", AY);
    expect(both.map((r) => r.system)).toEqual(["tropical", "sidereal"]);
    const [western, vedic] = both;
    expect(vedic.outer).toBeLessThan(western.inner); // the Vedic ring sits inside, not on top
    expect(vedic.offset).toBe(AY);
    expect(western.offset).toBe(0);
    // alone, the one ring is the full width
    expect(chartRings("vedic", AY)[0]).toMatchObject({ inner: 168, outer: 212, offset: 0 });
  });

  it("draws twelve sectors per ring, named in order, with each name upright", () => {
    const [ring] = chartRings("western", AY);
    const sectors = ringSectors(ring);
    expect(sectors.map((s) => s.label.text)).toEqual([...WESTERN_FIRST_TO_LAST]);
    for (const s of sectors) {
      expect(s.path.startsWith("M")).toBe(true);
      expect(s.path.endsWith("Z")).toBe(true);
      // upright: the label is turned by less than a quarter turn from the horizontal either way
      const r = ((s.label.rotate % 360) + 360) % 360;
      expect(r <= 90 || r >= 270).toBe(true);
    }
    expect(new Set(sectors.map((s) => s.fill)).size).toBe(2); // alternating bands
  });

  it("turns the Vedic ring by the ayanamsa against the Western one in Compare", () => {
    const [western, vedic] = chartRings("compare", AY);
    const first = (r: typeof western) => ringSectors(r)[0].label;
    const a = Math.atan2(CHART.cy - first(western).y, first(western).x - CHART.cx);
    const b = Math.atan2(CHART.cy - first(vedic).y, first(vedic).x - CHART.cx);
    // the same sign (the first of each), but the Vedic one sits ayanamsa degrees further round
    expect(((a - b) * 180) / Math.PI).toBeCloseTo(AY, 1);
  });

  it("puts a planet in the same place in Western and Compare, and on the sidereal zero in Vedic", () => {
    const west = chartPlanet(100, "western", AY);
    expect(west.angle).toBe(80);
    expect(chartPlanet(100, "compare", AY).angle).toBe(80);
    expect(chartPlanet(100, "vedic", AY).angle).toBeCloseTo(180 - (100 - AY), 6);
    expect(Math.hypot(west.x - CHART.cx, west.y - CHART.cy)).toBeCloseTo(planetRadius("western"), 6);
    expect(planetRadius("compare")).toBeLessThan(planetRadius("western"));
  });

  it("marks a planet whose sign differs between the two zodiacs, and only then", () => {
    // with the ayanamsa at 24.23°, sidereal = tropical − 24.23
    expect(chartPlanet(10, "compare", AY).moved).toBe(true); // 10° Aries is in Pisces, sidereally
    expect(chartPlanet(50, "compare", AY).moved).toBe(true); // 20° Taurus is in Aries, sidereally
    expect(chartPlanet(55, "compare", AY).moved).toBe(false); // 25° Taurus is 0.8° into Taurus, sidereally: the same sign
    expect(chartPlanet(20, "compare", 5).moved).toBe(false); // a small gap leaves it where it was
    expect(chartPlanet(32, "compare", 5).moved).toBe(true); // ...unless it was within the gap of a boundary
  });

  it("places points the way the arcs do: 0° is 3 o'clock, 90° is straight up", () => {
    expect(chartPoint(100, 0)).toEqual([CHART.cx + 100, CHART.cy]);
    const [x, y] = chartPoint(100, 90);
    expect(x).toBeCloseTo(CHART.cx, 6);
    expect(y).toBeCloseTo(CHART.cy - 100, 6);
  });

  it("says what each wheel is, using the real ayanamsa", () => {
    expect(chartCaptions("vedic", 24.2345).hint).toContain("24.23°");
    expect(chartCaptions("western", AY).centre).toBe("Western");
    expect(chartCaptions("compare", AY).hint).toContain("different sign in each zodiac");
    for (const mode of ["vedic", "western", "compare"] as const) {
      expect(chartCaptions(mode, AY).title.toLowerCase()).not.toContain("sample");
    }
  });
});

const WESTERN_FIRST_TO_LAST = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
