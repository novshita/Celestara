"use client";

import { useActionState, useState } from "react";

import { explorePlanetAction, type ExploreFormState } from "@/app/explore-actions";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";
import { PlanetResult } from "@/components/PlanetResult";
import { EXPLORE_BODIES } from "@/lib/planets";
import type { BirthData, ExploreSystem } from "@/lib/types";

const INITIAL_STATE: ExploreFormState = { status: "idle" };

export function PlanetExplorer({ defaults }: { defaults?: BirthData }) {
  const [state, formAction, isPending] = useActionState(
    explorePlanetAction,
    INITIAL_STATE,
  );
  const [system, setSystem] = useState<ExploreSystem>("vedic");
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-5 rounded-lg border border-slate-800 bg-slate-900/60 p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-amber-300">Explore a planet</h2>
          <p className="text-sm text-slate-400">
            Where one planet sits in your chart, what it is doing now, and what
            it traditionally means. Calculated and curated, no AI involved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          {(["vedic", "western"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="system"
                value={value}
                checked={system === value}
                onChange={() => setSystem(value)}
                className="accent-amber-400"
              />
              {value === "vedic" ? "Vedic" : "Western"}
            </label>
          ))}
          <label className="flex items-center gap-2">
            Planet
            {/* Re-keyed per system so the choice resets to a valid one. */}
            <select key={system} name="body" defaultValue="" required className="input w-auto">
              <option value="" disabled>
                Choose…
              </option>
              {EXPLORE_BODIES[system].map((body) => (
                <option key={body} value={body}>
                  {body}
                </option>
              ))}
            </select>
          </label>
        </div>

        <BirthFieldsFieldset fieldErrors={fieldErrors} defaults={defaults} />

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Looking…" : "Explore"}
        </button>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}
      </form>

      {state.status === "success" && <PlanetResult exploration={state.exploration} />}
    </div>
  );
}
