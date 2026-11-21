// The Profile and Journal pages (design/Celestara Account.html), signed out and signed in, driven
// through a real browser against the real backend.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fillBirth, formWith, register, uniqueEmail } from "./helpers";

const PASSWORD = "a-long-enough-password";

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
}

const door = (page: Page) => page.getByTestId("door");
const signInForm = (page: Page) => page.getByRole("form", { name: "Account" });

async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await signInForm(page).getByRole("button", { name: "Log in" }).click();
}

test.describe("signed out", () => {
  for (const view of [
    { path: "/profile", title: "Profile", opens: "What opens up" },
    { path: "/journal", title: "Journal", opens: "A page of your own" },
  ]) {
    test(`${view.path}: the way in beside a sealed door, then a sample of what opens up`, async ({ page }) => {
      await page.goto(view.path);
      await expect(page.getByRole("heading", { level: 1, name: view.title })).toBeVisible();
      await expect(page.getByText("Account required")).toBeVisible();
      await expect(page.getByRole("link", { name: view.title, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(door(page)).not.toHaveClass(/ac-open/);
      await expect(door(page)).toContainText("Sealed");
      await expect(page.getByRole("heading", { level: 2, name: view.opens })).toBeVisible();
      // the sample is only to look at: it cannot be reached or heard
      const sample = page.getByTestId("sample");
      await expect(sample).toHaveAttribute("inert", "");
      await expect(sample).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".ac-dwrap")).toHaveAttribute("aria-hidden", "true");
    });

    test(`${view.path}: tabbing never lands in the sample or the door`, async ({ page }) => {
      await page.goto(view.path);
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest(".ac-sample, .ac-dwrap"))).toBe(false);
      }
    });

    for (const size of [
      { name: "desktop", width: 1280, height: 900 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      test(`${view.path}: accessible and within the screen on ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(view.path);
        await expect(page.getByLabel("Email")).toBeVisible();
        await page.waitForTimeout(800);
        expect(await violations(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      });
    }
  }

  test("the two tabs switch between logging in and creating an account", async ({ page }) => {
    await page.goto("/profile");
    const login = page.getByRole("tab", { name: "Log in" });
    const create = page.getByRole("tab", { name: "Create account" });
    await expect(login).toHaveAttribute("aria-selected", "true");
    await expect(signInForm(page).getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");

    await create.click();
    await expect(create).toHaveAttribute("aria-selected", "true");
    await expect(login).toHaveAttribute("aria-selected", "false");
    await expect(signInForm(page).getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("placeholder", "Choose a password");
  });

  test("a form that cannot work says why at the field, and sends nothing", async ({ page }) => {
    await page.goto("/profile");
    await signInForm(page).getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter your email.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(door(page)).not.toHaveClass(/ac-open/); // the door only opens for a real sign-in

    await page.getByLabel("Email").fill("someone-at-example");
    await page.getByLabel("Password", { exact: true }).fill("x");
    await signInForm(page).getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/That email does not look right/)).toBeVisible();

    await page.getByRole("tab", { name: "Create account" }).click();
    await expect(page.getByText(/That email does not look right/)).toHaveCount(0); // a fresh tab starts clean
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await signInForm(page).getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  });

  test("Show and Hide reveal the password, and say which they are doing", async ({ page }) => {
    await page.goto("/profile");
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("wrong credentials: the server's answer is shown and the door stays sealed", async ({ page }) => {
    await page.goto("/profile");
    await logIn(page, uniqueEmail(), "not-the-password");
    await expect(page.getByRole("alert").filter({ hasText: /email or password/i })).toBeVisible();
    await expect(door(page)).not.toHaveClass(/ac-open/);
    await expect(signInForm(page).getByRole("button", { name: "Log in" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Guide memory" })).toHaveCount(0);
  });

  test("a good sign-in opens the door, and then the page changes to the signed-in view", async ({ page }) => {
    const email = await register(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByText("Account required")).toBeVisible();

    await page.goto("/journal"); // another page: the door works on both
    await logIn(page, email);
    await expect(door(page)).toHaveClass(/ac-open/);
    await expect(door(page)).toContainText("Open");
    await expect(signInForm(page).getByRole("button", { name: /Opening/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "New entry" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("with reduced motion the door still opens, and the page changes sooner", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const email = await register(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByText("Account required")).toBeVisible();
    const before = Date.now();
    await logIn(page, email);
    await expect(page.getByRole("heading", { name: "Guide memory" })).toBeVisible({ timeout: 15_000 });
    expect(Date.now() - before).toBeLessThan(6_000);
    await context.close();
  });

  test("a conversation link while signed out offers the way in, not a broken page", async ({ page }) => {
    await page.goto("/profile/conversations/1");
    await expect(page.getByRole("heading", { level: 1, name: "Conversation" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});

test.describe("the signed-in Profile", () => {
  test("has a section for each thing it holds, and the side list reaches them", async ({ page }) => {
    await register(page);
    await expect(page.getByText(/^Signed in as/)).toBeVisible();
    for (const name of ["Birth profile", "Preferences", "Guide memory", "Saved conversations", "Privacy and data"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Open your birth chart →" })).toHaveAttribute("href", "/chart");
    await page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name: "Privacy and data" }).click();
    await expect(page).toHaveURL(/#privacy$/);
  });

  test("saves the birth profile, shows it in the glance box, and keeps it", async ({ page }) => {
    await register(page);
    const glance = page.locator(".ac-glance");
    await expect(glance).toContainText("None yet");

    const form = formWith(page, "Save profile");
    await fillBirth(form);
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(page.locator("#birth").getByRole("status")).toHaveText("Saved");
    await expect(glance).toContainText("15 Aug 1990, 14:30");
    // what was typed is still in the form (React would empty it after the save)
    await expect(page.getByLabel("Birth date")).toHaveValue("1990-08-15");
    await expect(page.getByLabel("Latitude")).toHaveValue("18.9756");

    await page.reload();
    await expect(page.getByLabel("Birth date")).toHaveValue("1990-08-15");
    await expect(page.getByLabel("Birth time")).toHaveValue("14:30");
    await expect(page.getByLabel("Latitude")).toHaveValue("18.9756");
    await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Kolkata");
  });

  test("an unknown birth time turns the time off and is saved without one", async ({ page }) => {
    await register(page);
    const form = formWith(page, "Save profile");
    await fillBirth(form, { time: null });
    await expect(page.getByLabel("Birth time")).toBeDisabled();
    await expect(page.getByText("Not needed: the time is unknown.")).toBeVisible();
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(page.locator(".ac-glance")).toContainText(/^Saved profile\s*15 Aug 1990\s*Open/);
    await expect(page.locator(".ac-glance")).not.toContainText("14:30");
    await expect(page.getByLabel("Time confidence")).toHaveValue("UNKNOWN");
    await page.reload();
    await expect(page.getByLabel("Time confidence")).toHaveValue("UNKNOWN");
    await expect(page.getByLabel("Birth time")).toBeDisabled();
  });

  test("a save that fails says so, keeps what was typed, and does not claim it saved", async ({ page }) => {
    await register(page);
    const form = formWith(page, "Save profile");
    await fillBirth(form);
    await page.context().clearCookies(); // the session has ended behind the page's back
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your session has expired" })).toBeVisible();
    await expect(page.locator("#birth").getByRole("status")).toHaveText("");
    await expect(page.getByLabel("Birth date")).toHaveValue("1990-08-15"); // nothing typed is lost
    await expect(page.getByLabel("Latitude")).toHaveValue("18.9756");
    await expect(page.locator(".ac-glance")).toContainText("None yet");
  });

  test("a wrong password keeps the email, so only the password is retyped", async ({ page }) => {
    await page.goto("/profile");
    const email = uniqueEmail();
    await logIn(page, email, "not-the-password");
    await expect(page.getByRole("alert").filter({ hasText: /email or password/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
  });

  test("preferences are saved: the depth and the themes switch", async ({ page }) => {
    await register(page);
    const section = page.locator("#preferences");
    await expect(section.getByRole("radio", { name: /Beginner/ })).toBeChecked();
    await section.getByRole("radio", { name: /Technical/ }).check();
    await section.getByRole("checkbox", { name: /Show themes/ }).uncheck();
    await section.getByRole("button", { name: "Save preferences" }).click();
    await expect(section.getByRole("status")).toHaveText("Saved");
    await expect(section).toContainText("Lahiri");

    await page.reload();
    await expect(section.getByRole("radio", { name: /Technical/ })).toBeChecked();
    await expect(section.getByRole("checkbox", { name: /Show themes/ })).not.toBeChecked();
  });

  test("Guide memory: add a note and a preference, watch the count, forget one", async ({ page }) => {
    await register(page);
    const section = page.locator("#memory");
    await expect(section).toContainText("0 of 50");
    await expect(section.getByText("Nothing remembered yet.")).toBeVisible();

    await section.getByLabel("Add a memory").fill("Works in product design");
    await section.getByRole("button", { name: "Add", exact: true }).click();
    await expect(section.getByText("Works in product design")).toBeVisible();
    await expect(section).toContainText("1 of 50");
    await expect(section.getByLabel("Add a memory")).toHaveValue(""); // ready for the next

    await section.getByLabel("Kind of memory").selectOption("preference");
    await section.getByLabel("Add a memory").fill("Prefers short answers");
    await section.getByRole("button", { name: "Add", exact: true }).click();
    await expect(section.locator(".ac-li", { hasText: "Prefers short answers" })).toContainText("Preference");
    await expect(section.locator(".ac-li", { hasText: "Works in product design" })).toContainText("Note");
    await expect(section).toContainText("2 of 50");
    await expect(section.getByRole("img", { name: "2 of 50 memories used" })).toBeVisible();

    await section.getByRole("button", { name: "Forget: Works in product design" }).click();
    await expect(section.getByText("Works in product design")).toHaveCount(0);
    await expect(section).toContainText("1 of 50");
    await expect(section.getByLabel("Add a memory")).toBeFocused(); // focus is not lost with the item
  });

  test("an empty memory is not added", async ({ page }) => {
    await register(page);
    const section = page.locator("#memory");
    await section.getByRole("button", { name: "Add", exact: true }).click();
    await expect(section.getByText("Nothing remembered yet.")).toBeVisible();
    await expect(section).toContainText("0 of 50");
  });

  test("a saved conversation can be read, then deleted", async ({ page }) => {
    await register(page);
    await page.goto("/guide");
    const guide = formWith(page, "Ask");
    await fillBirth(guide);
    await guide.getByLabel("Your question").fill("What does my Moon say about my temperament?");
    await guide.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByRole("status").getByText(/Fake guide:/)).toBeVisible();

    await page.goto("/profile");
    const section = page.locator("#conversations");
    const row = section.locator(".ac-li").first();
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: /^Read conversation:/ }).click();
    await expect(page).toHaveURL(/\/profile\/conversations\/\d+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "You" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Guide" })).toBeVisible();
    await expect(page.locator(".ac-me")).toContainText("What does my Moon say about my temperament?");
    expect(await violations(page)).toEqual([]);
    await page.getByRole("link", { name: "← Back to profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    await section.getByRole("button", { name: /^Delete conversation:/ }).first().click();
    await expect(section.locator(".ac-li")).toHaveCount(0);
    await expect(section.getByText(/No saved conversations/)).toBeVisible();
  });

  test("a conversation that is not yours, or does not exist, is not found", async ({ page }) => {
    await register(page);
    const response = await page.goto("/profile/conversations/999999");
    expect(response?.status()).toBe(404);
    const bad = await page.goto("/profile/conversations/abc");
    expect(bad?.status()).toBe(404);
  });

  test("Delete all memory asks twice, and the second press is the one that deletes", async ({ page }) => {
    await register(page);
    const memory = page.locator("#memory");
    await memory.getByLabel("Add a memory").fill("Something to forget");
    await memory.getByRole("button", { name: "Add", exact: true }).click();
    await expect(memory.getByText("Something to forget")).toBeVisible();

    const del = page.locator("#privacy").getByRole("button", { name: "Delete all memory" });
    await del.click();
    await expect(page.getByRole("button", { name: "Press again to confirm" })).toHaveCount(1);
    await expect(memory.getByText("Something to forget")).toBeVisible(); // one press changes nothing
    // if nobody presses again it goes back to how it was
    await expect(page.locator("#privacy").getByRole("button", { name: "Delete all memory" })).toBeVisible({ timeout: 6000 });
    await expect(memory.getByText("Something to forget")).toBeVisible();

    await page.locator("#privacy").getByRole("button", { name: "Delete all memory" }).click();
    await page.getByRole("button", { name: "Press again to confirm" }).click();
    await expect(memory.getByText("Something to forget")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "All Guide memory deleted." })).toBeVisible();
    await expect(memory).toContainText("0 of 50");
  });

  test("Delete all conversations is also two presses", async ({ page }) => {
    await register(page);
    await page.goto("/guide");
    const guide = formWith(page, "Ask");
    await fillBirth(guide);
    await guide.getByLabel("Your question").fill("What does my Moon say?");
    await guide.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByRole("status").getByText(/Fake guide:/)).toBeVisible();
    await page.goto("/profile");
    await expect(page.locator("#conversations .ac-li")).toHaveCount(1);

    await page.locator("#privacy").getByRole("button", { name: "Delete all conversations" }).click();
    await expect(page.locator("#conversations .ac-li")).toHaveCount(1);
    await page.getByRole("button", { name: "Press again to confirm" }).click();
    await expect(page.locator("#conversations .ac-li")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "All conversations deleted." })).toBeVisible();
  });

  for (const size of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`is accessible and within the screen on ${size.name}, with things in every section`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await register(page);
      const form = formWith(page, "Save profile");
      await fillBirth(form);
      await form.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
      await page.locator("#memory").getByLabel("Add a memory").fill("Prefers short answers");
      await page.locator("#memory").getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.locator("#memory").getByText("Prefers short answers")).toBeVisible();
      await page.waitForTimeout(800);
      expect(await violations(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("the signed-in Journal", () => {
  const write = async (page: Page, title: string, body: string) => {
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry title").fill(title);
    await page.getByLabel("Entry text").fill(body);
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByRole("button", { name: "Save entry" }).locator("..").getByRole("status")).toHaveText("Saved");
  };

  test("starts empty, says so, and a new entry carries the sky now", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await expect(page.getByText("No entries yet. Press New entry to write the first one.")).toBeVisible();
    await expect(page.getByLabel("Entry title")).toHaveCount(0);

    await page.getByRole("button", { name: "New entry" }).click();
    await expect(page.getByLabel("Entry title")).toBeFocused();
    await expect(page.getByText("The sky now")).toBeVisible();
    await expect(page.getByText(/^Moon in [A-Z][a-z]+ \(Vedic\)$/)).toBeVisible();
    await expect(page.getByText("No entries yet.")).toHaveCount(0);
    expect((await page.locator("main").innerText()).toLowerCase()).not.toContain("sample");
  });

  test("writes an entry, saves it, and finds it again", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await write(page, "A restless morning", "Felt unsettled before breakfast.");

    const list = page.locator(".ac-ent");
    await expect(list).toHaveCount(1);
    await expect(list.first()).toContainText("A restless morning");
    await expect(list.first()).toContainText("Felt unsettled before breakfast.");
    await expect(list.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("The sky now")).toHaveCount(0); // a saved entry does not claim the sky now

    await page.reload();
    await expect(page.locator(".ac-ent")).toHaveCount(1);
    await expect(page.getByLabel("Entry title")).toHaveValue("A restless morning");
    await expect(page.getByLabel("Entry text")).toHaveValue("Felt unsettled before breakfast.");
  });

  test("a title is needed, and the page says so at the title", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry text").fill("Words but no title");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ }).first()).toBeVisible();
    await expect(page.getByLabel("Entry title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Entry text")).toHaveValue("Words but no title"); // nothing typed is lost
    await expect(page.locator(".ac-ent", { hasText: "Words but no title" })).toHaveCount(0);
  });

  test("edits are kept for each entry until saved, and the list says which are unsaved", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await write(page, "First notes", "One.");
    await write(page, "Saturn questions", "Two.");
    await expect(page.locator(".ac-ent")).toHaveCount(2);

    const first = page.locator(".ac-ent", { hasText: "First notes" });
    const second = page.locator(".ac-ent", { hasText: "Saturn questions" });
    await first.click();
    await page.getByLabel("Entry text").fill("One, changed.");
    await expect(first).toContainText("Unsaved");
    await expect(second).not.toContainText("Unsaved");

    await second.click(); // moving away loses nothing
    await expect(page.getByLabel("Entry text")).toHaveValue("Two.");
    await first.click();
    await expect(page.getByLabel("Entry text")).toHaveValue("One, changed.");
    await expect(first).toContainText("Unsaved");

    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(first).not.toContainText("Unsaved");
    await expect(first).toContainText("One, changed.");
    await page.reload();
    await page.locator(".ac-ent", { hasText: "First notes" }).click();
    await expect(page.getByLabel("Entry text")).toHaveValue("One, changed.");
  });

  test("a new entry that is started and then left is kept, and can be discarded", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await write(page, "Saved one", "Body.");
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry title").fill("Half written");
    await expect(page.locator(".ac-ent", { hasText: "Half written" })).toContainText("Unsaved");

    await page.locator(".ac-ent", { hasText: "Saved one" }).click();
    await expect(page.getByLabel("Entry title")).toHaveValue("Saved one");
    await page.getByRole("button", { name: "New entry" }).click();
    await expect(page.getByLabel("Entry title")).toHaveValue("Half written");

    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.locator(".ac-ent", { hasText: "Half written" })).toHaveCount(0);
    await expect(page.locator(".ac-ent")).toHaveCount(1);
    await expect(page.getByLabel("Entry title")).toHaveValue("Saved one");
  });

  test("deleting an entry asks first: Keep cancels, Delete removes it", async ({ page }) => {
    await register(page);
    await page.goto("/journal");
    await write(page, "To be removed", "Gone soon.");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Delete this entry?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep" })).toBeFocused(); // the safe choice has focus
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByText("Delete this entry?")).toHaveCount(0);
    await expect(page.locator(".ac-ent")).toHaveCount(1);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator(".ac-ent")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Entry deleted." })).toBeVisible();
    await expect(page.getByText("No entries yet. Press New entry to write the first one.")).toBeVisible();
    await page.reload();
    await expect(page.locator(".ac-ent")).toHaveCount(0);
  });

  test("entries belong to the account that wrote them", async ({ browser }) => {
    const mine = await browser.newContext();
    const page = await mine.newPage();
    await register(page);
    await page.goto("/journal");
    await write(page, "Private", "Only mine.");
    const other = await browser.newContext();
    const stranger = await other.newPage();
    await register(stranger);
    await stranger.goto("/journal");
    await expect(stranger.getByText("No entries yet.")).toBeVisible();
    await mine.close();
    await other.close();
  });

  for (const size of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`is accessible and within the screen on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await register(page);
      await page.goto("/journal");
      await write(page, "A restless morning", "Felt unsettled before breakfast.");
      await write(page, "Saturn questions", "Reading about transits.");
      await page.waitForTimeout(800);
      expect(await violations(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.getByRole("button", { name: "New entry" }).click();
      await page.getByLabel("Entry title").fill("x");
      expect(await violations(page)).toEqual([]);
    });
  }
});
