"use server";

import {
  BackendError,
  calculateComparison,
  calculateVedicChart,
  calculateWesternChart,
} from "@/lib/backend";
import type {
  BirthData,
  BirthTimeConfidence,
  ChartComparison,
  VedicChart,
  WesternChart,
} from "@/lib/types";

export type ChartSystem = "vedic" | "western" | "compare";

export type ChartFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; system: "vedic"; chart: VedicChart }
  | { status: "success"; system: "western"; chart: WesternChart }
  | { status: "success"; system: "compare"; comparison: ChartComparison };

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
 *
 * One action handles all three systems rather than three separate actions,
 * because the request shape (birth data) and the failure handling are
 * identical for all three - the only difference is which endpoint answers
 * and how the result is tagged for the renderer to pick a view.
 */
export async function submitBirthData(
  _previous: ChartFormState,
  formData: FormData,
): Promise<ChartFormState> {
  const birth = buildBirthData(formData);
  const system = formData.get("system") as ChartSystem;

  try {
    switch (system) {
      case "western": {
        const { chart } = await calculateWesternChart(birth);
        return { status: "success", system: "western", chart };
      }
      case "compare": {
        const { comparison } = await calculateComparison(birth);
        return { status: "success", system: "compare", comparison };
      }
      case "vedic":
      default: {
        const { chart } = await calculateVedicChart(birth);
        return { status: "success", system: "vedic", chart };
      }
    }
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
