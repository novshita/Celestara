"use server";

import { withOptionalSession } from "@/lib/aiSession";
import { askAiGuide, BackendError } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import type {
  AiIntent,
  AiSystem,
  AnswerFactors,
  ExplanationDepth,
  SafetyFlag,
} from "@/lib/types";

const DEPTHS: readonly ExplanationDepth[] = ["beginner", "technical"];

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
      depth: ExplanationDepth;
      /** The saved conversation to continue with the next question, or
       * `null` when this exchange was not saved. */
      conversationId: number | null;
      factors: AnswerFactors;
      /** True when the visitor's session had expired: they were logged out
       * and this answer was given anonymously (so it was not saved). */
      sessionExpired: boolean;
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

  // "" means "use my saved default"; anything unrecognised is dropped, not
  // forwarded for the backend to reject.
  const rawDepth = formData.get("depth");
  const depth = DEPTHS.includes(rawDepth as ExplanationDepth)
    ? (rawDepth as ExplanationDepth)
    : undefined;
  const rawConversation = Number.parseInt(
    (formData.get("conversation_id") as string) ?? "",
    10,
  );
  const conversationId =
    Number.isInteger(rawConversation) && rawConversation > 0
      ? rawConversation
      : undefined;

  try {
    const { result, sessionExpired } = await withOptionalSession((token) =>
      askAiGuide(birth, system, question, { depth, conversationId, token }),
    );
    return {
      status: "success",
      answer: result.answer,
      systemUsed: result.system_used,
      model: result.model,
      intent: result.intent,
      notice: result.notice,
      safetyFlags: result.safety_flags,
      depth: result.depth,
      conversationId: result.conversation_id,
      factors: result.factors,
      sessionExpired,
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
