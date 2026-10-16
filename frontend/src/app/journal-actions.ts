"use server";

import { refresh } from "next/cache";

import {
  BackendError,
  createJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
} from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

export type JournalFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

function entryFields(formData: FormData): { title: string; body: string } {
  return {
    title: formData.get("title") as string,
    body: formData.get("body") as string,
  };
}

function toErrorState(error: unknown, fallback: string): JournalFormState {
  if (error instanceof BackendError) {
    const fieldErrors = Object.fromEntries(
      error.fieldErrors.map((entry) => [entry.field, entry.message]),
    );
    return { status: "error", message: error.message, fieldErrors };
  }
  console.error(fallback, error);
  return { status: "error", message: fallback, fieldErrors: {} };
}

async function requireToken(): Promise<string | null> {
  return (await getSessionToken()) ?? null;
}

export async function createEntryAction(
  _previous: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const token = await requireToken();
  if (!token) {
    return {
      status: "error",
      message: "Your session has expired. Please log in again.",
      fieldErrors: {},
    };
  }

  const { title, body } = entryFields(formData);

  try {
    await createJournalEntry(token, title, body);
  } catch (error) {
    return toErrorState(error, "Could not save the entry. Please try again.");
  }

  refresh();
  return { status: "success" };
}

export async function updateEntryAction(
  _previous: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const token = await requireToken();
  if (!token) {
    return {
      status: "error",
      message: "Your session has expired. Please log in again.",
      fieldErrors: {},
    };
  }

  const id = Number.parseInt(formData.get("entry_id") as string, 10);
  const { title, body } = entryFields(formData);

  try {
    await updateJournalEntry(token, id, title, body);
  } catch (error) {
    return toErrorState(error, "Could not save the changes. Please try again.");
  }

  refresh();
  return { status: "success" };
}

/**
 * Bound directly to a `<form action={deleteEntryAction}>` - no result for a
 * caller to inspect, same shape as `logoutAction`: delete, refresh, done.
 */
export async function deleteEntryAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  if (!token) {
    return;
  }

  const id = Number.parseInt(formData.get("entry_id") as string, 10);

  try {
    await deleteJournalEntry(token, id);
  } catch (error) {
    console.error("deleting the journal entry failed", error);
    return;
  }

  refresh();
}
