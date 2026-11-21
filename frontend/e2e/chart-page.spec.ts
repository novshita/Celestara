// The redesigned birth-chart page (design/Celestara Birth Chart.html): a live instrument
// beside a three-step form, real results behind tabs, and a planet explorer that uses the
// chart just calculated.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { calculate, fillBirth, formWith, register } from "./helpers";

const status = (page: Page) => page.locator(".cx-cta p[role=status]");

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
}

test.describe("the page", () => {
  test("wears the shared header and sky; each page marks itself as current", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.getByRole("heading", { level: 1, name: "Birth chart" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Birth Chart", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("canvas.cx-sky")).toHaveCount(1);
    // Journal and Profile wear the same header and sky, each marking itself as the current page
    await page.goto("/profile");
    await expect(page.locator("canvas.cx-sky")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Birth Chart", exact: true })).not.toHaveAttribute("aria-current", "page");
    await page.goto("/journal");
    await expect(page.getByRole("link", { name: "Journal", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("says nothing about samples or prototypes: the numbers are real", async ({ page }) => {
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    const text = (await page.locator(".cx").innerText()).toLowerCase();
    expect(text).not.toContain("prototype");
    expect(text).not.toContain("sample");
    expect(text).not.toContain("engine is not connected");
  });
});

test.describe("the instrument", () => {
  test("fills as the form is completed, and marks the place of birth", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.getByText("1 of 5 set")).toBeVisible();
    await page.getByLabel("Birth date").fill("1990-08-15");
    await expect(page.getByText("2 of 5 set")).toBeVisible();
    await page.getByLabel("Birth time").fill("14:30");
    await expect(page.getByText("3 of 5 set")).toBeVisible();
    await page.getByLabel("Latitude").fill("18.9756");
    await expect(page.getByText("4 of 5 set")).toBeVisible();
    await expect(page.locator(".cx-plate")).not.toHaveClass(/cx-on/);
    await page.getByLabel("Longitude").fill("72.8258");
    await expect(page.getByText("5 of 5 set")).toBeVisible();
    await expect(page.locator(".cx-plate")).toHaveClass(/cx-on/);
    // the progress ring is drawn to match: five fifths of the way round
    await expect
      .poll(() => page.locator(".cx-pa").evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
      .toBeLessThan(5); // it eases in over a second, so wait for it to arrive
  });

  test("names the lens and the time certainty, and drops houses when there is no time", async ({ page }) => {
    await page.goto("/chart");
    const readout = page.locator(".cx-readout");
    await expect(readout).toContainText("Vedic (Rashi / D1)");
    await expect(readout).toContainText("Birth time exact");
    await page.getByLabel("Western (Tropical)", { exact: true }).check();
    await expect(readout).toContainText("Tropical zodiac");
    await page.getByLabel("Approximate").check();
    await expect(readout).toContainText("approximate");
    await expect(page.locator(".cx-instr")).toHaveAttribute("data-houses", "on");

    await page.getByLabel("I don't know the time").check();
    await expect(readout).toContainText("No birth time");
    await expect(page.locator(".cx-instr")).toHaveAttribute("data-houses", "off");
    await expect(page.getByLabel("Birth time")).toBeDisabled();
    await expect(page.getByText(/Without a birth time there is no ascendant/)).toBeVisible();
  });

  test("is only an illustration, and says so once a chart exists", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.locator(".cx-readout")).not.toContainText("illustration");
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await expect(page.locator(".cx-readout")).toContainText("An illustration. Your calculated chart is in the results.");
    await expect(page.locator(".cx-instr")).toHaveAttribute("data-cast", "done");
  });
});

test.describe("the form", () => {
  test("says what is missing, next to the field, and sends nothing", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await page.goto("/chart");
    await page.getByRole("button", { name: "Calculate chart" }).click();
    await expect(page.getByText("Add the birth date.")).toBeVisible();
    await expect(page.getByText("Add the birth time, or choose “I don’t know the time”.")).toBeVisible();
    await expect(page.getByText("Add the latitude.")).toBeVisible();
    await expect(page.getByText("Add the longitude.")).toBeVisible();
    await expect(page.getByLabel("Birth date")).toBeFocused();
    await expect(page.getByLabel("Birth date")).toHaveAttribute("aria-invalid", "true");
    await expect(status(page)).toContainText("A few details are missing");
    expect(posts).toEqual([]);

    // an error clears as soon as the field is put right
    await page.getByLabel("Birth date").fill("1990-08-15");
    await expect(page.getByText("Add the birth date.")).toHaveCount(0);
    await expect(page.getByLabel("Birth date")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("rejects out-of-range coordinates in plain words", async ({ page }) => {
    await page.goto("/chart");
    await fillBirth(formWith(page, "Calculate chart"), { latitude: "95", longitude: "200" });
    await page.getByRole("button", { name: "Calculate chart" }).click();
    await expect(page.getByText("Latitude is between −90 and 90.")).toBeVisible();
    await expect(page.getByText("Longitude is between −180 and 180.")).toBeVisible();
  });

  test("detects the timezone unless asked to take it by hand", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.getByText("Detected from your coordinates")).toBeVisible();
    await expect(page.getByLabel("Timezone")).toHaveCount(0);
    await page.getByRole("button", { name: "Set manually" }).click();
    await page.getByLabel("Timezone").fill("Asia/Kolkata");
    await page.getByRole("button", { name: "Detect automatically" }).click();
    await expect(page.getByText("Detected from your coordinates")).toBeVisible();
    await page.getByRole("button", { name: "Set manually" }).click();
    await expect(page.getByLabel("Timezone")).toHaveValue(""); // cleared when it went back to automatic
  });

  test("calculates with the timezone left to the server", async ({ page }) => {
    await page.goto("/chart");
    const form = formWith(page, "Calculate chart");
    await form.getByLabel("Birth date").fill("1990-08-15");
    await form.getByLabel("Birth time").fill("14:30");
    await form.getByLabel("Latitude").fill("18.9756");
    await form.getByLabel("Longitude").fill("72.8258");
    await form.getByRole("button", { name: "Calculate chart" }).click();
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Vedic chart table" })).toContainText("Dhanu");
    await expect(status(page)).toHaveText("Chart ready below.");
  });
});

test.describe("the results", () => {
  test("a tab calculates its view when pressed, and returning to a view is instant", async ({ page }) => {
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    const tabs = page.getByRole("group", { name: "Result view" });
    await expect(tabs.getByRole("button", { name: "Vedic", exact: true })).toHaveAttribute("aria-pressed", "true");

    await tabs.getByRole("button", { name: "Western", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();
    await expect(page.getByLabel("Western (Tropical)", { exact: true })).toBeChecked(); // the form follows

    // Back to Vedic: shown from what was already calculated, with no new request
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await tabs.getByRole("button", { name: "Vedic", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await expect(status(page)).toContainText("ready below");
    expect(posts.filter((u) => u.endsWith("/chart"))).toHaveLength(0);
  });

  test("changing a birth detail marks the results as out of date", async ({ page }) => {
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await expect(page.getByText("Inputs changed · calculate again")).toHaveCount(0);
    await page.getByLabel("Latitude").fill("19.5");
    await expect(page.getByText("Inputs changed · calculate again")).toBeVisible();
    // pressing a tab then calculates the new details, and the notice goes
    await page.getByRole("group", { name: "Result view" }).getByRole("button", { name: "Western", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();
    await expect(page.getByText("Inputs changed · calculate again")).toHaveCount(0);
  });

  test("a backend refusal is shown as an alert beside the button", async ({ page }) => {
    await calculate(page, "Vimshottari Dasha", { time: null });
    await expect(page.locator("form.cx-form").getByRole("alert")).toContainText(/without a birth time/);
    await expect(page.locator("#results")).toHaveCount(0); // and no results were invented
  });
});

test.describe("explore a planet", () => {
  test("asks for a chart first, then answers from it", async ({ page }) => {
    await page.goto("/chart");
    const explore = page.locator("#explore");
    await expect(explore).toContainText("Calculate a chart above to see where Jupiter sits for you.");
    await expect(explore.getByRole("heading", { name: "Jupiter" })).toBeVisible();

    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await expect(explore.getByText("Nakshatra")).toBeVisible(); // Jupiter's real placement arrives by itself
    await expect(explore).not.toContainText("Calculate a chart above");
    await expect(explore).toContainText("Right now:");
  });

  test("offers each system its own planets, and the Western view shows aspects", async ({ page }) => {
    await calculate(page, "Western (Tropical)");
    await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();
    const explore = page.locator("#explore");
    await expect(explore.getByRole("button", { name: "Rahu", exact: true })).toBeVisible();
    await explore.getByRole("button", { name: "Western", exact: true }).click();
    await expect(explore.getByRole("button", { name: "Rahu", exact: true })).toHaveCount(0);
    await expect(explore.getByRole("button", { name: "Pluto", exact: true })).toBeVisible();
    await expect(explore.getByText("Element")).toBeVisible();
    await expect(explore.getByText("Aspects")).toBeVisible();
    // a planet only the other system has gives way to a valid one
    await explore.getByRole("button", { name: "Vedic", exact: true }).click();
    await explore.getByRole("button", { name: "Rahu", exact: true }).click();
    await explore.getByRole("button", { name: "Western", exact: true }).click();
    await expect(explore.getByRole("heading", { name: "Sun" })).toBeVisible();
  });

  test("uses the details the chart was calculated from, not whatever is typed since", async ({ page }) => {
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    const explore = page.locator("#explore");
    await expect(explore.getByText("Nakshatra")).toBeVisible();
    await page.getByLabel("Birth date").fill("1985-01-01");
    await explore.getByRole("button", { name: "Saturn", exact: true }).click();
    await expect(explore.getByRole("heading", { name: "Saturn" })).toBeVisible();
    await expect(explore).toContainText("Dhanu"); // still the 1990 chart's Saturn
  });
});

test.describe("the saved profile", () => {
  test("a signed-out visitor is invited to log in", async ({ page }) => {
    await page.goto("/chart");
    await expect(page.locator(".cx-prof")).toContainText("Log in to start from your saved birth profile");
    await expect(page.locator(".cx-prof").getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/profile");
  });

  test("fills the form, can be cleared, and brought back", async ({ page }) => {
    await register(page);
    await page.goto("/chart");
    await expect(page.locator(".cx-prof")).toContainText("Save a birth profile");

    await page.goto("/profile");
    const profile = formWith(page, "Save profile");
    await fillBirth(profile);
    await profile.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

    await page.goto("/chart");
    await expect(page.getByLabel("Birth date")).toHaveValue("1990-08-15");
    await expect(page.getByLabel("Latitude")).toHaveValue("18.9756");
    await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Kolkata");
    await expect(page.getByText("5 of 5 set")).toBeVisible();
    await expect(page.locator(".cx-prof")).toContainText("Filled in from your saved profile");

    await page.getByRole("button", { name: "Clear fields" }).click();
    await expect(page.getByLabel("Birth date")).toHaveValue("");
    await expect(page.getByLabel("Latitude")).toHaveValue("");
    await expect(page.locator(".cx-prof")).toContainText("Your saved profile is untouched");

    await page.getByRole("button", { name: "Use saved profile" }).click();
    await expect(page.getByLabel("Birth date")).toHaveValue("1990-08-15");
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible(); // the header shows who is in
  });
});

test.describe("motion and small screens", () => {
  test.describe("when the visitor asks for reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("nothing on the wheel turns or glints", async ({ page }) => {
      await page.goto("/chart");
      for (const selector of ["#ringlabels", "#const circle", "#ring"]) {
        const name = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
        expect(name, selector).toBe("none");
      }
    });
  });

  test("the wheel turns slowly by default", async ({ page }) => {
    await page.goto("/chart");
    const name = await page.locator("#ringlabels").evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("cx-spin");
  });

  test("the whole page fits a phone, from the empty form to results", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chart");
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await calculate(page, "Vedic (Rashi / D1)");
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expect(page.locator("#explore")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});

test.describe("accessibility (axe)", () => {
  for (const size of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`the empty page on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/chart");
      expect(await violations(page)).toEqual([]);
    });

    test(`the page with errors showing on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/chart");
      await page.getByRole("button", { name: "Calculate chart" }).click();
      await expect(page.getByText("Add the birth date.")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test(`the explorer with a planet chosen, in both systems, on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await calculate(page, "Vedic (Rashi / D1)");
      await expect(page.locator("#explore").getByText("Nakshatra")).toBeVisible();
      await page.waitForTimeout(1500); // let the results finish fading in, so colours are final
      expect(await violations(page)).toEqual([]);
      await page.locator("#explore").getByRole("button", { name: "Western", exact: true }).click();
      await expect(page.locator("#explore").getByText("Element")).toBeVisible();
      await page.waitForTimeout(1000);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the time-unknown notice and out-of-date tag", async ({ page }) => {
    await calculate(page, "Vedic (Rashi / D1)", { time: null });
    await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
    await page.getByLabel("Latitude").fill("20");
    await expect(page.getByText("Inputs changed · calculate again")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await violations(page)).toEqual([]);
  });
});
