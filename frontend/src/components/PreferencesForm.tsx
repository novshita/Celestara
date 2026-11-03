"use client";

import { useActionState } from "react";

import { savePreferencesAction, type AccountFormState } from "@/app/account-actions";
import type { ExplanationDepth } from "@/lib/types";

const INITIAL_STATE: AccountFormState = { status: "idle" };

export function PreferencesForm({ depth }: { depth: ExplanationDepth }) {
  const [state, formAction, isPending] = useActionState(
    savePreferencesAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Explanations
        <select name="depth" defaultValue={depth} className="input w-auto">
          <option value="beginner">Beginner</option>
          <option value="technical">Technical</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {state.status === "success" && (
        <span role="status" className="text-sm text-emerald-400">
          Saved
        </span>
      )}
      {state.status === "error" && (
        <span role="alert" className="text-sm text-red-400">
          {state.message}
        </span>
      )}
    </form>
  );
}
