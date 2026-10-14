import { logoutAction } from "@/app/auth-actions";
import { AuthForms } from "@/components/AuthForms";
import { getSessionEmail } from "@/lib/session";

/**
 * Reads the session cookie at request time (an async Server Component, not
 * a page - so this alone opts the route into dynamic rendering rather than
 * the whole page needing to be). Shows the login/register panel when
 * logged out, or the account's email and a logout button when logged in.
 */
export async function AccountBar() {
  const email = await getSessionEmail();

  if (!email) {
    return <AuthForms />;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm">
      <span className="text-slate-300">
        Logged in as <span className="text-amber-300">{email}</span>
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
