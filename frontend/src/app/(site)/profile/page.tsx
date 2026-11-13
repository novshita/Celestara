import type { Metadata } from "next";

import { ConversationsSection } from "@/components/ConversationsSection";
import { LoginRequired } from "@/components/LoginRequired";
import { PageHeading } from "@/components/PageHeading";
import { MemorySection } from "@/components/MemorySection";
import { PreferencesSection } from "@/components/PreferencesSection";
import { PrivacySection } from "@/components/PrivacySection";
import { ProfileSection } from "@/components/ProfileSection";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Profile · Celestara" };

export default async function ProfilePage() {
  const loggedIn = Boolean(await getSessionToken());

  return (
    <>
      <PageHeading title="Profile" />
      {loggedIn ? (
        <>
          <ProfileSection />
          <PreferencesSection />
          <MemorySection />
          <ConversationsSection />
          <PrivacySection />
        </>
      ) : (
        <LoginRequired feature="a saved profile" />
      )}
    </>
  );
}
