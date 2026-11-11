// Engineering spec §31's frontend checks that are about how the pages behave
// rather than what they say: accessibility, reduced motion, small screens.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { calculate, register } from "./helpers";

const SYSTEMS = [
  "Vedic (Rashi / D1)",
  "Western (Tropical)",
  "Compare both",
  "Vimshottari Dasha",
  "Current transits (Gochar)",
];

const RESULT_HEADING: Record<string, RegExp> = {
  "Vedic (Rashi / D1)": /Rashi \(D1\) chart/,
  "Western (Tropical)": /Western natal chart/,
  "Compare both": /Vedic ↔ Western comparison/,
  "Vimshottari Dasha": /Vimshottari Dasha/,
  "Current transits (Gochar)": /Current transits/,
};

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
}

test.describe("accessibility (WCAG 2.2 AA, checked by axe)", () => {
  test("the home page", async ({ page }) => {
    await page.goto("/");
    expect(await violations(page)).toEqual([]);
  });

  for (const mode of ["Vedic", "Western", "Compare"]) {
    test(`the Celestial Universe in ${mode}, with a planet chosen`, async ({ page }) => {
      await page.goto("/");
      const sky = page.getByRole("region", { name: "The sky" });
      await sky.getByRole("button", { name: mode, exact: true }).click();
      await sky.getByRole("button", { name: /^Now: Saturn/ }).click();
      await page.waitForTimeout(1300);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the Celestial Universe with the positions table open, on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.getByText("Positions as text").click();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.waitForTimeout(1300);
    expect(await violations(page)).toEqual([]);
  });

  for (const system of SYSTEMS) {
    test(`the chart page showing: ${system}`, async ({ page }) => {
      await calculate(page, system);
      await expect(page.getByRole("heading", { name: RESULT_HEADING[system] })).toBeVisible();
      // Let the drawing and reveal animations finish so colours are final.
      await page.waitForTimeout(1500);
      expect(await violations(page)).toEqual([]);
    });
  }

  // Some problems only exist when a table overflows its box, which it does on
  // a phone and not on a desktop (a scrollable area a keyboard cannot reach,
  // targets too small to tap), so the results are scanned at phone width too.
  test.describe("on a phone", () => {
    test.use({ viewport: { width: 360, height: 800 } });

    for (const system of SYSTEMS) {
      test(`the chart page showing: ${system}`, async ({ page }) => {
        await calculate(page, system);
        await expect(page.getByRole("heading", { name: RESULT_HEADING[system] })).toBeVisible();
        await page.waitForTimeout(1500);
        expect(await violations(page)).toEqual([]);
      });
    }
  });

  test("the chart page with unknown birth time", async ({ page }) => {
    await calculate(page, "Western (Tropical)", { time: null });
    await expect(page.getByText("Houses need a birth time.")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await violations(page)).toEqual([]);
  });

  test("the profile and the journal when signed in", async ({ page }) => {
    await register(page);
    await page.waitForTimeout(800);
    expect(await violations(page)).toEqual([]);

    await page.goto("/journal");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("the sign-in form when signed out", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("motion", () => {
  const ringDuration = (page: Page) =>
    page.locator(".chart-ring").first().evaluate((element) => {
      return Number.parseFloat(getComputedStyle(element).animationDuration);
    });

  test("the chart draws itself by default", async ({ page }) => {
    await calculate(page, "Western (Tropical)");
    await expect(page.getByRole("img", { name: /western birth chart wheel/i })).toBeVisible();

    expect(await ringDuration(page)).toBeGreaterThan(0.1);
  });

  test("the Celestial Universe turns its rings over about a second", async ({ page }) => {
    await page.goto("/");
    const duration = await page
      .locator(".universe-move")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
    expect(duration).toBeGreaterThan(0.5);
  });

  test.describe("when the visitor asks for reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the Celestial Universe changes zodiac without turning", async ({ page }) => {
      await page.goto("/");
      const durations = await page
        .locator(".universe-move")
        .evaluateAll((elements) =>
          elements.map((element) => Number.parseFloat(getComputedStyle(element).transitionDuration)),
        );
      expect(durations.length).toBeGreaterThan(0);
      for (const duration of durations) expect(duration).toBeLessThan(0.01);
    });

    test("the drawing is not animated", async ({ page }) => {
      await calculate(page, "Western (Tropical)");
      await expect(page.getByRole("img", { name: /western birth chart wheel/i })).toBeVisible();

      expect(await ringDuration(page)).toBeLessThan(0.01);
    });

    test("nothing on the page keeps moving", async ({ page }) => {
      await calculate(page, "Compare both");
      await expect(page.getByRole("heading", { name: /Vedic ↔ Western comparison/ })).toBeVisible();

      const longest = await page.evaluate(() => {
        let longest = 0;
        for (const element of document.querySelectorAll("*")) {
          const style = getComputedStyle(element);
          for (const value of [style.animationDuration, style.transitionDuration]) {
            for (const part of value.split(",")) {
              longest = Math.max(longest, Number.parseFloat(part) || 0);
            }
          }
        }
        return longest;
      });
      expect(longest).toBeLessThan(0.01);
    });
  });
});

test.describe("small screens", () => {
  for (const width of [360, 390, 768]) {
    test.describe(`${width}px wide`, () => {
      test.use({ viewport: { width, height: 800 } });

      const overflow = (page: Page) =>
        page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth - root.clientWidth;
        });

      test("the home page does not scroll sideways", async ({ page }) => {
        await page.goto("/");
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });

      for (const system of ["Vedic (Rashi / D1)", "Compare both", "Vimshottari Dasha"]) {
        test(`${system} does not scroll sideways`, async ({ page }) => {
          await calculate(page, system);
          await expect(page.getByRole("heading", { name: RESULT_HEADING[system] })).toBeVisible();
          expect(await overflow(page)).toBeLessThanOrEqual(0);
        });
      }
    });
  }
});

test.describe("security headers", () => {
  test("every page forbids framing and content sniffing", async ({ request }) => {
    for (const path of ["/", "/chart", "/login"]) {
      const headers = (await request.get(path, { maxRedirects: 0 })).headers();
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    }
  });
});
