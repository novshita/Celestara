// The signed-out front door: a pinned scroll story, then a panel of what is
// inside (design/Celestara_landing.html). Signed in, `/` is the app home.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { register } from "./helpers";

/** Scrolls the story to a fraction (0..1) and waits for the eased animation to arrive. */
async function scrollStory(page: Page, fraction: number) {
  await page.evaluate((f) => {
    const story = document.querySelector("#story") as HTMLElement;
    window.scrollTo(0, story.offsetTop + (story.offsetHeight - window.innerHeight) * f);
  }, fraction);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const m = /scaleX\(([\d.]+)\)/.exec((document.querySelector("#prog") as HTMLElement).style.transform);
          return m ? Number(m[1]) : 0;
        }),
      { timeout: 8000 },
    )
    .toBeCloseTo(fraction, 1);
}

const scrollToEnd = (page: Page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

test.describe("the landing page", () => {
  test("a signed-out visitor sees it at /, without the app header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Read the Sky Both Ways/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Readings", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Birth Chart", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("every planet image loads", async ({ page }) => {
    const failed: string[] = [];
    const loaded = new Set<string>();
    page.on("response", (r) => {
      const m = /\/planets\/(\w+)\.webp$/.exec(r.url());
      if (!m) return;
      if (r.ok()) loaded.add(m[1]);
      else failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/");
    await expect.poll(() => loaded.size).toBe(8);
    expect(failed).toEqual([]);
    expect([...loaded].sort()).toEqual(
      ["blackhole", "earth", "jupiter", "mars", "mercury", "moon", "saturn", "sun"],
    );
  });

  test("a shooting star crosses the sky now and then, behind everything else", async ({ page }) => {
    await page.goto("/");
    const star = page.locator(".shoot");
    await expect(star).toHaveAttribute("aria-hidden", "true");
    expect(await star.evaluate((el) => getComputedStyle(el).animationName)).toBe("ln-shoot");
    // Dark between passes, bright while it crosses; the first pass comes a few seconds in.
    await expect.poll(() => star.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 12000 }).toBeGreaterThan(0.5);
    await expect.poll(() => star.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 12000 }).toBeLessThan(0.05);
  });

  test("a signed-in visitor gets the app home at / instead", async ({ page }) => {
    await register(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your celestial universe" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Read the Sky Both Ways/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
  });

  test("for a signed-out visitor the app header's Home leads to the guide", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/guide");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole("heading", { name: "Your celestial universe" })).toBeVisible();
  });

  test("the navigation reaches the real pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "AI Guide", exact: true }).click();
    await expect(page).toHaveURL(/\/guide#ask$/);
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Journal", exact: true }).click();
    await expect(page).toHaveURL(/\/journal$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("scrolling tells the story, in order", async ({ page }) => {
    await page.goto("/");
    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline).toBeVisible();
    await expect(page.locator("#vision")).toBeHidden(); // not yet

    await scrollStory(page, 0.25);
    await expect(page.locator("#vision")).toBeVisible();
    await expect(page.locator("#vH")).toContainText("The system calculates.");
    await expect(headline).toBeHidden(); // it flew past

    await scrollStory(page, 0.58);
    await expect(page.locator("#chart")).toBeVisible();
    await expect(page.getByRole("button", { name: /Vimshottari Dasha/ })).toBeVisible();
    await page.getByRole("button", { name: /Moon · Nakshatra/ }).click();
    await expect(page.getByText("Read from your chart")).toBeVisible();

    await scrollStory(page, 1);
    await expect(page.getByRole("link", { name: /AI Guide grounded in calculated facts/ })).toBeVisible();
    await expect(page.locator("#num")).toHaveText("24.2");
  });

  test("Take the tour jumps into the story and Replay returns to the start", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Take the tour/ }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1500);
    await scrollToEnd(page);
    await page.getByRole("button", { name: /Replay the fly-in/ }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });

  test("the panel's cards and the closing call to action lead into the app", async ({ page }) => {
    await page.goto("/");
    await scrollToEnd(page);
    await expect(page.getByText("Zodiac systems")).toBeVisible();
    await expect(page.locator("#stats b")).toHaveText(["2", "9", "120", "12"], { timeout: 5000 });

    await page.getByRole("link", { name: "A guide that shows its working" }).click();
    await expect(page).toHaveURL(/\/guide#ask$/);

    await page.goto("/");
    await scrollToEnd(page);
    await page.getByRole("link", { name: /Start with your birth chart/ }).click();
    await expect(page).toHaveURL(/\/chart$/);
  });

  test("the navigation stays readable over the pale panel", async ({ page }) => {
    await page.goto("/");
    await scrollToEnd(page);
    const nav = page.locator("#lnav");
    await expect(nav).toHaveClass(/on-paper/);
    // Dark ink, not the light text it has over the stars (after its short colour transition).
    await expect.poll(() => nav.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(23, 16, 46)");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(nav).not.toHaveClass(/on-paper/);
  });

  test("nothing throws while the whole story plays", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(String(e)));
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    await page.goto("/");
    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) await scrollStory(page, f);
    await scrollToEnd(page);
    expect(problems).toEqual([]);
  });

  test("it does not touch the app's own styling", async ({ page }) => {
    await page.goto("/");
    await page.goto("/chart"); // a client-side style leak would show here
    const body = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { margin: s.margin, bg: s.backgroundColor };
    });
    expect(body.margin).toBe("0px");
    await expect(page.getByRole("link", { name: "Birth Chart", exact: true })).toBeVisible();
    const header = page.locator("header").first();
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  });

  test.describe("when the visitor asks for reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the headline is in place at once, and the figures need no count-up", async ({ page }) => {
      await page.goto("/");
      const rise = await page
        .locator("h1.big .ln span")
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
      expect(rise === "none" || rise === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
      await scrollToEnd(page);
      await expect(page.locator("#stats b")).toHaveText(["2", "9", "120", "12"]);
    });

    test("there is no shooting star", async ({ page }) => {
      await page.goto("/");
      const star = page.locator(".shoot");
      expect(await star.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
      expect(await star.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    });
  });
});

test.describe("the landing page on small screens", () => {
  for (const width of [390, 768]) {
    test(`does not scroll sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      for (const f of [0, 0.5, 1]) {
        await scrollStory(page, f);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `at ${f}`).toBeLessThanOrEqual(0);
      }
      await scrollToEnd(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("the end of the story on phones", () => {
  for (const width of [360, 390, 430]) {
    test(`the ayanamsa card and the feature list do not overlap at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/");
      await scrollStory(page, 0.95);
      const card = await page.locator("#card").boundingBox();
      const list = await page.locator("#feats").boundingBox();
      const chip = await page.locator("#card .tagc").boundingBox();
      const title = await page.locator("#card h4").boundingBox();
      if (!card || !list || !chip || !title) throw new Error("missing boxes");
      expect(card.x + card.width, "card ends before the list starts").toBeLessThanOrEqual(list.x);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(list.x + list.width).toBeLessThanOrEqual(width);
      expect(chip.y, "chip sits below the title").toBeGreaterThanOrEqual(title.y + title.height - 1);
    });
  }
});

test.describe("the landing page, checked by axe (WCAG 2.2 AA)", () => {
  async function violations(page: Page) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    return results.violations.map((v) => ({
      rule: v.id,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 4),
    }));
  }

  for (const size of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "phone", width: 390, height: 800 },
  ]) {
    for (const f of [0, 0.25, 0.58, 1]) {
      test(`${size.name}, ${f === 1 ? "end of the story" : `story at ${f}`}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto("/");
        await scrollStory(page, f);
        await page.waitForTimeout(400); // let the last eased frames settle
        expect(await violations(page)).toEqual([]);
      });
    }

    test(`${size.name}, the panel and footer`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");
      await scrollToEnd(page);
      await page.waitForTimeout(2000); // the count-up
      expect(await violations(page)).toEqual([]);
    });
  }
});
