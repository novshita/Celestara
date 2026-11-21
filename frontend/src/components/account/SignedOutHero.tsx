"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";

import { loginAction, registerAction, type AuthFormState } from "@/app/auth-actions";
import { checkCredentials, hasErrors, type AuthMode, type CredentialErrors } from "@/lib/account";

import { SealedDoor } from "./SealedDoor";

const IDLE: AuthFormState = { status: "idle" };
const NO_ERRORS: CredentialErrors = { email: "", password: "" };

/** How long the door takes to open before the page changes to the signed-in view. */
const OPENING_MS = 1500;

export const SIGNED_OUT_COPY = {
  profile: {
    eyebrow: "Your saved profile",
    title: "Profile",
    lede: "Log in or create an account to use a saved profile. Everything else on Celestara works without one.",
  },
  journal: {
    eyebrow: "Your journal",
    title: "Journal",
    lede: "Log in or create an account to use your journal. Everything else on Celestara works without one.",
  },
  conversation: {
    eyebrow: "Saved conversations",
    title: "Conversation",
    lede: "Log in to read your saved conversations with the Guide. Everything else on Celestara works without an account.",
  },
} as const;

export type SignedOutView = keyof typeof SIGNED_OUT_COPY;

/**
 * What a visitor without an account sees at the top of Profile and Journal: a calm form beside a
 * sealed door. The form checks what a person can fix at once (an email with no @, no password, a
 * short new password); the server stays the judge of everything else, and its answers show against
 * the field they belong to. When the server says yes the door opens, then the page refreshes into
 * the signed-in view.
 */
export function SignedOutHero({ view }: { view: SignedOutView }) {
  const copy = SIGNED_OUT_COPY[view];
  const router = useRouter();
  const ids = useId();
  const [mode, setMode] = useState<AuthMode>("login");
  const [shown, setShown] = useState(false);
  const [local, setLocal] = useState<CredentialErrors>(NO_ERRORS);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const underline = useRef<HTMLElement>(null);
  const loginTab = useRef<HTMLButtonElement>(null);
  const registerTab = useRef<HTMLButtonElement>(null);

  // Two hooks, so switching tab does not leave the other form's stale error on screen
  const [loginState, loginDispatch, loginPending] = useActionState(loginAction, IDLE);
  const [registerState, registerDispatch, registerPending] = useActionState(registerAction, IDLE);
  const state = mode === "login" ? loginState : registerState;
  const dispatch = mode === "login" ? loginDispatch : registerDispatch;
  const pending = mode === "login" ? loginPending : registerPending;
  const succeeded = state.status === "success";
  const fromServer = state.status === "error" ? state.fieldErrors : {};
  const hasFieldErrors = Object.keys(fromServer).length > 0;

  const errors: CredentialErrors = {
    email: local.email || fromServer["email"] || "",
    password: local.password || fromServer["password"] || "",
  };

  // The tab underline slides to the chosen tab
  useEffect(() => {
    const tab = mode === "login" ? loginTab.current : registerTab.current;
    const line = underline.current;
    if (!tab || !line) return;
    const place = () => {
      line.style.width = `${tab.offsetWidth}px`;
      line.style.transform = `translateX(${tab.offsetLeft}px)`;
    };
    place();
    window.addEventListener("resize", place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [mode]);

  // Once the server has said yes, let the door open, then move to the signed-in page
  useEffect(() => {
    if (!succeeded) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => router.refresh(), reduced ? 250 : OPENING_MS);
    return () => window.clearTimeout(timer);
  }, [succeeded, router]);

  function choose(next: AuthMode) {
    setMode(next);
    setLocal(NO_ERRORS);
  }

  // Submitted by hand rather than through the form's `action`: React empties a form once its
  // action finishes, which would wipe the email after a wrong password.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = checkCredentials(email.current?.value ?? "", password.current?.value ?? "", mode);
    setLocal(found);
    if (hasErrors(found)) {
      (found.email ? email.current : password.current)?.focus();
      return;
    }
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  }

  const busy = pending || succeeded;

  return (
    <section className="ac-hero" aria-labelledby={`${ids}-title`}>
      <div>
        <div className="ac-eyebrow cx-mono">
          <span>{copy.eyebrow}</span>
          <span className="cx-tag">Account required</span>
        </div>
        <h1 id={`${ids}-title`}>{copy.title}</h1>
        <p className="ac-lede">{copy.lede}</p>

        <form className="ac-card" id="form" onSubmit={onSubmit} noValidate aria-label="Account">
          <div className="ac-tabs" role="tablist" aria-label="Log in or create account">
            <button ref={loginTab} type="button" role="tab" aria-selected={mode === "login"} aria-controls="form" onClick={() => choose("login")}>
              Log in
            </button>
            <button ref={registerTab} type="button" role="tab" aria-selected={mode === "register"} aria-controls="form" onClick={() => choose("register")}>
              Create account
            </button>
            <i className="ac-ul" ref={underline} />
          </div>

          <div className="ac-fld">
            <label htmlFor={`${ids}-email`}>Email</label>
            <div className="ac-inp">
              <input
                ref={email}
                id={`${ids}-email`}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={`${ids}-email-err`}
              />
            </div>
            <p className="ac-err" id={`${ids}-email-err`} role="alert">{errors.email}</p>
          </div>

          <div className="ac-fld" style={{ marginTop: 2 }}>
            <label htmlFor={`${ids}-password`}>Password</label>
            <div className="ac-inp ac-pw">
              <input
                ref={password}
                id={`${ids}-password`}
                name="password"
                type={shown ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Your password" : "Choose a password"}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={`${ids}-password-err`}
              />
              <button type="button" className="ac-show" aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} onClick={() => setShown((on) => !on)}>
                {shown ? "Hide" : "Show"}
              </button>
            </div>
            <p className="ac-err" id={`${ids}-password-err`} role="alert">{errors.password}</p>
          </div>

          <button className="ac-go" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? (succeeded || mode === "login" ? "Opening…" : "Creating…") : mode === "login" ? "Log in" : "Create account"}
          </button>

          {state.status === "error" && !hasFieldErrors && (
            <p className="ac-err" role="alert" style={{ marginTop: 12 }}>{state.message}</p>
          )}
        </form>
        <p className="ac-fine">
          Everything else on Celestara works without an account. Your birth data and conversations are only saved if you choose to.
        </p>
      </div>
      <SealedDoor open={busy} />
    </section>
  );
}
