"use client";

import { useActionState, useState } from "react";

import { loginAction, registerAction, type AuthFormState } from "@/app/auth-actions";

const INITIAL_STATE: AuthFormState = { status: "idle" };

type Mode = "login" | "register";

/**
 * Product spec §28: the user can explore without an account. This panel is
 * shown alongside, not in place of, the calculation form - creating an
 * account only becomes necessary for the persisted features (profile,
 * journal) that build on top of it later.
 */
export function AuthForms() {
  const [mode, setMode] = useState<Mode>("login");

  // Two separate hooks, not one bound to a mode-dependent action: switching
  // tabs should not leave the other form's stale error message on screen,
  // which is what sharing a single `useActionState` call would do.
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    INITIAL_STATE,
  );
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    INITIAL_STATE,
  );

  const state = mode === "login" ? loginState : registerState;
  const formAction = mode === "login" ? loginFormAction : registerFormAction;
  const isPending = mode === "login" ? loginPending : registerPending;

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex gap-4 text-sm">
        <ModeTab label="Log in" active={mode === "login"} onClick={() => setMode("login")} />
        <ModeTab
          label="Create account"
          active={mode === "register"}
          onClick={() => setMode("register")}
        />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span>Email</span>
          <input type="email" name="email" required className="input" />
          {fieldErrors["email"] && (
            <span className="text-xs text-red-400">{fieldErrors["email"]}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span>Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            className="input"
          />
          {fieldErrors["password"] && (
            <span className="text-xs text-red-400">{fieldErrors["password"]}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-amber-400 pb-1 text-amber-300"
          : "border-b-2 border-transparent pb-1 text-slate-500 hover:text-slate-300"
      }
    >
      {label}
    </button>
  );
}
