// Stepping into the doorway on the Home page: the scene zooms into the door and a chart wheel of
// the sky now appears inside it, with the planets laid out in order round their signs.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const PAIRS = ["Aries:Mesha", "Taurus:Vrishabha", "Gemini:Mithuna", "Cancer:Karka", "Leo:Simha", "Virgo:Kanya", "Libra:Tula", "Scorpio:Vrischika", "Sagittarius:Dhanu", "Capricorn:Makara", "Aquarius:Kumbha", "Pisces:Meena"];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
}

async function stepIn(page: Page, how: "Western zodiac" | "Vedic zodiac" | "Compare both zodiacs" = "Vedic zodiac") {
  await page.getByRole("button", { name: how }).click();
  await expect(page.getByRole("button", { name: /Step back out/ })).toBeVisible();
  await expect
    .poll(() => page.locator(".hm-ov").evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 8000 })
    .toBe(1);
}

const where = async (page: Page, name: string) => {
  const t = await page.locator(`.hm-pn[aria-label^="${name}"]`).getAttribute("transform");
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t!)!;
  return { x: Number(m[1]), y: Number(m[2]) };
};

test("a zodiac toggle zooms into the door, and the chart that appears is the sky now", async ({ page }) => {
  await page.goto("/guide");
  await expect(page.locator(".hm-ov")).toHaveAttribute("inert", "");
  await stepIn(page, "Western zodiac");
  await expect(page.locator(".hm-ov")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".hm-world")).toHaveAttribute("inert", ""); // the scene behind cannot be reached
  await expect(page.getByText("Western · the sky now")).toBeVisible();
  for (const sign of SIGNS) await expect(page.locator(".hm-ov").getByText(sign, { exact: true })).toBeVisible();
  await expect(page.locator(".hm-pn")).toHaveCount(9);
  expect((await page.locator(".hm").innerText()).toLowerCase()).not.toContain("sample");
  await expect(page.getByRole("button", { name: /Step back out/ })).toBeFocused({ timeout: 8000 });
});

test("the planets are laid out in order round their signs, as the sky has them", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Western zodiac");
  const ring = await page.locator(".hm-pn").evaluateAll((els) =>
    els.map((el) => {
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute("transform") ?? "")!;
      const label = el.getAttribute("aria-label") ?? "";
      return { name: label.split(",")[0], x: Number(m[1]) - 300, y: 350 - Number(m[2]), western: /Western (\w+)/.exec(label)![1] };
    }),
  );
  // Aries is at 9 o'clock and the zodiac runs counter-clockwise, so a planet's angle gives its sector
  const sector = (p: { x: number; y: number }) => Math.floor(((180 - (Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360) / 30);
  for (const planet of ring) {
    // crowded planets are moved in or out, never round, so each stays in its own sign's sector
    expect(SIGNS[sector(planet)], `${planet.name} sits in the ${planet.western} sector`).toBe(planet.western);
  }
});

test("Vedic draws the Vedic signs; Both draws the two rings and marks the planets that change sign", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Vedic zodiac");
  const ov = page.locator(".hm-ov");
  await expect(ov.getByText("Mesha", { exact: true })).toBeVisible();
  await expect(ov.getByText("Aries", { exact: true })).toHaveCount(0);

  await ov.getByRole("button", { name: "Both" }).click();
  await expect(ov.getByText("Mesha", { exact: true })).toBeVisible();
  await expect(ov.getByText("Aries", { exact: true })).toBeVisible();
  await expect(page.getByText(/Dashed ring: this planet is in a different sign/)).toBeVisible();
  const marked = await page.locator(".hm-pn").evaluateAll((els) =>
    els.map((el) => ({ label: el.getAttribute("aria-label")!, dashed: el.querySelector('circle[stroke-dasharray="3 3"]') !== null })),
  );
  expect(marked.some((m) => m.dashed)).toBe(true);
  for (const m of marked) {
    const [, western, vedic] = /Western (\w+), Vedic (\w+)/.exec(m.label)!;
    expect(m.dashed, m.label).toBe(!PAIRS.includes(`${western}:${vedic}`));
  }
});

test("the planets stay put when the zodiac changes inside the door; only the signs turn", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Western zodiac");
  const western = await where(page, "Saturn");
  await page.locator(".hm-ov").getByRole("button", { name: "Both" }).click();
  const both = await where(page, "Saturn");
  const angle = (p: { x: number; y: number }) => Math.atan2(350 - p.y, p.x - 300);
  expect(angle(both)).toBeCloseTo(angle(western), 1); // the same direction (Both draws closer in, for two rings)
  expect(Math.hypot(both.x - 300, both.y - 350)).toBeLessThan(Math.hypot(western.x - 300, western.y - 350));
});

test("choosing a planet inside the door names its signs, and the text beside the scene agrees", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Western zodiac");
  const jupiter = page.locator('.hm-pn[aria-label^="Jupiter"]');
  await jupiter.click();
  await expect(page.locator(".hm-ov").getByText(/^Jupiter.*\(Western\).*\(Vedic\)/)).toBeVisible();
  await expect(page.locator(".hm-pinfo")).toContainText("Jupiter");
  await expect(jupiter).toHaveAttribute("aria-pressed", "true");
  await jupiter.click(); // again lets go
  await expect(page.locator(".hm-pinfo")).toContainText("Choose a planet");
});

test("the planets inside the door work from the keyboard", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Vedic zodiac");
  const saturn = page.locator('.hm-pn[aria-label^="Saturn"]');
  await saturn.focus();
  await page.keyboard.press("Enter");
  await expect(saturn).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(saturn).toHaveAttribute("aria-pressed", "false");
});

test("Escape and the button step back out, and the toggle you used gets focus back", async ({ page }) => {
  await page.goto("/guide");
  await stepIn(page, "Western zodiac");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Western zodiac" })).toBeFocused({ timeout: 8000 });
  await expect(page.locator(".hm-ov")).toHaveAttribute("inert", "");
  await expect(page.locator(".hm-world")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".hm-ov")).toHaveCSS("opacity", "0");
  await expect
    .poll(() => page.locator(".hm-lay[aria-hidden]").first().evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1"); // the great planet is back, so the scene is as it was
  await expect(page.locator(".hm-orb").first()).toBeVisible();

  await stepIn(page, "Compare both zodiacs");
  await page.getByRole("button", { name: /Step back out/ }).click();
  await expect(page.getByRole("button", { name: "Compare both zodiacs" })).toBeFocused({ timeout: 8000 });
});

test("scrolling over the doorway travels in and back out; elsewhere the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/guide");
  const scene = (await page.locator(".hm-scene").boundingBox())!;
  await page.mouse.move(scene.x + scene.width * 0.1, scene.y + scene.height * 0.15);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(700);
  await expect(page.locator(".hm-ov")).toHaveAttribute("inert", ""); // away from the door, nothing travelled

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(scene.x + scene.width * 0.5, scene.y + scene.height * 0.8);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(40);
  }
  await expect(page.getByRole("button", { name: /Step back out/ })).toBeVisible({ timeout: 8000 });
  await expect
    .poll(() => page.locator(".hm-ov").evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 8000 })
    .toBe(1);

  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(40);
  }
  await expect
    .poll(() => page.locator(".hm-ov").evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 8000 })
    .toBe(0);
  await expect(page.locator(".hm-ov")).toHaveAttribute("inert", "");
});

test.describe("when the visitor asks for reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("it is in or out at once, with no travel and no scroll hijack", async ({ page }) => {
    await page.goto("/guide");
    await page.getByRole("button", { name: "Vedic zodiac" }).click();
    await expect(page.locator(".hm-ov")).toHaveCSS("opacity", "1", { timeout: 1500 });
    expect(await page.locator(".hm-world").evaluate((el) => (el as HTMLElement).style.transform)).toMatch(/scale\(5\.3(00)?\)/);
    await page.getByRole("button", { name: /Step back out/ }).click();
    await expect(page.locator(".hm-ov")).toHaveCSS("opacity", "0", { timeout: 1500 });

    const scene = (await page.locator(".hm-scene").boundingBox())!;
    await page.mouse.move(scene.x + scene.width * 0.5, scene.y + scene.height * 0.8);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(600);
    await expect(page.locator(".hm-ov")).toHaveCSS("opacity", "0"); // the wheel is left to the page
  });
});

test("nothing in the chart can be reached until the visitor steps in", async ({ page }) => {
  await page.goto("/guide");
  expect(await page.locator(".hm-pn").count()).toBe(0); // it is not even drawn yet
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".hm-ov"))).toBe(false);
  }
});

for (const size of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const how of ["Vedic zodiac", "Compare both zodiacs", "Western zodiac"] as const) {
    test(`the chart in the door is accessible: ${how}, on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/guide");
      await stepIn(page, how);
      await page.locator(".hm-pn").first().click();
      await page.waitForTimeout(800);
      expect(await violations(page)).toEqual([]);
    });
  }

  test(`the chart in the door fits ${size.name} and stays on screen`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/guide");
    await stepIn(page, "Compare both zodiacs");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const scene = (await page.locator(".hm-scene").boundingBox())!;
    for (const name of [/Step back out/, "Vedic", "Both", "Western"]) {
      const box = (await page.locator(".hm-ov").getByRole("button", { name }).first().boundingBox())!;
      expect(box.x, String(name)).toBeGreaterThanOrEqual(scene.x - 1);
      expect(box.x + box.width, String(name)).toBeLessThanOrEqual(scene.x + scene.width + 1);
    }
  });
}
