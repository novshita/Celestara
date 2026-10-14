/**
 * Session cookie storage.
 *
 * Follows Next.js's own "Database Sessions" pattern (the App Router
 * authentication guide, §Session Management): the cookie holds nothing but
 * an opaque session identifier - here, the backend's own bearer token - and
 * every security-sensitive concern (hashing, expiry, revocation) is the
 * backend's job, already done in `app/services/auth/service.py`. There is
 * nothing to encrypt or sign here, unlike the guide's stateless-JWT example,
 * because the token itself is meaningless without the backend's session
 * table - a stolen cookie is only as good as a stolen bearer token already
 * was.
 *
 * The email cookie exists purely so a Server Component can greet the user by
 * name without an extra backend round trip; it carries no authority (nothing
 * reads it to decide access) and the email was already visible to the user
 * who typed it, so it is low-sensitivity. Both cookies are httpOnly
 * regardless - there is no reason to expose either to client JavaScript.
 */

import "server-only";

import { cookies } from "next/headers";

const SESSION_COOKIE = "celestara_session";
const EMAIL_COOKIE = "celestara_email";

//: Should track the backend's own SESSION_TTL_DAYS
//: (`app/services/auth/service.py`, default 30). A mismatch is not a
//: security problem - the backend independently expires the underlying
//: session - only a UX one: the cookie could outlive, or (rarely) a changed
//: backend setting could outlast, the session it names.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export async function setSession(token: string, email: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  store.set(EMAIL_COOKIE, email, COOKIE_OPTIONS);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(EMAIL_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getSessionEmail(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(EMAIL_COOKIE)?.value;
}
