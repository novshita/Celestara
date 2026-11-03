import { PreferencesForm } from "@/components/PreferencesForm";
import { getPreferences } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

/** Product spec §24: beginner-friendly by default, technical on request. The
 * saved choice is what the Guide and readings use unless a request overrides
 * it. */
export async function PreferencesSection() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }
  const preferences = await getPreferences(token);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-amber-300">Preferences</h2>
      <p className="text-sm text-slate-400">
        How much detail the AI Guide and readings give by default. You can
        still change it for a single question.
      </p>
      <PreferencesForm depth={preferences.explanation_depth} />
    </section>
  );
}
