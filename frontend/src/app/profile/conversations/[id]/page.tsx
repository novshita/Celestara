import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/components/ConversationsSection";
import { LoginRequired } from "@/components/LoginRequired";
import { PageHeading } from "@/components/PageHeading";
import { getConversation } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Conversation · Celestara" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return (
      <>
        <PageHeading title="Conversation" />
        <LoginRequired feature="saved conversations" />
      </>
    );
  }

  const conversationId = Number(id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    notFound();
  }
  const conversation = await getConversation(token, conversationId);
  if (!conversation) {
    notFound();
  }

  return (
    <>
      <PageHeading title={conversation.title} />
      <p className="text-sm text-slate-500">
        <Link href="/profile" className="transition hover:text-slate-300">
          ← Back to profile
        </Link>{" "}
        · {formatDate(conversation.created_at)}
      </p>
      <ol className="flex flex-col gap-3">
        {conversation.messages.map((message) => (
          <li
            key={message.id}
            className={
              message.role === "user"
                ? "self-end rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3"
                : "rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3"
            }
          >
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              {message.role === "user" ? "You" : "Guide"}
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-200">
              {message.content}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
