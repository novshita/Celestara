"use server";

import { BackendError, explorePlanet } from "@/lib/backend";
import { buildBirthData } from "@/lib/birthFormData";
import { EXPLORE_BODIES, isExploreSystem } from "@/lib/planets";
import type { PlanetExploration } from "@/lib/types";

export type ExploreFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; exploration: PlanetExploration };

/** Everything calculated or curated about one planet; no model, no account. */
export async function explorePlanetAction(
  _previous: ExploreFormState,
  formData: FormData,
): Promise<ExploreFormState> {
  const system = formData.get("system");
  const body = String(formData.get("body") ?? "");

  // The pickers only offer valid values, so anything else is a forged request.
  if (!isExploreSystem(system) || !EXPLORE_BODIES[system].includes(body)) {
    return {
      status: "error",
      message: "Choose a system and a planet from the lists.",
      fieldErrors: {},
    };
  }

  try {
    const exploration = await explorePlanet(buildBirthData(formData), system, body);
    return { status: "success", exploration };
  } catch (error) {
    if (error instanceof BackendError) {
      const fieldErrors = Object.fromEntries(
        error.fieldErrors.map((entry) => [entry.field, entry.message]),
      );
      return { status: "error", message: error.message, fieldErrors };
    }
    console.error("planet exploration failed", error);
    return {
      status: "error",
      message: "Could not explore that planet. Please try again.",
      fieldErrors: {},
    };
  }
}
