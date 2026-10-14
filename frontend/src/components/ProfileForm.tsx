"use client";

import { useActionState } from "react";

import { saveProfileAction, type ProfileFormState } from "@/app/profile-actions";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";
import type { BirthData } from "@/lib/types";

const INITIAL_STATE: ProfileFormState = { status: "idle" };

export function ProfileForm({ defaults }: { defaults?: BirthData }) {
  const [state, formAction, isPending] = useActionState(
    saveProfileAction,
    INITIAL_STATE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <BirthFieldsFieldset fieldErrors={fieldErrors} defaults={defaults} />

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : defaults ? "Save changes" : "Save profile"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
