import type { Metadata } from "next";

import { ProfileWorkspace } from "@/components/account/ProfileWorkspace";
import { SignedOutHero } from "@/components/account/SignedOutHero";
import { SignedOutPreview } from "@/components/account/SignedOutPreview";
import { DesignShell } from "@/components/chart/DesignShell";
import { getPreferences, getProfile, listConversations, listMemories } from "@/lib/backend";
import { getSessionEmail, getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Profile · Celestara" };

/** Signed out: the way in, and a sample of what an account opens up. Signed in: the saved profile,
 * preferences, what the Guide remembers, saved conversations and the privacy controls. */
export default async function ProfilePage() {
  const [token, email] = await Promise.all([getSessionToken(), getSessionEmail()]);

  if (!token || !email) {
    return (
      <DesignShell current="profile">
        <main className="ac">
          <SignedOutHero view="profile" />
          <SignedOutPreview view="profile" />
        </main>
      </DesignShell>
    );
  }

  const [profile, preferences, memories, conversations] = await Promise.all([
    getProfile(token),
    getPreferences(token),
    listMemories(token),
    listConversations(token),
  ]);

  return (
    <DesignShell current="profile">
      <ProfileWorkspace
        data={{
          email,
          birth: profile?.birth ?? null,
          depth: preferences.explanation_depth,
          patternDetection: preferences.pattern_detection,
          calculationConfig: preferences.calculation_config,
          memories,
          conversations,
        }}
      />
    </DesignShell>
  );
}
