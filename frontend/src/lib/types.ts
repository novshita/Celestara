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

// --- Western -----------------------------------------------------------

export interface PlanetPosition {
  body: string;
  longitude: number;
  sign_index: number;
  sign: string;
  degrees_in_sign: number;
  element: string;
  modality: string;
  retrograde: boolean;
  speed_longitude: number;
  house: number | null;
  uncertain: boolean;
}

export interface House {
  number: number;
  cusp_longitude: number;
  sign_index: number;
  sign: string;
  ruler: string;
  size_degrees: number;
  bodies: string[];
}

export interface Aspect {
  first: string;
  second: string;
  aspect: string;
  exact_angle: number;
  separation: number;
  orb: number;
  applying: boolean;
  harmonious: boolean | null;
}

export interface Angles {
  ascendant: number;
  ascendant_sign: string;
  ascendant_degrees: number;
  ascendant_ruler: string;
  midheaven: number;
  midheaven_sign: string;
  descendant: number;
  imum_coeli: number;
}

export interface WesternChartMetadata {
  engine_id: string;
  calculation_version: string;
  moment: ResolvedBirthMoment;
  house_system: string;
  bodies_included: string[];
  unavailable: string[];
}

export interface WesternChart {
  system: "western";
  zodiac: "tropical";
  positions: PlanetPosition[];
  houses: House[];
  angles: Angles | null;
  aspects: Aspect[];
  metadata: WesternChartMetadata;
}

export interface WesternChartResponse {
  chart: WesternChart;
}

// --- Compare -------------------------------------------------------------

export interface SharedBodyComparison {
  body: string;
  vedic_rashi: string;
  vedic_degrees_in_rashi: number;
  western_sign: string;
  western_degrees_in_sign: number;
  signs_apart: number;
  vedic_uncertain: boolean;
  western_uncertain: boolean;
}

export interface AscendantComparison {
  vedic_rashi: string;
  western_sign: string;
  signs_apart: number;
}

export interface ComparisonMetadata {
  ayanamsa_degrees: number;
  unavailable: string[];
}

export interface ChartComparison {
  vedic: VedicChart;
  western: WesternChart;
  shared_bodies: SharedBodyComparison[];
  ascendant: AscendantComparison | null;
  metadata: ComparisonMetadata;
}

export interface CompareChartResponse {
  comparison: ChartComparison;
}

// --- Vimshottari Dasha ---------------------------------------------------

export type DashaLevel = "maha" | "antar" | "pratyantar" | "sookshma";

export interface DashaPeriod {
  lord: string;
  level: DashaLevel;
  start: string;
  end: string;
  duration_years: number;
  is_partial: boolean;
  sub_periods: DashaPeriod[];
}

export interface DashaTimeline {
  system: "vimshottari";
  moon_nakshatra: Nakshatra;
  starting_lord: string;
  elapsed_fraction: number;
  balance_years: number;
  periods: DashaPeriod[];
  uncertainty_days: number;
  moment: ResolvedBirthMoment;
}

export interface VimshottariResponse {
  timeline: DashaTimeline;
  as_of: string;
  active_now: DashaPeriod[];
}

/** The shape every backend error response takes (`app/api/errors.py`). */
export interface ApiErrorResponse {
  code: string;
  message: string;
  field_errors: { field: string; message: string }[];
  request_id: string;
}
