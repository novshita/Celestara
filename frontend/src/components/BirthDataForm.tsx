"use client";

import { useActionState } from "react";

import { submitBirthData, type ChartFormState, type ChartSystem } from "@/app/actions";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";
import { CompareResult } from "@/components/CompareResult";
import { DashaResult } from "@/components/DashaResult";
import { TransitResult } from "@/components/TransitResult";
import { VedicChartResult } from "@/components/VedicChartResult";
import { WesternChartResult } from "@/components/WesternChartResult";
import type { BirthData } from "@/lib/types";

const INITIAL_STATE: ChartFormState = { status: "idle" };

const SYSTEM_OPTIONS: { value: ChartSystem; label: string }[] = [
  { value: "vedic", label: "Vedic (Rashi / D1)" },
  { value: "western", label: "Western (Tropical)" },
  { value: "compare", label: "Compare both" },
  { value: "dasha", label: "Vimshottari Dasha" },
  { value: "transit", label: "Current transits (Gochar)" },
];

export function BirthDataForm({ defaults }: { defaults?: BirthData }) {
  const [state, formAction, isPending] = useActionState(
    submitBirthData,
    INITIAL_STATE,
  );

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex gap-4 text-sm text-slate-300">
          {SYSTEM_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="system"
                value={option.value}
                defaultChecked={option.value === "vedic"}
                className="accent-amber-400"
              />
              {option.label}
            </label>
          ))}
        </div>

        <BirthFieldsFieldset fieldErrors={fieldErrors} defaults={defaults} />

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Calculating…" : "Calculate chart"}
        </button>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}
      </form>

      {state.status === "success" && state.system === "vedic" && (
        <VedicChartResult chart={state.chart} />
      )}
      {state.status === "success" && state.system === "western" && (
        <WesternChartResult chart={state.chart} />
      )}
      {state.status === "success" && state.system === "compare" && (
        <CompareResult comparison={state.comparison} />
      )}
      {state.status === "success" && state.system === "dasha" && (
        <DashaResult dasha={state.dasha} />
      )}
      {state.status === "success" && state.system === "transit" && (
        <TransitResult report={state.report} />
      )}
    </div>
  );
}
