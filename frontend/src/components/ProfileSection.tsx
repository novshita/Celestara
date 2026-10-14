import { ProfileForm } from "@/components/ProfileForm";
import { getProfile } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

/**
 * Reads the session cookie and, if logged in, the saved birth profile -
 * both at request time, so this (like `AccountBar`) opts the route into
 * dynamic rendering. Self-hides when logged out rather than requiring the
 * caller to check first: product spec §28 says an account is only useful
 * once you want to save something, so there is nothing to show here until
 * then.
 */
export async function ProfileSection() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const profile = await getProfile(token);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-amber-300">
        Saved birth profile
      </h2>

      {profile ? (
        <p className="text-sm text-slate-400">
          Currently saved: {profile.birth.birth_date}
          {profile.birth.birth_time ? ` ${profile.birth.birth_time}` : ""} at{" "}
          {profile.birth.latitude}, {profile.birth.longitude}
          {profile.birth.timezone_name
            ? ` (${profile.birth.timezone_name})`
            : ""}
          . Edit below to replace it.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          No profile saved yet - fill in the fields below and save, so you
          don&apos;t have to re-enter birth data every time.
        </p>
      )}

      <ProfileForm defaults={profile?.birth} />
    </section>
  );
}
