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
    <section className="flex flex-col gap-3 panel p-6">
      <h2 className="display text-lg font-semibold text-amber-300">Preferences</h2>
      <p className="text-sm text-slate-400">
        How much detail the AI Guide and readings give by default. You can
        still change it for a single question. If a topic keeps coming up in
        your saved questions, the home page can point it out; untick the box
        to switch that off.
      </p>
      <PreferencesForm
        depth={preferences.explanation_depth}
        patternDetection={preferences.pattern_detection}
      />
    </section>
  );
}
