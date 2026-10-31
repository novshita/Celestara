import type { Metadata } from "next";

import { LoginRequired } from "@/components/LoginRequired";
import { PageHeading } from "@/components/PageHeading";
import { ProfileSection } from "@/components/ProfileSection";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Profile · Celestara" };

export default async function ProfilePage() {
  const loggedIn = Boolean(await getSessionToken());

  return (
    <>
      <PageHeading title="Profile" />
      {loggedIn ? <ProfileSection /> : <LoginRequired feature="a saved profile" />}
    </>
  );
}
