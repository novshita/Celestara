"use client";

import { useActionState, useEffect, useRef } from "react";

import { createEntryAction, type JournalFormState } from "@/app/journal-actions";
import { Field } from "@/components/Field";

const INITIAL_STATE: JournalFormState = { status: "idle" };

export function JournalNewEntryForm() {
  const [state, formAction, isPending] = useActionState(
    createEntryAction,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Uncontrolled inputs keep whatever the user typed across the re-render
  // `refresh()` triggers, so a successful add would otherwise leave the
  // just-submitted title/body sitting in the form above the new entry.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3"
    >
      <Field label="Title" error={fieldErrors["title"]}>
        <input
          type="text"
          name="title"
          required
          placeholder="A quiet realization"
          className="input"
        />
      </Field>

      <Field label="Body" error={fieldErrors["body"]}>
        <textarea
          name="body"
          required
          rows={4}
          placeholder="What's on your mind?"
          className="input"
        />
      </Field>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Add entry"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
