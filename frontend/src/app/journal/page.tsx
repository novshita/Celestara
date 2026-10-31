import type { Metadata } from "next";

import { JournalSection } from "@/components/JournalSection";
import { LoginRequired } from "@/components/LoginRequired";
import { PageHeading } from "@/components/PageHeading";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Journal · Celestara" };

export default async function JournalPage() {
  const loggedIn = Boolean(await getSessionToken());

  return (
    <>
      <PageHeading title="Journal" />
      {loggedIn ? <JournalSection /> : <LoginRequired feature="your journal" />}
    </>
  );
}
