import { JournalEntryItem } from "@/components/JournalEntryItem";
import { JournalNewEntryForm } from "@/components/JournalNewEntryForm";
import { listJournalEntries } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

/**
 * Mirrors `ProfileSection`: reads the session token at request time and
 * self-hides when logged out, rather than requiring the caller to check
 * first.
 */
export async function JournalSection() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const entries = await listJournalEntries(token);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <div>
        <h2 className="text-lg font-semibold text-amber-300">Journal</h2>
        <p className="text-sm text-slate-500">
          Reflective, not predictive (product spec §16) - a place to note
          what you&apos;re noticing, not a log of forecasts.
        </p>
      </div>

      <JournalNewEntryForm />

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <JournalEntryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No entries yet.</p>
      )}
    </section>
  );
}
