"use server";

import { BackendError, calculateVedicChart } from "@/lib/backend";
import type { BirthData, BirthTimeConfidence, VedicChart } from "@/lib/types";

export type ChartFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; chart: VedicChart };

/** `<input type="time">` submits `HH:MM`; the backend wants `HH:MM:SS`. */
function withSeconds(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function buildBirthData(formData: FormData): BirthData {
  const timeConfidence = formData.get("time_confidence") as BirthTimeConfidence;
  const rawTime = formData.get("birth_time");
  const rawTimezone = formData.get("timezone_name");

  return {
    birth_date: formData.get("birth_date") as string,
    birth_time:
      timeConfidence === "UNKNOWN" || !rawTime
        ? null
        : withSeconds(rawTime as string),
    time_confidence: timeConfidence,
    latitude: Number.parseFloat(formData.get("latitude") as string),
    longitude: Number.parseFloat(formData.get("longitude") as string),
    timezone_name: rawTimezone ? (rawTimezone as string) : null,
  };
}

/**
 * Server Action backing the birth-data form. Runs entirely on the Next.js
 * server: the browser posts the form, this function calls the FastAPI
 * backend, and only the result (chart or error) crosses back to the client.
 */
export async function submitBirthData(
  _previous: ChartFormState,
  formData: FormData,
): Promise<ChartFormState> {
  const birth = buildBirthData(formData);

  try {
    const { chart } = await calculateVedicChart(birth);
    return { status: "success", chart };
  } catch (error) {
    if (error instanceof BackendError) {
      const fieldErrors = Object.fromEntries(
        error.fieldErrors.map((entry) => [entry.field, entry.message]),
      );
      return { status: "error", message: error.message, fieldErrors };
    }
    // Not a BackendError: the backend was unreachable, timed out, or
    // returned something that isn't its documented error shape. That
    // detail is an infrastructure concern, not something authored to be
    // shown to a user (engineering spec §22), so it is logged and replaced.
    console.error("chart calculation failed", error);
    return {
      status: "error",
      message: "Could not reach the calculation service. Please try again.",
      fieldErrors: {},
    };
  }
}
