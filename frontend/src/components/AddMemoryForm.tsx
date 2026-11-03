"use client";

import { useActionState, useRef } from "react";

import { addMemoryAction, type AccountFormState } from "@/app/account-actions";

const INITIAL_STATE: AccountFormState = { status: "idle" };

export function AddMemoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (previous: AccountFormState, formData: FormData) => {
      const result = await addMemoryAction(previous, formData);
      if (result.status === "success") {
        formRef.current?.reset();
      }
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <select
          name="kind"
          defaultValue="note"
          aria-label="Kind of memory"
          className="input w-auto"
        >
          <option value="note">Note about me</option>
          <option value="preference">How I like answers</option>
        </select>
        <input
          type="text"
          name="content"
          required
          maxLength={500}
          placeholder="e.g. I prefer short answers"
          aria-label="What to remember"
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Remember"}
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
