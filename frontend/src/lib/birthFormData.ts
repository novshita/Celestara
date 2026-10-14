/**
 * Converts the `BirthFieldsFieldset` form fields into a `BirthData` payload.
 * Shared between `app/actions.ts` (chart calculation) and
 * `app/profile-actions.ts` (saving a profile) - both post the same shape to
 * the backend from the same six form fields, so the conversion belongs in
 * one place rather than two copies that could drift.
 */

import type { BirthData, BirthTimeConfidence } from "./types";

/** `<input type="time">` submits `HH:MM`; the backend wants `HH:MM:SS`. */
function withSeconds(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

export function buildBirthData(formData: FormData): BirthData {
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
