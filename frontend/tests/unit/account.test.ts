import { describe, expect, it } from "vitest";

import {
  MAX_MEMORIES,
  NEW_ENTRY,
  birthGlance,
  calculationSummary,
  checkCredentials,
  chooseEntry,
  hasErrors,
  isDirty,
  memoryMeter,
  shortDate,
  shownDraft,
  withDraft,
  withoutDraft,
} from "@/lib/account";

describe("how a saved date reads", () => {
  it("writes the day as saved, whatever the reader's timezone", () => {
    expect(shortDate("2026-11-19T00:30:00Z")).toBe("19 Nov 2026");
    expect(shortDate("2026-11-19T23:59:59Z")).toBe("19 Nov 2026");
    expect(shortDate("2027-01-01T00:00:00Z")).toBe("1 Jan 2027");
  });

  it("says nothing for a date it cannot read", () => {
    expect(shortDate("not a date")).toBe("");
  });

  it("gives the birth date and time without ever moving the day", () => {
    expect(birthGlance({ birth_date: "1990-08-15", birth_time: "14:30:00", time_confidence: "EXACT" })).toBe("15 Aug 1990, 14:30");
    expect(birthGlance({ birth_date: "1990-08-15", birth_time: "14:30:00", time_confidence: "ESTIMATED" })).toBe("15 Aug 1990, 14:30");
    expect(birthGlance({ birth_date: "2000-01-01", birth_time: "00:05:00", time_confidence: "EXACT" })).toBe("1 Jan 2000, 00:05");
  });

  it("leaves the time out when it is unknown", () => {
    expect(birthGlance({ birth_date: "1990-08-15", birth_time: null, time_confidence: "UNKNOWN" })).toBe("15 Aug 1990");
    expect(birthGlance({ birth_date: "1990-08-15", birth_time: "14:30:00", time_confidence: "UNKNOWN" })).toBe("15 Aug 1990");
  });
});

describe("the Guide's memory meter", () => {
  it("counts out of the real limit", () => {
    expect(MAX_MEMORIES).toBe(50);
    expect(memoryMeter(3)).toEqual({ label: "3 of 50", percent: 6, full: false });
    expect(memoryMeter(0).percent).toBe(0);
  });

  it("is full at the limit and never overflows the bar", () => {
    expect(memoryMeter(50)).toMatchObject({ percent: 100, full: true });
    expect(memoryMeter(70).percent).toBe(100);
  });
});

describe("what a sign-in may be told before it is sent", () => {
  it("asks for what is missing", () => {
    expect(checkCredentials("", "", "login")).toEqual({ email: "Enter your email.", password: "Enter your password." });
  });

  it("catches an email that is the wrong shape, however it is spaced", () => {
    for (const bad of ["me", "me@", "me@example", "@example.com", "m e@example.com"]) {
      expect(checkCredentials(bad, "x", "login").email, bad).toMatch(/does not look right/);
    }
    expect(checkCredentials("  me@example.com ", "x", "login").email).toBe("");
  });

  it("asks a new account for a long enough password, but not a returning one", () => {
    expect(checkCredentials("a@b.co", "short", "register").password).toBe("Use at least 8 characters.");
    expect(checkCredentials("a@b.co", "short", "login").password).toBe("");
    expect(checkCredentials("a@b.co", "12345678", "register").password).toBe("");
    expect(checkCredentials("a@b.co", "1234567", "register").password).not.toBe("");
  });

  it("knows when there is nothing to fix", () => {
    expect(hasErrors(checkCredentials("a@b.co", "long enough", "register"))).toBe(false);
    expect(hasErrors(checkCredentials("a@b.co", "", "login"))).toBe(true);
  });
});

describe("journal drafts", () => {
  const entry = { id: 7, title: "Saturn questions", body: "Reading about transits." };

  it("shows what is saved until something is changed", () => {
    expect(shownDraft(entry, {})).toEqual({ title: "Saturn questions", body: "Reading about transits." });
    expect(isDirty(entry, {})).toBe(false);
  });

  it("keeps an edit for each entry, so switching between them loses nothing", () => {
    let drafts = withDraft({}, entry, { title: "Saturn questions", body: "More." });
    drafts = withDraft(drafts, { id: 8, title: "b", body: "b" }, { title: "b2", body: "b" });
    expect(isDirty(entry, drafts)).toBe(true);
    expect(isDirty({ id: 8, title: "b", body: "b" }, drafts)).toBe(true);
    expect(shownDraft(entry, drafts).body).toBe("More.");
  });

  it("is not dirty once an edit is put back as it was", () => {
    const edited = withDraft({}, entry, { title: "x", body: entry.body });
    expect(isDirty(entry, edited)).toBe(true);
    const restored = withDraft(edited, entry, { title: entry.title, body: entry.body });
    expect(isDirty(entry, restored)).toBe(false);
    expect(restored[entry.id]).toBeUndefined();
  });

  it("treats a new entry as unsaved only once something is written in it", () => {
    expect(isDirty(undefined, {})).toBe(false);
    expect(isDirty(undefined, withDraft({}, undefined, { title: "  ", body: "" }))).toBe(false);
    expect(isDirty(undefined, withDraft({}, undefined, { title: "Hello", body: "" }))).toBe(true);
    expect(shownDraft(undefined, {})).toEqual({ title: "", body: "" });
  });

  it("drops a draft once it is saved or abandoned, leaving the others", () => {
    const drafts = withDraft(withDraft({}, entry, { title: "a", body: "b" }), undefined, { title: "n", body: "" });
    const rest = withoutDraft(drafts, entry.id);
    expect(rest[entry.id]).toBeUndefined();
    expect(rest[NEW_ENTRY]).toBeDefined();
    expect(withoutDraft({}, 3)).toEqual({});
  });

  it("does not change the drafts it was given", () => {
    const drafts = Object.freeze({ 1: { title: "t", body: "b" } });
    expect(() => withDraft(drafts, { id: 1, title: "t", body: "b" }, { title: "t", body: "b" })).not.toThrow();
    expect(() => withoutDraft(drafts, 1)).not.toThrow();
    expect(drafts[1]).toBeDefined();
  });

  it("chooses an entry to show after the list changes", () => {
    const list = [{ id: 3 }, { id: 2 }, { id: 1 }];
    expect(chooseEntry(list, 2)).toBe(2);
    expect(chooseEntry(list, 99)).toBe(3);
    expect(chooseEntry(list, null)).toBe(3);
    expect(chooseEntry([], 2)).toBeNull();
  });
});

describe("what the saved calculation settings say", () => {
  it("uses the defaults when nothing is saved", () => {
    expect(calculationSummary(null)).toEqual({ ayanamsa: "Lahiri", houses: "Whole sign" });
    expect(calculationSummary({})).toEqual({ ayanamsa: "Lahiri", houses: "Whole sign" });
  });

  it("reads what is saved, in words", () => {
    expect(calculationSummary({ ayanamsa: "RAMAN", house_system: "equal_house" })).toEqual({ ayanamsa: "Raman", houses: "Equal house" });
  });

  it("ignores values that are not text", () => {
    expect(calculationSummary({ ayanamsa: 5, house_system: null })).toEqual({ ayanamsa: "Lahiri", houses: "Whole sign" });
  });
});
