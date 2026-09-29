/**
 * Wire types for the Celestara backend.
 *
 * Deliberately a thin, honest mirror of `backend/app/domain/*.py` and
 * `backend/app/api/schemas.py` - same field names, same snake_case - rather
 * than a translated/camelCased shape. Engineering spec §3: "The frontend
 * must not own authoritative astrology calculations," and the least risky
 * way to honor that is to not re-model the data at all, just pass it
 * through. Extend this file whenever a new backend field is consumed; do
 * not guess at fields the UI does not use yet.
 */

export type BirthTimeConfidence = "EXACT" | "ESTIMATED" | "UNKNOWN";

export interface BirthData {
  birth_date: string; // YYYY-MM-DD
  birth_time: string | null; // HH:MM:SS, null when time_confidence is UNKNOWN
  time_confidence: BirthTimeConfidence;
  latitude: number;
  longitude: number;
  timezone_name: string | null;
}

export interface Nakshatra {
  index: number;
  name: string;
  pada: number;
  lord: string;
}

export interface Certainty {
  rashi_certain: boolean;
  nakshatra_certain: boolean;
  pada_certain: boolean;
}

export interface GrahaPlacement {
  graha: string;
  longitude: number;
  rashi_index: number;
  rashi: string;
  degrees_in_rashi: number;
  nakshatra: Nakshatra;
  retrograde: boolean;
  speed_longitude: number;
  bhava: number | null;
  certainty: Certainty;
  derived_from: string | null;
}

export interface Ascendant {
  longitude: number;
  rashi_index: number;
  rashi: string;
  degrees_in_rashi: number;
  lord: string;
  nakshatra: Nakshatra;
}

export interface ResolvedBirthMoment {
  utc_datetime: string;
  timezone_name: string;
  time_confidence: BirthTimeConfidence;
  uncertainty_hours: number;
  assumptions: string[];
}

export interface VedicChartMetadata {
  engine_id: string;
  calculation_version: string;
  moment: ResolvedBirthMoment;
  ayanamsa_degrees: number;
  unavailable: string[];
}

export interface VedicChart {
  system: "vedic";
  zodiac: "sidereal";
  chart_type: "D1";
  placements: GrahaPlacement[];
  ascendant: Ascendant | null;
  moon_nakshatra: Nakshatra | null;
  metadata: VedicChartMetadata;
}

export interface VedicChartResponse {
  chart: VedicChart;
}

/** The shape every backend error response takes (`app/api/errors.py`). */
export interface ApiErrorResponse {
  code: string;
  message: string;
  field_errors: { field: string; message: string }[];
  request_id: string;
}
