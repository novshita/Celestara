import {
  deleteMemoryAction,
  forgetAllMemoriesAction,
} from "@/app/account-actions";
import { AddMemoryForm } from "@/components/AddMemoryForm";
import { listMemories } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

const KIND_LABEL = { note: "Note", preference: "Preference" } as const;

/** Product spec §19: memory is persistent but user-controlled. Nothing is
 * remembered unless added here, and everything can be forgotten. */
export async function MemorySection() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }
  const memories = await listMemories(token);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-amber-300">What the guide remembers</h2>
      <p className="text-sm text-slate-400">
        Only what you add here. The guide treats it as background about you,
        never as instructions, and you can forget any of it at any time.
      </p>

      {memories.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing remembered yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-800 px-3 py-2"
            >
              <p className="text-sm text-slate-200">
                <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">
                  {KIND_LABEL[memory.kind]}
                </span>
                {memory.content}
              </p>
              <form action={deleteMemoryAction}>
                <input type="hidden" name="memory_id" value={memory.id} />
                <button
                  type="submit"
                  className="text-sm text-red-400 transition hover:text-red-300"
                >
                  Forget
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <AddMemoryForm />

      {memories.length > 0 && (
        <form action={forgetAllMemoriesAction}>
          <button
            type="submit"
            className="text-sm text-red-400 transition hover:text-red-300"
          >
            Forget everything
          </button>
        </form>
      )}
    </section>
  );
}
