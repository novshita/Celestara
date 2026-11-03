import Link from "next/link";

import {
  deleteAllConversationsAction,
  deleteConversationAction,
} from "@/app/account-actions";
import { listConversations } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Past AI Guide conversations (logged-in users only; crisis and declined
 * exchanges are never saved). */
export async function ConversationsSection() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }
  const conversations = await listConversations(token);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-amber-300">Past conversations</h2>

      {conversations.length === 0 ? (
        <p className="text-sm text-slate-500">
          Conversations with the AI Guide are saved here while you are logged in.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 px-3 py-2"
            >
              <Link
                href={`/profile/conversations/${conversation.id}`}
                className="min-w-0 flex-1 truncate text-sm text-slate-200 transition hover:text-amber-300"
              >
                {conversation.title}
              </Link>
              <span className="text-xs text-slate-500">
                {formatDate(conversation.updated_at)}
              </span>
              <form action={deleteConversationAction}>
                <input type="hidden" name="conversation_id" value={conversation.id} />
                <button
                  type="submit"
                  className="text-sm text-red-400 transition hover:text-red-300"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {conversations.length > 0 && (
        <form action={deleteAllConversationsAction}>
          <button
            type="submit"
            className="text-sm text-red-400 transition hover:text-red-300"
          >
            Delete all conversations
          </button>
        </form>
      )}
    </section>
  );
}
