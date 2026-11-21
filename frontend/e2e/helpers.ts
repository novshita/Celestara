import { expect, type Locator, type Page } from "@playwright/test";

export interface Birth {
  date?: string;
  time?: string | null; // null = the time is unknown
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

const MUMBAI: Required<Birth> = {
  date: "1990-08-15",
  time: "14:30",
  latitude: "18.9756",
  longitude: "72.8258",
  timezone: "Asia/Kolkata",
};

/** The form on the page that holds this submit button. Several forms share
 * the same birth-data labels (chart, planet explorer, reading, guide), so
 * every lookup is made inside one of them. */
export function formWith(page: Page, button: string): Locator {
  return page.locator("form", {
    has: page.getByRole("button", { name: button, exact: true }),
  });
}

/** Fills the birth-data fields of one form. */
export async function fillBirth(form: Locator, overrides: Birth = {}) {
  const birth = { ...MUMBAI, ...overrides };
  await form.getByLabel("Birth date").fill(birth.date);
  // The birth-chart page asks for the time confidence with three pills; the other forms
  // (home, profile) still use a dropdown.
  const pills = form.getByRole("radiogroup", { name: "Time confidence" });
  if (await pills.count()) {
    if (birth.time === null) {
      await form.getByLabel("I don't know the time").check();
    } else {
      await form.getByLabel("Exact, I know the time").check();
      await form.getByLabel("Birth time").fill(birth.time);
    }
  } else if (birth.time === null) {
    await form.getByLabel("Time confidence").selectOption("UNKNOWN");
  } else {
    await form.getByLabel("Time confidence").selectOption("EXACT");
    await form.getByLabel("Birth time").fill(birth.time);
  }
  // The birth-chart page detects the timezone from the coordinates unless asked not to.
  const timezone = form.getByLabel("Timezone");
  if ((await timezone.count()) === 0) await form.getByRole("button", { name: "Set manually" }).click();
  await timezone.fill(birth.timezone);
  await form.getByLabel("Latitude").fill(birth.latitude);
  await form.getByLabel("Longitude").fill(birth.longitude);
}

/** Opens /chart, picks a system, fills the form and calculates. */
export async function calculate(
  page: Page,
  system: string,
  birth: Birth = {},
) {
  await page.goto("/chart");
  const form = formWith(page, "Calculate chart");
  await form.getByLabel(system, { exact: true }).check();
  await fillBirth(form, birth);
  await form.getByRole("button", { name: "Calculate chart" }).click();
}

let counter = 0;

/** A new account each time, so journeys never depend on each other. */
export function uniqueEmail(): string {
  counter += 1;
  return `e2e-${Date.now()}-${counter}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Creates an account through the real form and lands on the Profile page. */
export async function register(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto("/profile");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
  await page.locator("main form").getByRole("button", { name: "Create account" }).click();
  // The door opens, then the page changes to the signed-in Profile
  await expect(page.getByRole("heading", { name: "Guide memory" })).toBeVisible({ timeout: 15_000 });
  return email;
}
