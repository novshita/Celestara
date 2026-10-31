import "server-only";

import { cache } from "react";

import { BackendError, getProfile } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";
import type { BirthData } from "@/lib/types";

/** What the pages know about the visitor's saved birth profile. */
export type SavedBirth =
  | { status: "anonymous" }
  | { status: "none" }
  | { status: "saved"; birth: BirthData }
  | { status: "unavailable" };

/**
 * The visitor's saved birth profile, used to pre-fill the birth forms.
 *
 * Pre-filling is a convenience, never a requirement, so nothing here may
 * break a page: a visitor who is logged out, whose session has expired, or
 * who has not saved a profile just gets empty forms, and a backend that
 * cannot be reached is logged and treated the same way.
 *
 * Wrapped in `cache` so a page that asks more than once (the note and the
 * forms) makes one backend request.
 */
export const getSavedBirth = cache(async (): Promise<SavedBirth> => {
  const token = await getSessionToken();
  if (!token) {
    return { status: "anonymous" };
  }

  try {
    const profile = await getProfile(token);
    return profile
      ? { status: "saved", birth: profile.birth }
      : { status: "none" };
  } catch (error) {
    // A stale cookie: the backend no longer knows this session.
    if (error instanceof BackendError && error.code === "AUTH_REQUIRED") {
      return { status: "anonymous" };
    }
    console.error("could not load the saved profile", error);
    return { status: "unavailable" };
  }
});

/** The saved birth data if there is any, for passing to a form's `defaults`. */
export function birthDefaults(saved: SavedBirth): BirthData | undefined {
  return saved.status === "saved" ? saved.birth : undefined;
}
