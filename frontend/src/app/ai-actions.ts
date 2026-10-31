"use server";

import { askAiGuide, BackendError } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import type { AiIntent, AiSystem, SafetyFlag } from "@/lib/types";

export type AiChatFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "success";
      answer: string;
      systemUsed: AiSystem;
      /** `null` when the answer was fixed text that never reached the model. */
      model: string | null;
      intent: AiIntent;
      notice: string | null;
      safetyFlags: SafetyFlag[];
    };

/**
 * Server Action backing the AI Guide form. Same shape as `submitBirthData`
 * (`app/actions.ts`): the browser posts birth data plus a question, this
 * function calls the backend, and only the answer or a safe error message
 * crosses back to the client.
 */
export async function askAiGuideAction(
  _previous: AiChatFormState,
  formData: FormData,
): Promise<AiChatFormState> {
  const birth = buildBirthData(formData);
  const system = formData.get("system") as AiSystem;
  const question = formData.get("question") as string;

  try {
    const { answer, system_used, model, intent, notice, safety_flags } =
      await askAiGuide(birth, system, question);
    return {
      status: "success",
      answer,
      systemUsed: system_used,
      model,
      intent,
      notice,
      safetyFlags: safety_flags,
    };
  } catch (error) {
    if (error instanceof BackendError) {
      const fieldErrors = Object.fromEntries(
        error.fieldErrors.map((entry) => [entry.field, entry.message]),
      );
      return { status: "error", message: error.message, fieldErrors };
    }
    // Not a BackendError: unreachable backend, or a shape it never
    // documents. An infrastructure concern, not something authored to show
    // a user (engineering spec §22) - logged and replaced.
    console.error("AI Guide request failed", error);
    return {
      status: "error",
      message: "Could not reach the AI Guide. Please try again.",
      fieldErrors: {},
    };
  }
}
