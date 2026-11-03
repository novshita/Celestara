"use client";

import { useActionState } from "react";

import { deleteAccountAction, type AccountFormState } from "@/app/account-actions";
import { DELETE_CONFIRMATION } from "@/lib/accountConfirm";

const INITIAL_STATE: AccountFormState = { status: "idle" };

export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState(
    deleteAccountAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="confirmation"
        autoComplete="off"
        placeholder={`Type ${DELETE_CONFIRMATION}`}
        aria-label={`Type ${DELETE_CONFIRMATION} to confirm`}
        className="input w-40"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-red-500/60 px-4 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete my data"}
      </button>
      {state.status === "error" && (
        <span role="alert" className="text-sm text-red-400">
          {state.message}
        </span>
      )}
    </form>
  );
}
