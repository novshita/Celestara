import { describe, expect, it } from "vitest";

import {
  SAMPLE_PLANETS,
  WHEEL_LABELS,
  clamp,
  e2,
  e3,
  pol,
  seg,
  wheel,
} from "@/components/landing/math";

describe("scroll progress helpers", () => {
  it("clamps into range", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(0.4)).toBe(0.4);
  });

  it("measures progress through a stretch, held at both ends", () => {
    expect(seg(0.1, 0.2, 0.6)).toBe(0);
    expect(seg(0.4, 0.2, 0.6)).toBeCloseTo(0.5);
    expect(seg(0.9, 0.2, 0.6)).toBe(1);
  });

  it("eases from 0 to 1, symmetrically and without overshoot", () => {
    for (const ease of [e2, e3]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      expect(ease(0.5)).toBeCloseTo(0.5);
      let prev = -1;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const v = ease(Math.min(1, t));
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});

describe("the wheel drawing", () => {
  it("places points clockwise from 3 o'clock around the centre", () => {
    const [x, y] = pol(100, 0);
    expect(x).toBeCloseTo(600);
    expect(y).toBeCloseTo(500);
    const [x2, y2] = pol(100, 90);
    expect(x2).toBeCloseTo(500);
    expect(y2).toBeCloseTo(600);
  });

  it("draws twelve sign labels and the degree ticks, hidden from assistive tech", () => {
    const svg = wheel(false);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/class="wl"/g)).toHaveLength(12);
    expect(svg.match(/class="wt"/g)).toHaveLength(72);
    for (const label of WHEEL_LABELS) expect(svg).toContain(`>${label}</text>`);
    expect(svg).not.toContain('class="wp');
  });

  it("adds the nine sample planets and their aspect lines only when asked", () => {
    const svg = wheel(true);
    expect(SAMPLE_PLANETS).toHaveLength(9);
    expect(svg.match(/class="wp( sun)?"/g)).toHaveLength(9);
    expect(svg.match(/class="wp sun"/g)).toHaveLength(1);
    expect(svg.match(/class="wa"/g)).toHaveLength(5);
  });
});
