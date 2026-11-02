"use server";

import { withOptionalSession } from "@/lib/aiSession";
import { BackendError, getBirthChartReading, getReading } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import type {
  AnswerFactors,
  ExplanationDepth,
  ReadingFocus,
  ReadingKind,
  SafetyFlag,
} from "@/lib/types";

const DEPTHS: readonly ExplanationDepth[] = ["beginner", "technical"];

export type ReadingFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "success";
      reading: string;
      model: string;
      /** `null` for a birth-chart reading, which uses no transits. */
      generatedFor: string | null;
      kind: ReadingKind;
      focus: ReadingFocus | null;
      safetyFlags: SafetyFlag[];
      depth: ExplanationDepth;
      factors: AnswerFactors;
      /** True when the visitor's session had expired and the reading was
       * given anonymously, without their saved preferences and memories. */
      sessionExpired: boolean;
    };

const FOCUSES: readonly ReadingFocus[] = [
  "career",
  "love",
  "relationships",
  "growth",
];

/**
 * Server Action backing the reading form. Same shape as the other actions
 * here: the browser posts birth data plus which reading it wants, this
 * function calls the backend, and only the reading or a safe error message
 * crosses back.
 */
export async function requestReadingAction(
  _previous: ReadingFormState,
  formData: FormData,
): Promise<ReadingFormState> {
  const birth = buildBirthData(formData);
  const kind = formData.get("kind") as ReadingKind;
  const rawFocus = formData.get("focus");
  // The birth-chart reading has no focus; an unrecognised value is dropped
  // rather than forwarded for the backend to reject.
  const focus =
    kind !== "birth_chart" && FOCUSES.includes(rawFocus as ReadingFocus)
      ? (rawFocus as ReadingFocus)
      : null;

  const rawDepth = formData.get("depth");
  const depth = DEPTHS.includes(rawDepth as ExplanationDepth)
    ? (rawDepth as ExplanationDepth)
    : undefined;

  try {
    const { result, sessionExpired } = await withOptionalSession((token) =>
      kind === "birth_chart"
        ? getBirthChartReading(birth, { depth, token })
        : getReading(birth, kind, focus ?? undefined, { depth, token }),
    );
    return {
      status: "success",
      reading: result.reading,
      model: result.model,
      generatedFor: result.generated_for,
      kind,
      focus,
      safetyFlags: result.safety_flags,
      depth: result.depth,
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
    console.error("reading request failed", error);
    return {
      status: "error",
      message: "Could not reach the reading service. Please try again.",
      fieldErrors: {},
    };
  }
}
