"use server";

import { refresh } from "next/cache";

import { BackendError, saveProfile } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import { getSessionToken } from "@/lib/session";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

/**
 * Saves (creates or replaces) the current user's one birth profile. A `PUT`
 * under the hood, same as the backend route: product spec §28 allows
 * exactly one profile per account, so there is no partial-update case.
 */
export async function saveProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const token = await getSessionToken();
  if (!token) {
    // The form that calls this is only ever rendered for a logged-in user
    // (see AccountBar/ProfileSection), so reaching this means the session
    // expired mid-edit, not a reachable UI state to design error copy for.
    return {
      status: "error",
      message: "Your session has expired. Please log in again.",
      fieldErrors: {},
    };
  }

  const birth = buildBirthData(formData);

  try {
    await saveProfile(token, birth);
  } catch (error) {
    if (error instanceof BackendError) {
      const fieldErrors = Object.fromEntries(
        error.fieldErrors.map((entry) => [entry.field, entry.message]),
      );
      return { status: "error", message: error.message, fieldErrors };
    }
    console.error("saving the profile failed", error);
    return {
      status: "error",
      message: "Could not save the profile. Please try again.",
      fieldErrors: {},
    };
  }

  refresh();
  return { status: "success" };
}
