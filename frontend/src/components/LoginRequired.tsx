import { AuthForms } from "@/components/AuthForms";

/**
 * What a page that needs an account shows to someone who is not logged in.
 * Product spec §28: nothing else on the site needs an account; only what is
 * saved (profile, journal) does.
 */
export function LoginRequired({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Log in or create an account to use {feature}. Everything else on
        Celestara works without one.
      </p>
      <AuthForms />
    </div>
  );
}
