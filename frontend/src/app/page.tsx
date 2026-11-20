import { AppHome } from "@/components/AppHome";
import { Landing } from "@/components/landing/Landing";
import { getSessionEmail } from "@/lib/session";

/**
 * Signed out, `/` is the landing story; signed in, it is the app's home. A signed-out visitor
 * reaches the same home, with no account, at `/guide`.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await getSessionEmail())) return <Landing />;
  return <AppHome searchParams={searchParams} />;
}
