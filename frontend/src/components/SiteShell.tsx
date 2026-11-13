import Link from "next/link";

import { AccountBar } from "@/components/AccountBar";
import { SiteNav } from "@/components/SiteNav";
import { getSessionEmail } from "@/lib/session";

/**
 * The app's frame: the sticky header (logo, primary navigation, account
 * corner) and the page column. Every page except the landing page wears it;
 * the landing page is a full-bleed story with its own navigation.
 *
 * "Home" is the signed-in home at `/`, but a signed-out visitor's `/` is the
 * landing page, so for them "Home" leads to the guide (`/guide`), which holds
 * the same content and needs no account.
 */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(await getSessionEmail());

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <Link
            href="/"
            className="display text-xl font-semibold tracking-wide text-amber-300"
          >
            ✦ Celestara
          </Link>
          <SiteNav homeHref={signedIn ? "/" : "/guide"} />
          <AccountBar />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        {children}
      </main>
    </>
  );
}
