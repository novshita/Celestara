import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompareVisual } from "@/components/charts/CompareVisual";
import { KundaliChart } from "@/components/charts/KundaliChart";
import { ZodiacWheel } from "@/components/charts/ZodiacWheel";
import { DashaTimeline } from "@/components/DashaTimeline";
import { PLANET_ABBR } from "@/lib/chartLabels";

import {
  comparison,
  dasha,
  vedic,
  vedicNoTime,
  western,
  westernNoTime,
} from "./fixtures";

describe("Western zodiac wheel", () => {
  it("is one image with a text equivalent naming every body", () => {
    render(<ZodiacWheel chart={western} />);

    const wheel = screen.getByRole("img", { name: /western birth chart wheel/i });
    const description = wheel.querySelector("desc")!.textContent!;
    for (const position of western.positions) {
      expect(description).toContain(position.body);
    }
    expect(description).toContain(`Ascendant ${western.angles!.ascendant_sign}`);
  });

  it("labels each body, the ascendant and the midheaven", () => {
    const { container } = render(<ZodiacWheel chart={western} />);

    const text = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    for (const position of western.positions) {
      expect(text).toContain(PLANET_ABBR[position.body]);
    }
    expect(text).toContain("ASC");
    expect(text).toContain("MC");
  });

  it("marks retrograde bodies", () => {
    const { container } = render(<ZodiacWheel chart={western} />);

    const retrograde = western.positions.filter((p) => p.retrograde).length;
    const marks = [...container.querySelectorAll("svg text")].filter(
      (t) => t.textContent === "R",
    );
    expect(marks).toHaveLength(retrograde);
  });

  it("draws one line per aspect", () => {
    const { container } = render(<ZodiacWheel chart={western} />);

    expect(container.querySelectorAll("line.chart-ring, path.chart-ring").length).toBeGreaterThan(0);
    expect(western.aspects.length).toBeGreaterThan(0);
  });

  it("without a birth time draws no houses and says why", () => {
    render(<ZodiacWheel chart={westernNoTime} />);

    expect(screen.getByText("Houses need a birth time.")).toBeTruthy();
    const wheel = screen.getByRole("img", { name: /western birth chart wheel/i });
    expect(wheel.querySelector("desc")!.textContent).toContain(
      "No houses are drawn because the birth time is unknown.",
    );
    expect(wheel.textContent).not.toContain("ASC");
  });

  it("has the legend only a known time needs left out", () => {
    render(<ZodiacWheel chart={western} />);

    expect(screen.queryByText("Houses need a birth time.")).toBeNull();
  });
});

describe("Kundali chart", () => {
  const pressed = (name: string) =>
    screen.getByRole("button", { name }).getAttribute("aria-pressed");

  it("starts as North Indian and can switch to South Indian", () => {
    render(<KundaliChart chart={vedic} />);

    expect(pressed("North Indian")).toBe("true");
    expect(pressed("South Indian")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "South Indian" }));

    expect(pressed("North Indian")).toBe("false");
    expect(pressed("South Indian")).toBe("true");
  });

  it("places every graha in the drawing", () => {
    for (const style of ["North Indian", "South Indian"]) {
      const { container, unmount } = render(<KundaliChart chart={vedic} />);
      fireEvent.click(screen.getByRole("button", { name: style }));

      const text = container.querySelector("svg")!.textContent!;
      for (const placement of vedic.placements) {
        expect(text).toContain(PLANET_ABBR[placement.graha]);
      }
      unmount();
    }
  });

  it("names its layout and points to the tables for every value", () => {
    render(<KundaliChart chart={vedic} />);

    expect(screen.getByRole("img", { name: /north indian kundali/i })).toBeTruthy();
    expect(screen.getByRole("img").querySelector("desc")!.textContent).toContain(
      "The tables below give every value.",
    );

    fireEvent.click(screen.getByRole("button", { name: "South Indian" }));

    const south = screen.getByRole("img", { name: /south indian kundali/i });
    expect(south.querySelector("desc")!.textContent).toContain(
      `The ascendant is marked in ${vedic.ascendant!.rashi}`,
    );
  });

  it("says when no ascendant is marked because the time is unknown", () => {
    render(<KundaliChart chart={vedicNoTime} />);

    expect(screen.getByRole("img").querySelector("desc")!.textContent).toContain(
      "No ascendant is marked because the birth time is unknown.",
    );
  });

  it("without a birth time offers only the South Indian layout, and says why", () => {
    render(<KundaliChart chart={vedicNoTime} />);

    expect(screen.queryByRole("button", { name: "North Indian" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Chart style" })).toBeNull();
    expect(screen.getByText(/North Indian layout needs a birth time/i)).toBeTruthy();
  });

  it("falls back to South Indian when the houses are not whole-sign", () => {
    const sripati = {
      ...vedic,
      metadata: { ...vedic.metadata, config: { house_system: "equal" } },
    };
    render(<KundaliChart chart={sripati} />);

    expect(screen.queryByRole("button", { name: "North Indian" })).toBeNull();
    expect(screen.getByRole("img", { name: /south indian kundali/i })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /north indian kundali/i })).toBeNull();
  });
});

describe("Compare view", () => {
  const views = ["Together", "Vedic", "Western"];
  const pressed = (name: string) =>
    screen.getByRole("button", { name }).getAttribute("aria-pressed");

  it("starts with both systems side by side", () => {
    render(<CompareVisual comparison={comparison} />);

    expect(pressed("Together")).toBe("true");
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it.each(views.slice(1))("shows only %s when asked, hiding the other panel", (view) => {
    render(<CompareVisual comparison={comparison} />);

    fireEvent.click(screen.getByRole("button", { name: view }));

    expect(pressed(view)).toBe("true");
    for (const other of views.filter((v) => v !== view)) {
      expect(pressed(other)).toBe("false");
    }
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(1);
  });

  it("returns to both systems", () => {
    render(<CompareVisual comparison={comparison} />);

    fireEvent.click(screen.getByRole("button", { name: "Vedic" }));
    fireEvent.click(screen.getByRole("button", { name: "Together" }));

    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });
});

describe("Dasha timeline", () => {
  it("opens on the current Mahadasha", () => {
    render(<DashaTimeline periods={dasha.periods} active={dasha.active} asOf={dasha.asOf} />);

    const maha = dasha.active.find((p) => p.level === "maha")!;
    const group = screen.getByRole("group", { name: "Mahadasha periods" });
    const pressed = within(group)
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");

    expect(pressed).toHaveLength(1);
    expect(pressed[0].getAttribute("aria-label")).toContain(`${maha.lord} Mahadasha`);
  });

  it("selects another period when chosen", () => {
    render(<DashaTimeline periods={dasha.periods} active={dasha.active} asOf={dasha.asOf} />);

    const group = screen.getByRole("group", { name: "Mahadasha periods" });
    const buttons = within(group).getAllByRole("button");
    const target = buttons.find((b) => b.getAttribute("aria-pressed") === "false")!;

    fireEvent.click(target);

    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect(buttons.filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("gives every period a full accessible name with its dates", () => {
    render(<DashaTimeline periods={dasha.periods} active={dasha.active} asOf={dasha.asOf} />);

    const group = screen.getByRole("group", { name: "Mahadasha periods" });
    for (const button of within(group).getAllByRole("button")) {
      expect(button.getAttribute("aria-label")).toMatch(/Mahadasha, .+ to .+/);
    }
  });
});
