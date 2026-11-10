/** Short labels for the drawings. Plain letters on purpose: astrological
 * glyphs render as colour emoji or not at all depending on the device. */

export const PLANET_ABBR: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mercury: "Me",
  Venus: "Ve",
  Mars: "Ma",
  Jupiter: "Ju",
  Saturn: "Sa",
  Uranus: "Ur",
  Neptune: "Ne",
  Pluto: "Pl",
  Rahu: "Ra",
  Ketu: "Ke",
};

export function planetAbbr(name: string): string {
  return PLANET_ABBR[name] ?? name.slice(0, 2);
}

/** Western signs in full, by zero-based index (Aries first). */
export const WESTERN_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** Western signs, by zero-based index (Aries first). */
export const WESTERN_SIGN_ABBR = [
  "Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis",
] as const;

/** Vedic rashis as the backend names them, by zero-based index (Mesha first). */
export const RASHI_NAMES = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena",
] as const;
