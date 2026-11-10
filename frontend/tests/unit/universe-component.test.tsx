import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CelestialUniverse, type UniverseNatal, type UniverseSky } from "@/components/CelestialUniverse";
import { UNIVERSE_BODIES, toTropical, frameFor } from "@/lib/universe";

import { vedic } from "./fixtures";

const AYANAMSA = 24.2;

// A sky that is not the natal chart, so the two are told apart.
const sky: UniverseSky = {
  moment: "2026-11-10T06:55:00Z",
  ayanamsa: AYANAMSA,
  bodies: UNIVERSE_BODIES.map((name, index) => ({
    name,
    tropical: (index * 40 + 5) % 360,
    retrograde: name === "Saturn" || name === "Rahu",
  })),
};

const natal: UniverseNatal = {
  ayanamsa: vedic.metadata.ayanamsa_degrees,
  ascendant: toTropical(vedic.ascendant!.longitude, vedic.metadata.ayanamsa_degrees),
  bodies: vedic.placements.map((p) => ({
    name: p.graha,
    tropical: toTropical(p.longitude, vedic.metadata.ayanamsa_degrees),
    retrograde: p.retrograde,
  })),
};

const ring = (container: HTMLElement, which: "western" | "vedic") =>
  container.querySelector<HTMLElement>(`[data-ring="${which}"] > g`)!;

describe("the Celestial Universe", () => {
  it("opens on the Vedic zodiac and says what was chosen", () => {
    render(<CelestialUniverse sky={sky} />);

    const group = screen.getByRole("group", { name: "Zodiac shown" });
    expect(within(group).getByRole("button", { name: "Vedic" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "Western" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(/sidereal zodiac/i)).toBeTruthy();
  });

  it("states when the sky is from, in UTC", () => {
    render(<CelestialUniverse sky={sky} />);

    expect(screen.getByText(/As of 10 Nov 2026, 06:55 UTC/)).toBeTruthy();
  });

  it("puts every planet on the wheel, each reachable by keyboard", () => {
    render(<CelestialUniverse sky={sky} />);

    for (const name of UNIVERSE_BODIES) {
      const button = screen.getByRole("button", { name: new RegExp(`^Now: ${name}`) });
      expect(button.getAttribute("tabindex")).toBe("0");
    }
  });

  it("keeps the letters outside the buttons, hidden from assistive technology", () => {
    const { container } = render(<CelestialUniverse sky={sky} />);

    // A button's visible text must be part of its name (WCAG 2.5.3); with no
    // text inside the button there is nothing to mismatch.
    for (const button of screen.getAllByRole("button", { name: /^Now: / })) {
      expect(button.querySelectorAll("text")).toHaveLength(0);
    }
    const letters = [...container.querySelectorAll("svg text")].filter((t) =>
      UNIVERSE_BODIES.some((name) => t.textContent === name.slice(0, 2)),
    );
    expect(letters.length).toBeGreaterThanOrEqual(9);
    for (const letter of letters) expect(letter.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks retrograde bodies in their accessible names", () => {
    render(<CelestialUniverse sky={sky} />);

    expect(screen.getByRole("button", { name: /^Now: Saturn \(retrograde\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Now: Sun · / })).toBeTruthy();
  });

  describe("changing the zodiac", () => {
    const poses = (container: HTMLElement) => ({
      western: {
        opacity: ring(container, "western").style.opacity,
        transform: ring(container, "western").style.transform,
      },
      vedic: {
        opacity: ring(container, "vedic").style.opacity,
        transform: ring(container, "vedic").style.transform,
      },
    });

    it("shows one ring in Vedic and the other in Western", () => {
      const { container } = render(<CelestialUniverse sky={sky} />);

      const vedicPose = poses(container);
      expect(vedicPose.vedic.opacity).toBe("1");
      expect(vedicPose.western.opacity).toBe("0");

      fireEvent.click(screen.getByRole("button", { name: "Western" }));

      const westernPose = poses(container);
      expect(westernPose.western.opacity).toBe("1");
      expect(westernPose.vedic.opacity).toBe("0");
    });

    it("turns the ring of signs by the ayanamsa and leaves the planets alone", () => {
      const { container } = render(<CelestialUniverse sky={sky} />);
      const planetPose = () =>
        screen
          .getAllByRole("button", { name: /^Now: / })
          .map((button) => (button.closest("[style*='translateX']") as HTMLElement).style.transform);

      fireEvent.click(screen.getByRole("button", { name: "Western" }));
      const western = { ring: ring(container, "western").style.transform, planets: planetPose() };
      fireEvent.click(screen.getByRole("button", { name: "Vedic" }));
      const vedicPose = { ring: ring(container, "vedic").style.transform, planets: planetPose() };

      expect(western.ring).toBe("rotate(0deg) scale(1)");
      expect(vedicPose.ring).toBe(`rotate(${-AYANAMSA}deg) scale(1)`);
      // The planets keep their places: same angle, same radius.
      expect(vedicPose.planets).toEqual(western.planets);
    });

    it("shows both rings in Compare, the Vedic one inside, and draws the planets closer in", () => {
      const { container } = render(<CelestialUniverse sky={sky} />);
      const radius = () =>
        (screen.getAllByRole("button", { name: /^Now: / })[0].closest("[style*='translateX']") as HTMLElement).style.transform;

      fireEvent.click(screen.getByRole("button", { name: "Western" }));
      const outside = radius();
      fireEvent.click(screen.getByRole("button", { name: "Compare" }));

      expect(ring(container, "western").style.opacity).toBe("1");
      expect(ring(container, "vedic").style.opacity).toBe("1");
      expect(ring(container, "vedic").style.transform).toBe(
        `rotate(${-AYANAMSA}deg) scale(${frameFor("compare", AYANAMSA).vedic.scale})`,
      );
      expect(radius()).not.toBe(outside);
      expect(radius()).toContain(`translateX(${frameFor("compare", AYANAMSA).skyRadius}px)`);
    });

    it("keeps the sign names upright by turning each label back", () => {
      const { container } = render(<CelestialUniverse sky={sky} />);

      fireEvent.click(screen.getByRole("button", { name: "Vedic" }));

      const label = [...container.querySelectorAll<SVGTextElement>("[data-ring='vedic'] text")].find(
        (t) => t.textContent === "Mesha",
      )!;
      expect(label.style.transform).toBe(`rotate(${AYANAMSA}deg)`);
    });
  });

  describe("choosing a planet", () => {
    it("says where it is in both zodiacs, whichever is shown", () => {
      render(<CelestialUniverse sky={sky} />);

      fireEvent.click(screen.getByRole("button", { name: /^Now: Moon/ }));

      expect(screen.getByText("Moon now")).toBeTruthy();
      expect(screen.getByText(/Vedic:/)).toBeTruthy();
      expect(screen.getByText(/Western:/)).toBeTruthy();
    });

    it("works from the keyboard", () => {
      render(<CelestialUniverse sky={sky} />);

      const jupiter = screen.getByRole("button", { name: /^Now: Jupiter/ });
      fireEvent.keyDown(jupiter, { key: "Enter" });

      expect(screen.getByText("Jupiter now")).toBeTruthy();
      expect(jupiter.getAttribute("aria-pressed")).toBe("true");
    });

    it("offers to ask the Guide about it, without sending anything by itself", () => {
      render(<CelestialUniverse sky={sky} />);

      fireEvent.click(screen.getByRole("button", { name: /^Now: Saturn/ }));

      const ask = screen.getByRole("link", { name: "Ask the Guide" });
      expect(ask.getAttribute("href")).toMatch(/^\/\?q=.*Saturn.*#ask$/);
      expect(screen.getByRole("link", { name: "Explore Saturn" }).getAttribute("href")).toBe("/chart");
    });
  });

  describe("with a saved birth chart", () => {
    it("adds the natal planets and the ascendant, and says which is which", () => {
      render(<CelestialUniverse sky={sky} natal={natal} />);

      expect(screen.getByText("your birth chart")).toBeTruthy();
      expect(screen.getByText("ASC")).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Your natal Saturn/ })).toBeTruthy();
    });

    it("shows nothing of the kind without one", () => {
      render(<CelestialUniverse sky={sky} />);

      expect(screen.queryByText("your birth chart")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Your natal/ })).toBeNull();
    });

    it("omits the ascendant when the birth time is unknown", () => {
      render(<CelestialUniverse sky={sky} natal={{ ...natal, ascendant: null }} />);

      expect(screen.queryByText("ASC")).toBeNull();
      expect(screen.getByRole("button", { name: /^Your natal Saturn/ })).toBeTruthy();
    });

    it("describes a natal planet by the natal ayanamsa, not today's", () => {
      render(<CelestialUniverse sky={sky} natal={natal} />);

      fireEvent.click(screen.getByRole("button", { name: /^Your natal Saturn/ }));

      const saturn = vedic.placements.find((p) => p.graha === "Saturn")!;
      const panel = within(document.querySelector("aside")!);
      expect(panel.getByText(new RegExp(`${saturn.rashi} ${saturn.degrees_in_rashi.toFixed(1)}°`))).toBeTruthy();
    });
  });

  it("gives every position as text too", () => {
    render(<CelestialUniverse sky={sky} natal={natal} />);

    const table = screen.getByRole("region", { name: "Sky positions table" });
    for (const name of UNIVERSE_BODIES) {
      expect(within(table).getByRole("rowheader", { name: new RegExp(name) })).toBeTruthy();
    }
    expect(within(table).getByRole("columnheader", { name: "Your chart, Western" })).toBeTruthy();
  });
});
