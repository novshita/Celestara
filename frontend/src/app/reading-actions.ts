"use server";

import { BackendError, getDailyReading } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";

export type DailyReadingFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; reading: string; model: string; generatedFor: string };

/**
 * Server Action backing the daily reading form. Same shape as the other
 * actions here: the browser posts birth data, this function calls the
 * backend, and only the reading or a safe error message crosses back.
 */
export async function requestDailyReadingAction(
  _previous: DailyReadingFormState,
  formData: FormData,
): Promise<DailyReadingFormState> {
  const birth = buildBirthData(formData);

  try {
    const { reading, model, generated_for } = await getDailyReading(birth);
    return { status: "success", reading, model, generatedFor: generated_for };
  } catch (error) {
    if (error instanceof BackendError) {
      const fieldErrors = Object.fromEntries(
        error.fieldErrors.map((entry) => [entry.field, entry.message]),
      );
      return { status: "error", message: error.message, fieldErrors };
    }
    console.error("daily reading request failed", error);
    return {
      status: "error",
      message: "Could not reach the reading service. Please try again.",
      fieldErrors: {},
    };
  }
}
