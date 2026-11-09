"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import {
  BackendError,
  addMemory,
  deleteAccountData,
  deleteAllConversations,
  deleteAllMemories,
  deleteConversation,
  deleteMemory,
  getPreferences,
  savePreferences,
} from "@/lib/backend";
import { DELETE_CONFIRMATION } from "@/lib/accountConfirm";
import { clearSession, getSessionToken } from "@/lib/session";
import type { ExplanationDepth, MemoryKind } from "@/lib/types";

export type AccountFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const SESSION_EXPIRED: AccountFormState = {
  status: "error",
  message: "Your session has expired. Please log in again.",
};

function toError(error: unknown, fallback: string): AccountFormState {
  if (error instanceof BackendError) {
    return { status: "error", message: error.message };
  }
  console.error(fallback, error);
  return { status: "error", message: fallback };
}

function positiveInt(value: FormDataEntryValue | null): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Saves the default explanation depth. The calculation settings already
 * stored are read back and sent unchanged, since the backend replaces the
 * whole record. */
export async function savePreferencesAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const token = await getSessionToken();
  if (!token) return SESSION_EXPIRED;

  const depth = formData.get("depth");
  if (depth !== "beginner" && depth !== "technical") {
    return { status: "error", message: "Choose beginner or technical." };
  }

  try {
    const current = await getPreferences(token);
    await savePreferences(token, {
      explanation_depth: depth as ExplanationDepth,
      calculation_config: current.calculation_config,
      // An unticked checkbox is simply absent from the form data.
      pattern_detection: formData.get("patternDetection") === "on",
    });
  } catch (error) {
    return toError(error, "Could not save your preference. Please try again.");
  }

  refresh();
  return { status: "success" };
}

export async function addMemoryAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const token = await getSessionToken();
  if (!token) return SESSION_EXPIRED;

  const kind = formData.get("kind");
  const content = String(formData.get("content") ?? "").trim();
  if (kind !== "preference" && kind !== "note") {
    return { status: "error", message: "Choose a kind of memory." };
  }
  if (!content) {
    return { status: "error", message: "Write what you want remembered." };
  }

  try {
    await addMemory(token, kind as MemoryKind, content);
  } catch (error) {
    return toError(error, "Could not save that memory. Please try again.");
  }

  refresh();
  return { status: "success" };
}

export async function deleteMemoryAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = positiveInt(formData.get("memory_id"));
  if (!token || id === null) return;

  try {
    await deleteMemory(token, id);
  } catch (error) {
    console.error("forgetting a memory failed", error);
    return;
  }
  refresh();
}

export async function forgetAllMemoriesAction(): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;

  try {
    await deleteAllMemories(token);
  } catch (error) {
    console.error("forgetting all memories failed", error);
    return;
  }
  refresh();
}

export async function deleteConversationAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = positiveInt(formData.get("conversation_id"));
  if (!token || id === null) return;

  try {
    await deleteConversation(token, id);
  } catch (error) {
    console.error("deleting a conversation failed", error);
    return;
  }
  refresh();
}

export async function deleteAllConversationsAction(): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;

  try {
    await deleteAllConversations(token);
  } catch (error) {
    console.error("deleting all conversations failed", error);
    return;
  }
  refresh();
}

/**
 * Product spec §29: one-click delete. The backend deletes immediately, so the
 * check that someone meant it is here: the confirmation word must be typed.
 * On success the local session is cleared too, since it no longer names
 * anything.
 */
export async function deleteAccountAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const token = await getSessionToken();
  if (!token) return SESSION_EXPIRED;

  if (String(formData.get("confirmation") ?? "").trim() !== DELETE_CONFIRMATION) {
    return {
      status: "error",
      message: `Type ${DELETE_CONFIRMATION} to confirm.`,
    };
  }

  try {
    await deleteAccountData(token);
  } catch (error) {
    return toError(error, "Could not delete your data. Please try again.");
  }

  await clearSession();
  redirect("/");
}
