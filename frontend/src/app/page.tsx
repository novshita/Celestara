import { AppHome } from "@/components/AppHome";
import { Landing } from "@/components/landing/Landing";
import { SiteShell } from "@/components/SiteShell";
import { getSessionEmail } from "@/lib/session";

/**
 * Signed out, `/` is the landing story; signed in, it is the app's home. A
 * signed-out visitor reaches the same home, with no account, at `/guide`.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!(await getSessionEmail())) return <Landing />;

  return (
    <SiteShell>
      <AppHome searchParams={searchParams} />
    </SiteShell>
  );
}
