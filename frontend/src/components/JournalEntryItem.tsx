"use client";

import { useActionState, useState } from "react";

import {
  deleteEntryAction,
  updateEntryAction,
  type JournalFormState,
} from "@/app/journal-actions";
import { Field } from "@/components/Field";
import type { JournalEntry } from "@/lib/types";

const INITIAL_STATE: JournalFormState = { status: "idle" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function JournalEntryItem({ entry }: { entry: JournalEntry }) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateEntryAction,
    INITIAL_STATE,
  );

  // A successful save re-fetches entries (via `refresh()` in the action) but
  // does not unmount this component, so its own `isEditing` state would
  // otherwise stay stuck open - this is what closes the edit form again.
  // Done while rendering rather than in an effect, which is React's
  // recommended way to reset state when a value changes.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "success") {
      setIsEditing(false);
    }
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  if (isEditing) {
    return (
      <li className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="entry_id" value={entry.id} />

          <Field label="Title" error={fieldErrors["title"]}>
            <input
              type="text"
              name="title"
              defaultValue={entry.title}
              required
              className="input"
            />
          </Field>

          <Field label="Body" error={fieldErrors["body"]}>
            <textarea
              name="body"
              defaultValue={entry.body}
              required
              rows={4}
              className="input"
            />
          </Field>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md border border-slate-700 px-4 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
            >
              Cancel
            </button>
          </div>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-400">
              {state.message}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-slate-100">{entry.title}</h3>
        <span className="text-xs text-slate-500">
          {formatDate(entry.updated_at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-300">{entry.body}</p>
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-slate-400 transition hover:text-slate-200"
        >
          Edit
        </button>
        <form action={deleteEntryAction}>
          <input type="hidden" name="entry_id" value={entry.id} />
          <button
            type="submit"
            className="text-red-400 transition hover:text-red-300"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
