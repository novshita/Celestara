import "server-only";

import { BackendError } from "@/lib/backend";
import { clearSession, getSessionToken } from "@/lib/session";

/**
 * Runs an AI call as the logged-in user if there is one, so the backend can
 * apply their saved depth, memories and conversations.
 *
 * The backend answers a token it no longer recognises with a 401 and not
 * with an anonymous answer, so nobody is led to think a conversation is being
 * saved when it is not. For a visitor that has simply been logged out (the
 * session expired) that would make the AI Guide unusable until they log in
 * again, so this clears the stale cookie, repeats the call anonymously, and
 * reports `sessionExpired` so the page can say what happened.
 */
export async function withOptionalSession<T>(
  call: (token: string | undefined) => Promise<T>,
): Promise<{ result: T; sessionExpired: boolean }> {
  const token = await getSessionToken();

  try {
    return { result: await call(token), sessionExpired: false };
  } catch (error) {
    if (
      token &&
      error instanceof BackendError &&
      error.code === "AUTH_REQUIRED"
    ) {
      await clearSession();
      return { result: await call(undefined), sessionExpired: true };
    }
    throw error;
  }
}
