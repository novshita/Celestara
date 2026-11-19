/**
 * Checks for the birth-chart form, with the wording from the design. The server (and the
 * calculation engine behind it) validates again; these checks exist so a visitor is told
 * what is missing in plain words, next to the field, before anything is sent.
 */

export type TimeConfidenceChoice = "EXACT" | "ESTIMATED" | "UNKNOWN";

export interface ChartInputs {
  date: string;
  time: string;
  confidence: TimeConfidenceChoice;
  latitude: string;
  longitude: string;
}

export type ChartField = "date" | "time" | "latitude" | "longitude";
export type ChartErrors = Partial<Record<ChartField, string>>;

const num = (v: string): number => (v.trim() === "" ? Number.NaN : Number(v));

export const okDate = (v: ChartInputs): boolean => v.date.trim() !== "" && Number(v.date.slice(0, 4)) >= 1800;
export const okTime = (v: ChartInputs): boolean => v.confidence === "UNKNOWN" || v.time.trim() !== "";
export const okLatitude = (v: ChartInputs): boolean => {
  const n = num(v.latitude);
  return Number.isFinite(n) && n >= -90 && n <= 90;
};
export const okLongitude = (v: ChartInputs): boolean => {
  const n = num(v.longitude);
  return Number.isFinite(n) && n >= -180 && n <= 180;
};

/** Every problem with the inputs, keyed by field; an empty object means they are fine. */
export function chartErrors(v: ChartInputs): ChartErrors {
  const errors: ChartErrors = {};
  if (!okDate(v)) errors.date = v.date.trim() === "" ? "Add the birth date." : "Add a valid birth date (1800 or later).";
  if (!okTime(v)) errors.time = "Add the birth time, or choose “I don’t know the time”.";
  if (!okLatitude(v)) errors.latitude = v.latitude.trim() === "" ? "Add the latitude." : "Latitude is between −90 and 90.";
  if (!okLongitude(v)) errors.longitude = v.longitude.trim() === "" ? "Add the longitude." : "Longitude is between −180 and 180.";
  return errors;
}

/** How many of the five steps of the instrument are set: date, time, latitude, longitude,
 * and the lens (which always has a choice). */
export function stepsSet(v: ChartInputs): number {
  return [okDate(v), okTime(v), okLatitude(v), okLongitude(v), true].filter(Boolean).length;
}

/** Where the coordinates fall on the world grid, as percentages from the top-left, or null. */
export function plateOffset(v: ChartInputs): { x: number; y: number } | null {
  if (!okLatitude(v) || !okLongitude(v)) return null;
  return { x: ((Number(v.longitude) + 180) / 360) * 100, y: ((90 - Number(v.latitude)) / 180) * 100 };
}

/** The server reports problems as `birth.<field>`; this maps them to the form's fields. */
export const SERVER_FIELD: Record<string, ChartField> = {
  "birth.birth_date": "date",
  "birth.birth_time": "time",
  "birth.latitude": "latitude",
  "birth.longitude": "longitude",
};
