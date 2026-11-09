// The representative journeys from engineering spec §31, driven through a real
// browser against the real backend (with the AI provider faked).

import { expect, test } from "@playwright/test";

import { calculate, fillBirth, formWith, register } from "./helpers";

test("1. a new visitor goes from the home page to a chart, with no account", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /start with your birth chart/i }).click();
  await expect(page).toHaveURL(/\/chart$/);

  const form = formWith(page, "Calculate chart");
  await fillBirth(form);
  await form.getByRole("button", { name: "Calculate chart" }).click();

  await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
  // The known reference chart: Vrischika rising, Saturn in Dhanu, Moon in Rohini.
  const table = page.getByRole("region", { name: "Vedic chart table" });
  await expect(table).toContainText("Saturn");
  await expect(table).toContainText("Dhanu");
  await expect(table).toContainText("Rohini");
  await expect(page.getByRole("img", { name: /north indian kundali/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});

test("2. Vedic exploration: the Kundali styles, the Dasha timeline and a planet", async ({
  page,
}) => {
  await calculate(page, "Vedic (Rashi / D1)");
  await expect(page.getByRole("img", { name: /north indian kundali/i })).toBeVisible();

  await page.getByRole("button", { name: "South Indian" }).click();
  await expect(page.getByRole("button", { name: "South Indian" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("img", { name: /south indian kundali/i })).toBeVisible();

  await calculate(page, "Vimshottari Dasha");
  await expect(page.getByRole("heading", { name: "Vimshottari Dasha" })).toBeVisible();
  const periods = page.getByRole("group", { name: "Mahadasha periods" }).getByRole("button");
  const label =
    (await periods.and(page.locator('[aria-pressed="false"]')).first().getAttribute("aria-label")) ?? "";
  const lord = label.split(" ")[0];
  const next = page.getByRole("button", { name: label, exact: true });
  await next.click();
  await expect(next).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[aria-live="polite"] h3')).toContainText(`${lord} Mahadasha`);

  const explorer = formWith(page, "Explore");
  await explorer.getByLabel("Planet").selectOption("Saturn");
  await fillBirth(explorer);
  await explorer.getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: /^Saturn/ })).toBeVisible();
});

test("3. Western exploration: the zodiac wheel and its aspects", async ({ page }) => {
  await calculate(page, "Western (Tropical)");

  await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();
  const wheel = page.getByRole("img", { name: /western birth chart wheel/i });
  await expect(wheel).toBeVisible();
  await expect(wheel).toContainText("ASC");
  await expect(page.getByRole("heading", { name: "Aspects" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Western chart table" })).toContainText("Sun");
});

test("4. Compare: both systems together, then each alone", async ({ page }) => {
  await calculate(page, "Compare both");

  await expect(page.getByRole("heading", { name: /Vedic ↔ Western comparison/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /north indian kundali/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /western birth chart wheel/i })).toBeVisible();

  const views = page.getByRole("group", { name: "Which chart to show" });
  await views.getByRole("button", { name: "Vedic" }).click();
  await expect(views.getByRole("button", { name: "Vedic" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[aria-hidden="true"]').filter({ has: page.locator("svg") })).toHaveCount(1);

  await views.getByRole("button", { name: "Together" }).click();
  await expect(page.locator('[aria-hidden="true"]').filter({ has: page.locator("svg") })).toHaveCount(0);
});

test("5. Transit reading: the current sky, then a reading of it", async ({ page }) => {
  await calculate(page, "Current transits (Gochar)");
  await expect(page.getByRole("heading", { name: /Current transits/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Transit table" })).toContainText("Saturn");

  await page.goto("/");
  const reading = formWith(page, "Get my reading");
  await fillBirth(reading);
  await reading.getByLabel("Today").check();
  await reading.getByRole("button", { name: "Get my reading" }).click();
  await expect(page.getByText(/Fake guide:/)).toBeVisible();
  await expect(page.getByText(/as of .* UTC/)).toBeVisible();
});

test("6. An AI question is answered, and a provider failure is handled kindly", async ({
  page,
}) => {
  await page.goto("/");
  const guide = formWith(page, "Ask");
  await fillBirth(guide);
  // The birth data is typed once; the form keeps it for every later question.
  const ask = async (question: string) => {
    await guide.getByLabel("Your question").fill(question);
    await guide.getByRole("button", { name: "Ask" }).click();
  };

  await ask("What does my Moon's nakshatra say about my temperament?");
  await expect(page.getByRole("status").getByText(/Fake guide:/)).toBeVisible();

  await ask("[[AUTH]] What does my Moon say?");
  await expect(
    page.getByRole("alert").filter({ hasText: /isn't answering right now/ }),
  ).toBeVisible();

  await ask("[[REFUSE]] What does my Moon say?");
  await expect(page.getByText(/not able to answer that one/i)).toBeVisible();
});

test("7. Unknown birth time: nothing is invented, and the page says so", async ({ page }) => {
  await calculate(page, "Vedic (Rashi / D1)", { time: null });
  await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Chart style" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /south indian kundali/i })).toBeVisible();
  await expect(page.getByText(/North Indian layout needs a birth time/i)).toBeVisible();

  await calculate(page, "Western (Tropical)", { time: null });
  await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();
  await expect(page.getByText("Houses need a birth time.")).toBeVisible();
  await expect(page.getByRole("img", { name: /western birth chart wheel/i })).not.toContainText("ASC");

  // The Dasha is seeded from the Moon's nakshatra, which a missing time leaves
  // open, so there is no timeline - and the page explains rather than guesses.
  await calculate(page, "Vimshottari Dasha", { time: null });
  await expect(
    page.getByRole("alert").filter({ hasText: /without a birth time/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vimshottari Dasha" })).toHaveCount(0);
});

test("8. Memory management: add something to remember, then forget it", async ({ page }) => {
  await register(page);
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "What the guide remembers" }),
  });

  await section.getByLabel("What to remember").fill("I prefer short answers");
  await section.getByRole("button", { name: "Remember" }).click();
  await expect(section.getByText("I prefer short answers")).toBeVisible();

  await page.reload();
  await expect(section.getByText("I prefer short answers")).toBeVisible();

  await section.getByRole("button", { name: "Forget", exact: true }).click();
  await expect(section.getByText("I prefer short answers")).toHaveCount(0);
});

test("9. Delete all data: the account is gone and so is the session", async ({ page }) => {
  const email = await register(page);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  const wrong = page.getByLabel("Type DELETE to confirm");
  await wrong.fill("nope");
  await page.getByRole("button", { name: "Delete my data" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Type DELETE to confirm." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await wrong.fill("DELETE");
  await page.getByRole("button", { name: "Delete my data" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);

  // The credentials no longer work.
  await page.goto("/profile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.locator("main form").getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /email or password/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});

test("10. Birth data is kept after a result, so the next question or system needs no retyping", async ({
  page,
}) => {
  await page.goto("/chart");
  const form = formWith(page, "Calculate chart");
  await form.getByLabel("Vedic (Rashi / D1)", { exact: true }).check();
  await fillBirth(form);
  await form.getByRole("button", { name: "Calculate chart" }).click();
  await expect(page.getByRole("heading", { name: "Rashi (D1) chart" })).toBeVisible();

  // Still filled in...
  await expect(form.getByLabel("Birth date")).toHaveValue("1990-08-15");
  await expect(form.getByLabel("Latitude")).toHaveValue("18.9756");

  // ...so the other system is one click away.
  await form.getByLabel("Western (Tropical)", { exact: true }).check();
  await form.getByRole("button", { name: "Calculate chart" }).click();
  await expect(page.getByRole("heading", { name: "Western natal chart" })).toBeVisible();

  // The Guide keeps the birth data but clears an answered question.
  await page.goto("/");
  const guide = formWith(page, "Ask");
  await fillBirth(guide);
  await guide.getByLabel("Your question").fill("What does my Moon say?");
  await guide.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByRole("status").getByText(/Fake guide:/)).toBeVisible();
  await expect(guide.getByLabel("Birth date")).toHaveValue("1990-08-15");
  await expect(guide.getByLabel("Your question")).toHaveValue("");

  // A question that fails stays in the box, to be sent again.
  await guide.getByLabel("Your question").fill("[[AUTH]] What does my Moon say?");
  await guide.getByRole("button", { name: "Ask" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /isn't answering right now/ }),
  ).toBeVisible();
  await expect(guide.getByLabel("Your question")).toHaveValue("[[AUTH]] What does my Moon say?");
});
