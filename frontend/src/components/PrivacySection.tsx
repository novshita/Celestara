import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { getSessionToken } from "@/lib/session";

/** Product spec §29: privacy and data control. */
export async function PrivacySection() {
  if (!(await getSessionToken())) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-red-900/50 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-red-300">Delete my data</h2>
      <p className="text-sm text-slate-400">
        Permanently deletes your account, birth profile, journal, memory and
        saved conversations. This happens immediately and cannot be undone.
      </p>
      <DeleteAccountForm />
    </section>
  );
}
