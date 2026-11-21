// Small pure pieces behind the Profile and Journal pages: how a saved date reads, how full the
// Guide's memory is, what a sign-in form may be told before it is sent, and which journal entries
// have changes that are not saved yet. Pure, so each can be tested without a browser.

import type { BirthData, BirthTimeConfidence, JournalEntry } from "@/lib/types";

/** The most the Guide will keep for one person (the backend enforces the same number). */
export const MAX_MEMORIES = 50;

/** The shortest password the backend accepts. */
export const MIN_PASSWORD_LENGTH = 8;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `19 Nov 2026`, from an ISO date or timestamp. Read in UTC so the server and the browser agree
 * (the page would otherwise render one day on the server and another on a phone in another zone). */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `15 Aug 1990, 14:30` for the saved profile's glance box. Taken from the text as saved, never
 * through a Date, so no timezone can move the day. */
export function birthGlance(birth: Pick<BirthData, "birth_date" | "birth_time" | "time_confidence">): string {
  const [year, month, day] = birth.birth_date.split("-").map(Number);
  if (!year || !month || !day) return birth.birth_date;
  const date = `${day} ${MONTHS[month - 1]} ${year}`;
  if (birth.time_confidence === "UNKNOWN" || !birth.birth_time) return date;
  return `${date}, ${birth.birth_time.slice(0, 5)}`;
}

export const TIME_CONFIDENCE_LABELS: Record<BirthTimeConfidence, string> = {
  EXACT: "Exact",
  ESTIMATED: "Approximate",
  UNKNOWN: "Unknown",
};

export interface MemoryMeter {
  label: string;
  percent: number;
  full: boolean;
}

/** `3 of 50` and how much of the bar it fills. */
export function memoryMeter(count: number): MemoryMeter {
  const clamped = Math.max(0, Math.min(count, MAX_MEMORIES));
  return { label: `${count} of ${MAX_MEMORIES}`, percent: (clamped / MAX_MEMORIES) * 100, full: count >= MAX_MEMORIES };
}

export type AuthMode = "login" | "register";

export interface CredentialErrors {
  email: string;
  password: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What can be said about a sign-in before it is sent. Empty strings mean nothing to say. The
 * server stays the judge of whether the account exists; this only catches what a person can fix
 * at once. */
export function checkCredentials(email: string, password: string, mode: AuthMode): CredentialErrors {
  const trimmed = email.trim();
  return {
    email: !trimmed
      ? "Enter your email."
      : !EMAIL_SHAPE.test(trimmed)
        ? "That email does not look right. Check for a missing @ or dot."
        : "",
    password: !password
      ? "Enter your password."
      : mode === "register" && password.length < MIN_PASSWORD_LENGTH
        ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
        : "",
  };
}

export const hasErrors = (errors: CredentialErrors): boolean => Boolean(errors.email || errors.password);

// ---- the journal --------------------------------------------------------------------------

export interface Draft {
  title: string;
  body: string;
}

/** Edits not saved yet, by entry id; `0` is the new entry that has no id until it is saved. */
export type Drafts = Readonly<Record<number, Draft>>;

export const NEW_ENTRY = 0;

/** What the editor shows for an entry: the unsaved edits if there are any, else what was saved. */
export function shownDraft(entry: Pick<JournalEntry, "id" | "title" | "body"> | undefined, drafts: Drafts): Draft {
  if (!entry) return drafts[NEW_ENTRY] ?? { title: "", body: "" };
  return drafts[entry.id] ?? { title: entry.title, body: entry.body };
}

/** Does an entry have edits that differ from what is saved? */
export function isDirty(entry: Pick<JournalEntry, "id" | "title" | "body"> | undefined, drafts: Drafts): boolean {
  const draft = entry ? drafts[entry.id] : drafts[NEW_ENTRY];
  if (!draft) return false;
  if (!entry) return draft.title.trim() !== "" || draft.body.trim() !== "";
  return draft.title !== entry.title || draft.body !== entry.body;
}

/** The drafts with one entry's edits set, or dropped when they match what is saved. */
export function withDraft(
  drafts: Drafts,
  entry: Pick<JournalEntry, "id" | "title" | "body"> | undefined,
  draft: Draft,
): Drafts {
  const id = entry ? entry.id : NEW_ENTRY;
  const next = { ...drafts, [id]: draft };
  if (!isDirty(entry, next)) delete next[id];
  return next;
}

export function withoutDraft(drafts: Drafts, id: number): Drafts {
  const next = { ...drafts };
  delete next[id];
  return next;
}

/** Which entry to show after the list changes: the one chosen if it is still there, else the first. */
export function chooseEntry(entries: readonly Pick<JournalEntry, "id">[], wanted: number | null): number | null {
  if (wanted !== null && entries.some((entry) => entry.id === wanted)) return wanted;
  return entries[0]?.id ?? null;
}

// ---- what the saved calculation settings say -----------------------------------------------

const prettify = (value: unknown, fallback: string): string => {
  if (typeof value !== "string" || !value) return fallback;
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The two settings the Profile page tells a person about. A person with no saved settings gets the
 * backend's defaults (Lahiri, whole-sign houses), which is what their charts use. */
export function calculationSummary(config: Record<string, unknown> | null): { ayanamsa: string; houses: string } {
  return {
    ayanamsa: prettify(config?.["ayanamsa"], "Lahiri"),
    houses: prettify(config?.["house_system"], "Whole sign"),
  };
}
