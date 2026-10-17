"use client";

import { useActionState } from "react";

import {
  requestDailyReadingAction,
  type DailyReadingFormState,
} from "@/app/reading-actions";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";

const INITIAL_STATE: DailyReadingFormState = { status: "idle" };

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DailyReadingForm() {
  const [state, formAction, isPending] = useActionState(
    requestDailyReadingAction,
    INITIAL_STATE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <div>
        <h2 className="text-lg font-semibold text-amber-300">
          Today&apos;s Reading
        </h2>
        <p className="text-sm text-slate-500">
          Grounded in today&apos;s calculated transits against your chart -
          recalculated every time, never a static template. Offered for
          reflection, not prediction.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <BirthFieldsFieldset fieldErrors={fieldErrors} />

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Reading the sky…" : "Get today's reading"}
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
          <span className="text-xs text-slate-500">
            As of {formatMoment(state.generatedFor)} UTC · {state.model}
          </span>
        </div>
      )}
    </section>
  );
}
