import Link from "next/link";

import { logoutAction } from "@/app/auth-actions";
import { getSessionEmail } from "@/lib/session";

/**
 * The account corner of the site header. Reads the session cookie at request
 * time (an async Server Component), so it shows who is logged in, or a link
 * to log in. The login and registration forms themselves live where they are
 * needed (`LoginRequired`), not in the header.
 */
export async function AccountBar() {
  const email = await getSessionEmail();

  if (!email) {
    return (
      <Link
        href="/profile"
        className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden max-w-48 truncate text-slate-400 sm:inline">
        {email}
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
