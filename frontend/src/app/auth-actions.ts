"use server";

import { refresh } from "next/cache";

import {
  BackendError,
  loginUser,
  logoutSession,
  registerUser,
} from "@/lib/backend";
import { clearSession, getSessionToken, setSession } from "@/lib/session";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

function credentials(formData: FormData): { email: string; password: string } {
  return {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };
}

function toErrorState(error: unknown, fallback: string): AuthFormState {
  if (error instanceof BackendError) {
    const fieldErrors = Object.fromEntries(
      error.fieldErrors.map((entry) => [entry.field, entry.message]),
    );
    return { status: "error", message: error.message, fieldErrors };
  }
  console.error(fallback, error);
  return { status: "error", message: fallback, fieldErrors: {} };
}

/**
 * Registers the account, then logs it in immediately. Two backend calls -
 * `/auth/register` deliberately returns no token (see its docstring: it
 * keeps that endpoint's only job "does this email exist now") - but there
 * is no reason to make a brand-new user submit a second form to use the
 * account they just created.
 */
export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = credentials(formData);

  try {
    await registerUser(email, password);
    const { access_token } = await loginUser(email, password);
    await setSession(access_token, email);
  } catch (error) {
    return toErrorState(error, "Could not create the account. Please try again.");
  }

  refresh();
  return { status: "success" };
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = credentials(formData);

  try {
    const { access_token } = await loginUser(email, password);
    await setSession(access_token, email);
  } catch (error) {
    return toErrorState(error, "Could not log in. Please try again.");
  }

  refresh();
  return { status: "success" };
}

/**
 * Bound directly to a `<form action={logoutAction}>` with no fields, so it
 * still receives a `FormData` argument per React's Server Function
 * convention - just one with nothing in it.
 */
export async function logoutAction(_formData: FormData): Promise<void> {
  const token = await getSessionToken();

  if (token) {
    // Best-effort: if the token is already invalid or the backend is
    // briefly unreachable, the user still gets logged out locally - an
    // already-useless session failing to revoke cleanly is not worth
    // blocking on.
    try {
      await logoutSession(token);
    } catch (error) {
      console.error("logout revocation failed", error);
    }
  }

  await clearSession();
  refresh();
}
