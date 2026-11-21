import type { Metadata } from "next";

import { JournalWorkspace } from "@/components/account/JournalWorkspace";
import { SignedOutHero } from "@/components/account/SignedOutHero";
import { SignedOutPreview } from "@/components/account/SignedOutPreview";
import { DesignShell } from "@/components/chart/DesignShell";
import { listJournalEntries } from "@/lib/backend";
import { getSessionEmail, getSessionToken } from "@/lib/session";
import { loadSky } from "@/lib/sky";
import { signsOf } from "@/lib/homeScene";

export const metadata: Metadata = { title: "Journal · Celestara" };

/** Signed out: the way in, and a sample of a journal. Signed in: the entries and the one being
 * written. The sky is only the Moon's sign now, for a new entry, so it is fetched only here. */
export default async function JournalPage() {
  const [token, email] = await Promise.all([getSessionToken(), getSessionEmail()]);

  if (!token || !email) {
    return (
      <DesignShell current="journal">
        <main className="ac">
          <SignedOutHero view="journal" />
          <SignedOutPreview view="journal" />
        </main>
      </DesignShell>
    );
  }

  const [entries, sky] = await Promise.all([listJournalEntries(token), loadSky()]);
  const moon = sky?.bodies.find((body) => body.name === "Moon");
  const moonSign = sky && moon ? signsOf(moon.tropical, sky.ayanamsa).vedic : null;

  return (
    <DesignShell current="journal">
      <JournalWorkspace email={email} entries={entries} moonSign={moonSign} />
    </DesignShell>
  );
}
