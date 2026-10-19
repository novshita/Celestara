"use server";

import { BackendError, getReading } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import type { ReadingPeriod } from "@/lib/types";

export type ReadingFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; reading: string; model: string; generatedFor: string };

/**
 * Server Action backing the reading form. Same shape as the other actions
 * here: the browser posts birth data plus which period it wants, this
 * function calls the backend, and only the reading or a safe error message
 * crosses back.
 */
export async function requestReadingAction(
  _previous: ReadingFormState,
  formData: FormData,
): Promise<ReadingFormState> {
  const birth = buildBirthData(formData);
  const period = formData.get("period") as ReadingPeriod;

  try {
    const { reading, model, generated_for } = await getReading(birth, period);
    return { status: "success", reading, model, generatedFor: generated_for };
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
