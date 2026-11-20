// The redesigned Home (design/Celestara Home.html): the live sky as a portal scene, a strip for
// a saved profile, and three doors. The doors only choose; the reading and Guide forms below the
// hub do the asking, and nothing is sent until their own buttons are pressed.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fillBirth, formWith, register } from "./helpers";

/**
 * Axe, on every rule. The one exception: on a day when so many planets stand together that three
 * tracks cannot keep every disc 24px from its neighbours, the target-size rule is left out (and the
 * run says so), because the sky changes daily and a test must not depend on the calendar. The
 * same information is always available in the "Positions as text" table.
 */
async function violations(page: Page) {
  const crowded = await page.locator(".hm-orb").evaluateAll((els) => {
    const c = els.map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    });
    let min = Infinity;
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) min = Math.min(min, Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]));
    return c.length > 0 && min < 24;
  });
  if (crowded) test.info().annotations.push({ type: "note", description: "crowded sky: target-size left out" });
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (crowded) builder.disableRules(["target-size"]);
  const results = await builder.analyze();
  return results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
}

/** A new account with a saved birth profile, ending on the Profile page. */
async function signInWithProfile(page: Page) {
  await register(page);
  const profile = formWith(page, "Save profile");
  await fillBirth(profile);
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
}

const orbs = (page: Page) => page.locator(".hm-orb");
/** The zodiac switch beside the text (the doorway has its own, inside the chart). */
const zodiac = (page: Page) => page.locator(".hm-seg").first();

/** The centre of an element on the page. */
async function centre(page: Page, name: string) {
  const box = await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test.describe("the hub", () => {
  test("wears the design's header; signed out, Home is the guide", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { level: 1, name: "Your celestial universe" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".cx")).toHaveCount(1);
    await expect(page.locator("canvas.cx-sky")).toHaveCount(1);
  });

  test("shows the sky as it is now, with nothing marked as a sample", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByText(/As of \d{1,2} \w{3} \d{4}, \d\d:\d\d UTC/)).toBeVisible();
    await expect(orbs(page)).toHaveCount(9);
    for (const name of ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${name}`) }).first()).toBeVisible();
    }
    const text = (await page.locator(".hm").innerText()).toLowerCase();
    expect(text).not.toContain("sample");
    expect(text).not.toContain("prototype");
  });

  test("names a chosen planet's sign in each zodiac, and every position is also given as text", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.locator(".hm-pinfo")).toContainText("Choose a planet on the arc");
    await page.getByRole("button", { name: /^Saturn/ }).click();
    await expect(page.locator(".hm-pinfo")).toContainText("Saturn");
    await expect(page.locator(".hm-pinfo")).toContainText("sidereal");
    await expect(page.getByRole("button", { name: /^Saturn/ })).toHaveAttribute("aria-pressed", "true");
    await zodiac(page).getByRole("button", { name: "Western" }).click();
    await expect(page.locator(".hm-pinfo")).toContainText("tropical");
    await expect(page.locator(".hm-pinfo")).not.toContainText("sidereal");
    await page.getByRole("button", { name: /^Saturn/ }).click(); // pressing it again lets go
    await expect(page.locator(".hm-pinfo")).toContainText("Choose a planet on the arc");

    await page.getByText("Positions as text").click();
    const rows = page.locator(".hm details tbody tr");
    await expect(rows).toHaveCount(9);
    const saturn = rows.filter({ hasText: "Saturn" }).locator("td");
    await expect(saturn).toHaveCount(3); // graha, Western sign, Vedic sign
    for (const cell of await saturn.all()) await expect(cell).not.toBeEmpty();
  });

  test("the planets hold still while the signs turn around them", async ({ page }) => {
    await page.goto("/guide");
    const label = (name: string) =>
      page.locator(".hm-ringitem", { has: page.getByText(name, { exact: true }) }).first();
    const opacity = async (name: string) => Number(await label(name).evaluate((el) => getComputedStyle(el).opacity));
    const settle = () => page.waitForTimeout(1100); // the turn takes under a second

    await expect(zodiac(page).getByRole("button", { name: "Vedic" })).toHaveAttribute("aria-pressed", "true");
    const vedic = await centre(page, "Saturn");
    expect([await opacity("Mesha"), await opacity("Aries")]).toEqual([1, 0]);

    await zodiac(page).getByRole("button", { name: "Western" }).click();
    await settle();
    const western = await centre(page, "Saturn");
    expect([await opacity("Mesha"), await opacity("Aries")]).toEqual([0, 1]);
    expect(Math.abs(western.x - vedic.x)).toBeLessThan(0.5);
    expect(Math.abs(western.y - vedic.y)).toBeLessThan(0.5);

    await zodiac(page).getByRole("button", { name: "Compare" }).click();
    await settle();
    const compare = await centre(page, "Saturn");
    expect([await opacity("Mesha"), await opacity("Aries")]).toEqual([1, 1]);
    expect(Math.abs(compare.x - vedic.x)).toBeLessThan(0.5);
    expect(Math.abs(compare.y - vedic.y)).toBeLessThan(0.5);
  });

  test("the scene's toggles and the switch beside the text are one control", async ({ page }) => {
    await page.goto("/guide");
    await zodiac(page).getByRole("button", { name: "Western" }).click();
    await expect(page.getByRole("button", { name: "Western zodiac" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Vedic zodiac" })).toHaveAttribute("aria-pressed", "false");
    await zodiac(page).getByRole("button", { name: "Compare" }).click();
    await expect(page.getByRole("button", { name: "Compare both zodiacs" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".hm-zinfo")).toContainText("Both zodiacs at once");
  });

  test("no two planets cover each other, however close they stand in the sky", async ({ page }) => {
    await page.goto("/guide");
    const boxes = await orbs(page).evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
    );
    expect(boxes).toHaveLength(9);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const distance = Math.hypot(boxes[i].x - boxes[j].x, boxes[i].y - boxes[j].y);
        expect(distance, `planet ${i} and ${j}`).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test("the planets are pictures of planets, each from its own file", async ({ page }) => {
    const seen = new Map<string, number>();
    page.on("response", (r) => {
      const m = /\/grahas\/(\w+)\.webp$/.exec(r.url());
      if (m) seen.set(m[1], r.status());
    });
    await page.goto("/guide");
    await expect.poll(() => seen.size).toBe(9);
    expect(Object.fromEntries(seen)).toEqual({
      sun: 200, moon: 200, mars: 200, mercury: 200, jupiter: 200, venus: 200, saturn: 200, rahu: 200, ketu: 200,
    });
    // Every disc on the arc shows one of them, and each is a different picture
    const pictures = await orbs(page).evaluateAll((els) =>
      els.map((el) => /\/grahas\/(\w+)\.webp/.exec(getComputedStyle(el.querySelector("i")!).backgroundImage)?.[1]),
    );
    expect(new Set(pictures).size).toBe(9);
    expect(pictures).not.toContain(undefined);
    // and hovering names it, since a picture has no letters on it
    await expect(page.getByRole("button", { name: /^Saturn/ })).toHaveAttribute("title", /Saturn/);
  });

  test("the scene melts into the sky at every edge: no rectangle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 }); // tall enough to hold the whole scene
    await page.goto("/guide");
    await page.waitForTimeout(1500);

    // How bright a strip of the page is, measured on the real pixels of a screenshot
    const brightness = async (clip: { x: number; y: number; width: number; height: number }) => {
      const png = (await page.screenshot({ clip })).toString("base64");
      return page.evaluate(async (data) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
        return sum / (px.length / 4);
      }, png);
    };
    const box = (await page.locator(".hm-scene").boundingBox())!;
    const bar = 6;
    // For each side, a strip just inside the scene against one just outside it
    const middleY = box.y + box.height * 0.42;
    const middleX = box.x + box.width * 0.3;
    const strips = {
      left: [{ x: box.x + 1, y: middleY, width: bar, height: 200 }, { x: box.x - bar - 1, y: middleY, width: bar, height: 200 }],
      right: [{ x: box.x + box.width - bar - 1, y: middleY, width: bar, height: 200 }, { x: box.x + box.width + 1, y: middleY, width: bar, height: 200 }],
      top: [{ x: middleX, y: box.y + 1, width: 200, height: bar }, { x: middleX, y: box.y - bar - 1, width: 200, height: bar }],
    } as const;
    for (const [side, [inside, outside]] of Object.entries(strips)) {
      const a = await brightness(inside);
      const b = await brightness(outside);
      expect(Math.abs(a - b), `${side}: ${a.toFixed(1)} inside vs ${b.toFixed(1)} outside`).toBeLessThan(10);
    }
    // the bottom of the steps, at the scene's lower edge
    const below = await brightness({ x: box.x + box.width * 0.3, y: box.y + box.height - bar - 1, width: 200, height: bar });
    const beyond = await brightness({ x: box.x + box.width * 0.3, y: box.y + box.height + 1, width: 200, height: bar });
    expect(Math.abs(below - beyond), `bottom: ${below.toFixed(1)} vs ${beyond.toFixed(1)}`).toBeLessThan(10);
  });

  test("the planets and controls are never faded, only the painted background", async ({ page }) => {
    await page.goto("/guide");
    const opacities = await orbs(page).evaluateAll((els) =>
      els.map((el) => {
        let node: Element | null = el;
        let faded = false;
        while (node && !node.classList.contains("hm-scene")) {
          if (getComputedStyle(node).maskImage !== "none") faded = true;
          node = node.parentElement;
        }
        return faded;
      }),
    );
    expect(opacities).toEqual(new Array(9).fill(false));
    const fadedGroups = await page.locator(".hm-fade").evaluateAll((els) => els.map((el) => getComputedStyle(el).maskImage));
    expect(fadedGroups).toHaveLength(2);
    for (const mask of fadedGroups) expect(mask).toContain("linear-gradient");
  });

  test("a chosen planet's label stays inside the scene and does not cover the planet", async ({ page }) => {
    await page.goto("/guide");
    const scene = (await page.locator(".hm-scene").boundingBox())!;
    for (let i = 0; i < 9; i++) {
      await orbs(page).nth(i).click();
      const tip = (await page.locator(".hm-tip.hm-on").boundingBox())!;
      const planet = (await orbs(page).nth(i).locator("i").boundingBox())!;
      const label = await orbs(page).nth(i).getAttribute("aria-label");
      expect(tip.x, `${label} tooltip left`).toBeGreaterThanOrEqual(scene.x);
      expect(tip.x + tip.width, `${label} tooltip right`).toBeLessThanOrEqual(scene.x + scene.width);
      const cx = planet.x + planet.width / 2;
      const cy = planet.y + planet.height / 2;
      const covers = cx > tip.x && cx < tip.x + tip.width && cy > tip.y && cy < tip.y + tip.height;
      expect(covers, `${label} tooltip covers its planet`).toBe(false);
    }
  });

  test("its painted layers load", async ({ page }) => {
    const seen = new Map<string, number>();
    page.on("response", (r) => {
      const m = /\/home\/(\w+)\.webp$/.exec(r.url());
      if (m) seen.set(m[1], r.status());
    });
    await page.goto("/guide");
    await expect.poll(() => seen.size).toBe(3);
    expect(Object.fromEntries(seen)).toEqual({ stars: 200, planet: 200, clouds: 200 });
  });
});

test.describe("the doors", () => {
  test("the birth chart door leads to the chart page", async ({ page }) => {
    await page.goto("/guide");
    await page.getByRole("link", { name: /Calculate a chart/ }).click();
    await expect(page).toHaveURL(/\/chart$/);
  });

  test("the doorway steps into the chart, and the way back out returns to the scene", async ({ page }) => {
    await page.goto("/guide");
    await page.getByRole("link", { name: "Step through the doorway to your chart" }).click({ force: true });
    await expect(page.getByRole("button", { name: /Step back out/ })).toBeVisible();
    await expect(page).not.toHaveURL(/#start/); // it travels, it does not jump down the page
    await page.getByRole("button", { name: /Step back out/ }).click();
    await expect(page.getByRole("link", { name: "Step through the doorway to your chart" })).toBeVisible();
  });

  test("Read the sky chooses a period and focus, then lands on the reading form filled in", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await page.goto("/guide");
    await expect(page.getByRole("button", { name: "This week", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "This month", exact: true }).click();
    await page.getByRole("button", { name: "Career", exact: true }).click();
    const open = page.getByRole("link", { name: /Open reading/ });
    await expect(open).toHaveAttribute("href", /period=monthly/);
    await expect(open).toHaveAttribute("href", /focus=career/);
    await open.click();

    await expect(page).toHaveURL(/period=monthly.*focus=career.*#reading/);
    const reading = page.locator("#reading");
    await expect(reading.getByLabel("This month")).toBeChecked();
    await expect(reading.getByLabel("Focus")).toHaveValue("career");
    expect(posts).toEqual([]); // nothing was sent
    await expect(reading.getByText("Reading the sky")).toHaveCount(0);
  });

  test("a mangled address pre-fills nothing and breaks nothing", async ({ page }) => {
    await page.goto("/guide?period=bogus&focus=%3Cscript%3E&depth=evil&q=" + "x".repeat(500));
    const reading = page.locator("#reading");
    await expect(reading.getByLabel("Today")).toBeChecked();
    await expect(reading.getByLabel("Focus")).toHaveValue("");
    await expect(page.locator("#ask").getByLabel("Your question")).toHaveValue("x".repeat(300)); // clamped, as before
  });

  test("Ask the Guide takes a question to the Guide form, and sends nothing", async ({ page }) => {
    const posts: string[] = [];
    await page.goto("/guide");
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));

    const door = page.locator(".hm-door", { hasText: "Ask the Guide" });
    await door.getByRole("button", { name: "Ask the Guide" }).click(); // empty
    await expect(door.getByRole("alert")).toContainText("Type a question first");
    await expect(door.getByLabel("Question for the Guide")).toBeFocused();
    expect(page.url()).not.toContain("?q=");

    await door.getByRole("button", { name: "Technical" }).click();
    await door.getByLabel("Question for the Guide").fill("What is Saturn doing right now?");
    await expect(door.getByRole("alert")).toHaveCount(0); // typing clears it
    await door.getByRole("button", { name: "Ask the Guide" }).click();

    await expect(page).toHaveURL(/\?q=What\+is\+Saturn\+doing\+right\+now%3F&depth=technical#ask/);
    const ask = page.locator("#ask");
    await expect(ask.getByLabel("Your question")).toHaveValue("What is Saturn doing right now?");
    await expect(ask.getByLabel("Explanation")).toHaveValue("technical");
    expect(posts).toEqual([]);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("the Guide form lower down is still the only thing that asks", async ({ page }) => {
    await page.goto("/guide?q=What%20does%20my%20Moon%20say%3F");
    const guide = formWith(page, "Ask");
    await expect(guide.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toHaveCount(1); // the door's has its own name
  });
});

test.describe("the saved-profile strip", () => {
  test("invites a signed-out visitor to log in", async ({ page }) => {
    await page.goto("/guide");
    const strip = page.locator("#strip");
    await expect(strip).toContainText("Log in to see your current Dasha");
    await expect(strip.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/profile");
  });

  test("invites a signed-in visitor without a profile to save one", async ({ page }) => {
    await register(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your celestial universe" })).toBeVisible();
    await expect(page.locator("#strip")).toContainText("Save a birth profile");
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
  });

  test("shows the current Dasha, the sky now and questions from the chart", async ({ page }) => {
    await signInWithProfile(page);
    await page.goto("/");
    const strip = page.locator("#strip");
    await expect(strip.getByRole("heading", { name: "Current Dasha" })).toBeVisible();
    await expect(strip.locator(".hm-dashalords")).toContainText(/\w+ · \w+/);
    await expect(strip.getByRole("img", { name: /Your Mahadashas to scale: .*\(now\)/ })).toBeVisible();
    await expect(strip.locator(".hm-dbar em")).toHaveText("NOW");

    const sky = strip.locator("table");
    for (const graha of ["Moon", "Jupiter", "Saturn"]) await expect(sky).toContainText(graha);
    await expect(strip.getByRole("link", { name: /All transits on the Birth Chart page/ })).toHaveAttribute("href", "/chart");

    // a suggested question fills the Guide box and sends nothing
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await strip.getByRole("link", { name: /Saturn moving through/ }).click();
    await expect(page).toHaveURL(/\/\?q=.*Saturn.*#ask/);
    await expect(page.locator("#ask").getByLabel("Your question")).toHaveValue(/Saturn moving through/);
    expect(posts).toEqual([]);
  });

  test("the forms below start from the saved profile", async ({ page }) => {
    await signInWithProfile(page);
    await page.goto("/");
    await expect(page.locator("#reading").getByLabel("Birth date")).toHaveValue("1990-08-15");
    await expect(page.locator("#ask").getByLabel("Latitude")).toHaveValue("18.9756");
  });
});

test.describe("motion and small screens", () => {
  test.describe("when the visitor asks for reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the signs change zodiac without turning, and the scene does not follow the pointer", async ({ page }) => {
      await page.goto("/guide");
      const durations = await page
        .locator(".hm-ringitem")
        .evaluateAll((els) => els.map((el) => Number.parseFloat(getComputedStyle(el).transitionDuration)));
      expect(durations.length).toBe(48);
      for (const d of durations) expect(d).toBeLessThan(0.01);

      const layer = page.locator(".hm-lay[aria-hidden]").first();
      const before = await layer.evaluate((el) => (el as HTMLElement).style.transform);
      await page.locator(".hm-scene").hover({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(400);
      expect(await layer.evaluate((el) => (el as HTMLElement).style.transform)).toBe(before);
    });
  });

  test("the signs turn over most of a second by default, and the scene drifts with the pointer", async ({ page }) => {
    await page.goto("/guide");
    const duration = await page
      .locator(".hm-ringitem")
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration));
    expect(duration).toBeGreaterThan(0.5);

    const layer = page.locator(".hm-lay[aria-hidden]").first();
    const before = await layer.evaluate((el) => (el as HTMLElement).style.transform);
    await page.locator(".hm-scene").hover({ position: { x: 40, y: 40 } });
    await expect.poll(() => layer.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  });

  for (const width of [360, 390, 768]) {
    test(`fits a ${width}px screen, with the scene first and planets still reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/guide");
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      const scene = await page.locator(".hm-scene").boundingBox();
      const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
      expect(scene!.y).toBeLessThan(heading!.y); // on a narrow screen the scene comes first
      expect(scene!.width).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: /^Saturn/ }).click();
      await expect(page.locator(".hm-pinfo")).toContainText("Saturn");
      await page.locator("#start").scrollIntoViewIfNeeded();
      expect(await overflow()).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("accessibility (axe)", () => {
  for (const size of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    for (const mode of ["Vedic", "Western", "Compare"]) {
      test(`${mode}, with a planet chosen, on ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto("/guide");
        await zodiac(page).getByRole("button", { name: mode }).click();
        await page.getByRole("button", { name: /^Saturn/ }).click();
        await page.waitForTimeout(1200);
        expect(await violations(page)).toEqual([]);
      });
    }

    test(`the doors and the forms below, on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/guide?q=Hello&period=weekly");
      await page.getByText("Positions as text").click();
      await page.getByRole("button", { name: "Ask the Guide" }).click(); // shows the error state too
      await expect(page.getByText("Type a question first")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test(`the saved-profile strip, on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await signInWithProfile(page);
      await page.goto("/");
      await expect(page.locator("#strip").getByRole("heading", { name: "Current Dasha" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
});
