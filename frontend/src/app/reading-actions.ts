"use server";

import { BackendError, getBirthChartReading, getReading } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import type { ReadingFocus, ReadingKind, SafetyFlag } from "@/lib/types";

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

  try {
    const { reading, model, generated_for, safety_flags } =
      kind === "birth_chart"
        ? await getBirthChartReading(birth)
        : await getReading(birth, kind, focus ?? undefined);
    return {
      status: "success",
      reading,
      model,
      generatedFor: generated_for,
      kind,
      focus,
      safetyFlags: safety_flags,
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
