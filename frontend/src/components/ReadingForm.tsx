"use client";

import { useActionState, useState } from "react";

import {
  requestReadingAction,
  type ReadingFormState,
} from "@/app/reading-actions";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";
import type { ReadingFocus, ReadingKind } from "@/lib/types";

const INITIAL_STATE: ReadingFormState = { status: "idle" };

const KIND_OPTIONS: { value: ReadingKind; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "birth_chart", label: "Birth chart" },
];

const FOCUS_OPTIONS: { value: "" | ReadingFocus; label: string }[] = [
  { value: "", label: "General" },
  { value: "career", label: "Career" },
  { value: "love", label: "Love" },
  { value: "relationships", label: "Relationships" },
  { value: "growth", label: "Personal growth" },
];

const KIND_LABEL: Record<ReadingKind, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  birth_chart: "Birth chart",
};

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReadingForm() {
  const [state, formAction, isPending] = useActionState(
    requestReadingAction,
    INITIAL_STATE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  // The birth-chart reading reads the natal chart alone, so a focus does
  // not apply to it.
  const [kind, setKind] = useState<ReadingKind>("daily");

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <div>
        <h2 className="text-lg font-semibold text-amber-300">Reading</h2>
        <p className="text-sm text-slate-500">
          Grounded in your calculated chart and the current transits -
          recalculated every time, never a static template. The week and
          month views look ahead at the changes that actually fall in that
          period. The birth-chart reading uses your natal chart alone.
          Offered for reflection, not prediction.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex gap-4 text-sm text-slate-300">
          {KIND_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="accent-amber-400"
              />
              {option.label}
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Focus
          <select
            name="focus"
            disabled={kind === "birth_chart"}
            defaultValue=""
            className="input w-auto disabled:opacity-50"
          >
            {FOCUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <BirthFieldsFieldset fieldErrors={fieldErrors} />

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Reading the sky…" : "Get my reading"}
        </button>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}
      </form>

      {state.status === "success" && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-900/40 bg-amber-950/20 p-4">
          <p className="whitespace-pre-wrap text-sm text-slate-100">
            {state.reading}
          </p>
          {state.safetyFlags.length > 0 && (
            <p className="text-xs text-slate-500">
              The original reading could not be shown safely, so this
              standard response is shown instead.
            </p>
          )}
          <span className="text-xs text-slate-500">
            {KIND_LABEL[state.kind]}
            {state.focus ? ` · ${state.focus}` : ""} ·{" "}
            {state.generatedFor
              ? `as of ${formatMoment(state.generatedFor)} UTC`
              : "from your natal chart"}{" "}
            · {state.model}
          </span>
        </div>
      )}
    </section>
  );
}
