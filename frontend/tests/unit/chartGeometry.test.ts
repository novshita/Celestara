import { describe, expect, it } from "vitest";

import {
  NORTH_HOUSES,
  NORTH_SIZE,
  SOUTH_CELLS,
  angularDistance,
  centroid,
  normalizeDegrees,
  signNumberForHouse,
  spreadLongitudes,
  wheelPoint,
} from "@/lib/chartGeometry";

describe("normalizeDegrees", () => {
  it("wraps into 0 to 360", () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(-370)).toBe(350);
  });
});

describe("wheelPoint", () => {
  const near = (value: number, expected: number) =>
    expect(value).toBeCloseTo(expected, 9);

  it("draws the rotation longitude at the left", () => {
    const p = wheelPoint(0, 0, 10, 123, 123);
    near(p.x, -10);
    near(p.y, 0);
  });

  it("puts the next quarter turn below, since longitude runs counter-clockwise", () => {
    const p = wheelPoint(0, 0, 10, 123 + 90, 123);
    near(p.x, 0);
    near(p.y, 10); // SVG y grows downward
  });

  it("puts half a turn on the right and three quarters at the top", () => {
    const right = wheelPoint(0, 0, 10, 180, 0);
    near(right.x, 10);
    near(right.y, 0);
    const top = wheelPoint(0, 0, 10, 270, 0);
    near(top.x, 0);
    near(top.y, -10);
  });

  it("is offset by the centre and scaled by the radius", () => {
    const p = wheelPoint(200, 200, 50, 0, 0);
    near(p.x, 150);
    near(p.y, 200);
  });
});

describe("angularDistance", () => {
  it("is the short way round", () => {
    expect(angularDistance(10, 20)).toBe(10);
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(0, 180)).toBe(180);
    expect(angularDistance(10, 370)).toBe(0);
  });
});

describe("spreadLongitudes", () => {
  const gaps = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.map((value, i) =>
      i + 1 < sorted.length ? sorted[i + 1] - value : sorted[0] + 360 - value,
    );
  };

  it("leaves well-separated bodies where they are", () => {
    const input = [10, 100, 200, 300];
    const out = spreadLongitudes(input, 8);
    out.forEach((value, i) => expect(value).toBeCloseTo(input[i], 6));
  });

  it("pushes crowded bodies apart to the minimum gap", () => {
    const out = spreadLongitudes([100, 101, 102, 103], 8);
    gaps(out).forEach((gap, i) => {
      if (i < 3) expect(gap).toBeGreaterThanOrEqual(8 - 1e-6);
    });
  });

  it("returns results in the input's order", () => {
    const out = spreadLongitudes([200, 10, 100], 8);
    expect(out[0]).toBeCloseTo(200, 6);
    expect(out[1]).toBeCloseTo(10, 6);
    expect(out[2]).toBeCloseTo(100, 6);
  });

  it("spreads across the 0/360 seam", () => {
    const out = spreadLongitudes([359, 0, 1], 8);
    expect(angularDistance(out[0], out[1])).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(angularDistance(out[1], out[2])).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it("handles zero or one body", () => {
    expect(spreadLongitudes([], 8)).toEqual([]);
    expect(spreadLongitudes([370], 8)).toEqual([10]);
  });

  it("does not hang or lose bodies when they cannot all fit", () => {
    const out = spreadLongitudes(Array.from({ length: 60 }, () => 5), 20);
    expect(out).toHaveLength(60);
    out.forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
  });
});

describe("North Indian layout", () => {
  const area = (vertices: readonly (readonly [number, number])[]) =>
    Math.abs(
      vertices.reduce((sum, [x, y], i) => {
        const [nx, ny] = vertices[(i + 1) % vertices.length];
        return sum + (x * ny - nx * y);
      }, 0),
    ) / 2;

  it("has twelve houses that tile the square exactly", () => {
    expect(NORTH_HOUSES).toHaveLength(12);
    const total = NORTH_HOUSES.reduce((sum, house) => sum + area(house), 0);
    expect(total).toBeCloseTo(NORTH_SIZE * NORTH_SIZE, 6);
  });

  it("has every house inside the square", () => {
    for (const house of NORTH_HOUSES) {
      for (const [x, y] of house) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(NORTH_SIZE);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(NORTH_SIZE);
      }
    }
  });

  it("puts house 1 (the ascendant) in the top middle", () => {
    const { x, y } = centroid(NORTH_HOUSES[0]);
    expect(x).toBeCloseTo(NORTH_SIZE / 2, 6);
    expect(y).toBeLessThan(NORTH_SIZE / 2);
  });

  it("numbers signs from the ascendant's sign", () => {
    expect(signNumberForHouse(0, 1)).toBe(1); // Aries rising: house 1 is Aries
    expect(signNumberForHouse(7, 1)).toBe(8); // Scorpio rising
    expect(signNumberForHouse(7, 6)).toBe(1); // ...and house 6 wraps to Aries
    expect(signNumberForHouse(11, 2)).toBe(1);
  });
});

describe("South Indian layout", () => {
  it("gives each of the twelve signs its own cell on the ring", () => {
    expect(SOUTH_CELLS).toHaveLength(12);
    expect(new Set(SOUTH_CELLS.map(([c, r]) => `${c},${r}`)).size).toBe(12);
    for (const [column, row] of SOUTH_CELLS) {
      expect(column === 0 || column === 3 || row === 0 || row === 3).toBe(true);
    }
  });

  it("puts Aries second from the left on the top row", () => {
    expect(SOUTH_CELLS[0]).toEqual([1, 0]);
  });

  it("walks clockwise, one cell at a time", () => {
    for (let i = 0; i < 12; i += 1) {
      const [a, b] = [SOUTH_CELLS[i], SOUTH_CELLS[(i + 1) % 12]];
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
    }
  });
});
