import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { HomeHub } from "@/components/home/HomeHub";
import type { StripDashboard } from "@/lib/dashboard";
import type { HomeSky } from "@/lib/sky";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  // jsdom has no canvas or observers; the scene draws its galaxy only when it can
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => {
  cleanup();
  push.mockClear();
});

const SKY: HomeSky = {
  moment: "2026-11-20T09:05:00Z",
  ayanamsa: 24.23,
  bodies: [
    { name: "Sun", tropical: 238, retrograde: false },
    { name: "Moon", tropical: 91, retrograde: false },
    { name: "Saturn", tropical: 359, retrograde: true },
  ],
};

const DASHBOARD: StripDashboard = {
  current: { maha: "Jupiter", antar: "Saturn" },
  bar: [
    { lord: "Moon", years: 10, current: false },
    { lord: "Jupiter", years: 16, current: true },
  ],
  nowFraction: 0.4,
  sky: [{ graha: "Moon", rashi: "Karka", retrograde: false }],
  questions: ["What is Saturn doing in my chart right now?"],
};

describe("the Home hub", () => {
  it("says so, and still offers the doors, when the live sky cannot be loaded", () => {
    render(<HomeHub sky={null} homePath="/guide" strip={{ status: "anonymous" }} />);
    expect(screen.getByText(/live sky could not be loaded/i)).toBeTruthy();
    expect(screen.queryAllByRole("button", { pressed: false }).some((b) => b.className.includes("hm-orb"))).toBe(false);
    expect(screen.queryByText(/Positions as text/)).toBeNull();
    expect(screen.getByRole("link", { name: /Calculate a chart/ }).getAttribute("href")).toBe("/chart");
  });

  it("draws a button for each planet it is given, named for the planet and whether it runs backward", () => {
    render(<HomeHub sky={SKY} homePath="/guide" strip={{ status: "anonymous" }} />);
    expect(screen.getByRole("button", { name: "Sun" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saturn, retrograde" })).toBeTruthy();
    expect(screen.getByText("As of 20 Nov 2026, 09:05 UTC")).toBeTruthy();
  });

  it("builds the reading link from the chosen period, focus and depth, at the right home", () => {
    render(<HomeHub sky={SKY} homePath="/" strip={{ status: "anonymous" }} />);
    const link = () => screen.getByRole("link", { name: /Open reading/ }).getAttribute("href");
    expect(link()).toBe("/?period=weekly&depth=beginner#reading");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));
    expect(link()).toBe("/?period=daily&focus=love&depth=technical#reading");
  });

  it("will not send an empty question, and tells the visitor", () => {
    render(<HomeHub sky={SKY} homePath="/guide" strip={{ status: "anonymous" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the Guide" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/Type a question first/);
  });

  it("sends a question to the Guide form on the right page, safely encoded", () => {
    render(<HomeHub sky={SKY} homePath="/guide" strip={{ status: "anonymous" }} />);
    fireEvent.change(screen.getByLabelText("Question for the Guide"), { target: { value: "What & why? <b>" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the Guide" }));
    expect(push).toHaveBeenCalledWith("/guide?q=What+%26+why%3F+%3Cb%3E&depth=beginner#ask");
  });

  it("describes the saved-profile strip for each state", () => {
    const states = [
      [{ status: "anonymous" as const }, /Log in to see your current Dasha/],
      [{ status: "none" as const }, /Save a birth profile to see/],
      [{ status: "unavailable" as const }, /could not be loaded just now/],
      [{ status: "saved" as const, dashboard: null }, /could not be calculated just now/],
    ] as const;
    for (const [strip, text] of states) {
      render(<HomeHub sky={SKY} homePath="/guide" strip={strip} />);
      expect(within(document.getElementById("strip")!).getByText(text)).toBeTruthy();
      cleanup();
    }
  });

  it("shows a saved profile's Dasha to scale, with the current one marked", () => {
    render(<HomeHub sky={SKY} homePath="/" strip={{ status: "saved", dashboard: DASHBOARD }} />);
    const strip = within(document.getElementById("strip")!);
    expect(strip.getByText("Jupiter · Saturn")).toBeTruthy();
    expect(strip.getByRole("img", { name: "Your Mahadashas to scale: Moon, Jupiter (now)" })).toBeTruthy();
    expect(strip.getByText("NOW").getAttribute("style")).toMatch(/left: 40(\.0)?%/);
    expect(strip.getByRole("link", { name: "What is Saturn doing in my chart right now?" }).getAttribute("href")).toBe(
      "/?q=What%20is%20Saturn%20doing%20in%20my%20chart%20right%20now%3F#ask",
    );
  });
});
