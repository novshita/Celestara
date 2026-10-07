"use client";

import { useActionState, useState } from "react";

import { submitBirthData, type ChartFormState, type ChartSystem } from "@/app/actions";
import type { BirthTimeConfidence } from "@/lib/types";
import { CompareResult } from "@/components/CompareResult";
import { DashaResult } from "@/components/DashaResult";
import { VedicChartResult } from "@/components/VedicChartResult";
import { WesternChartResult } from "@/components/WesternChartResult";

const INITIAL_STATE: ChartFormState = { status: "idle" };

const TIME_CONFIDENCE_OPTIONS: { value: BirthTimeConfidence; label: string }[] = [
  { value: "EXACT", label: "Exact - I know the time" },
  { value: "ESTIMATED", label: "Estimated - approximately" },
  { value: "UNKNOWN", label: "Unknown - I don't know it" },
];

const SYSTEM_OPTIONS: { value: ChartSystem; label: string }[] = [
  { value: "vedic", label: "Vedic (Rashi / D1)" },
  { value: "western", label: "Western (Tropical)" },
  { value: "compare", label: "Compare both" },
  { value: "dasha", label: "Vimshottari Dasha" },
];

export function BirthDataForm() {
  const [state, formAction, isPending] = useActionState(
    submitBirthData,
    INITIAL_STATE,
  );
  const [timeConfidence, setTimeConfidence] =
    useState<BirthTimeConfidence>("EXACT");

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const timeIsUsable = timeConfidence !== "UNKNOWN";

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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Birth date" error={fieldErrors["birth.birth_date"]}>
            <input
              type="date"
              name="birth_date"
              required
              className="input"
            />
          </Field>

          <Field label="Time confidence">
            <select
              name="time_confidence"
              value={timeConfidence}
              onChange={(event) =>
                setTimeConfidence(event.target.value as BirthTimeConfidence)
              }
              className="input"
            >
              {TIME_CONFIDENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Birth time"
            error={fieldErrors["birth.birth_time"]}
            hint={!timeIsUsable ? "Not needed - time is unknown" : undefined}
          >
            <input
              type="time"
              name="birth_time"
              step={1}
              disabled={!timeIsUsable}
              required={timeIsUsable}
              className="input disabled:opacity-40"
            />
          </Field>

          <Field label="Timezone" hint="Leave blank to detect from coordinates">
            <input
              type="text"
              name="timezone_name"
              placeholder="e.g. Asia/Kolkata"
              className="input"
            />
          </Field>

          <Field label="Latitude" error={fieldErrors["birth.latitude"]}>
            <input
              type="number"
              name="latitude"
              step="any"
              min={-90}
              max={90}
              required
              placeholder="18.9756"
              className="input"
            />
          </Field>

          <Field label="Longitude" error={fieldErrors["birth.longitude"]}>
            <input
              type="number"
              name="longitude"
              step="any"
              min={-180}
              max={180}
              required
              placeholder="72.8258"
              className="input"
            />
          </Field>
        </div>

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
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
