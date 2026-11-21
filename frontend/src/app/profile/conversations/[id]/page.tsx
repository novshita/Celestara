import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SignedOutHero } from "@/components/account/SignedOutHero";
import { DesignShell } from "@/components/chart/DesignShell";
import { shortDate } from "@/lib/account";
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
      <DesignShell current="profile">
        <main className="ac">
          <SignedOutHero view="conversation" />
        </main>
      </DesignShell>
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
    <DesignShell current="profile">
      <main className="ac">
        <Link className="ac-back" href="/profile">← Back to profile</Link>
        <h1 style={{ fontSize: "clamp(36px,4.6vw,60px)" }}>{conversation.title}</h1>
        <p className="ac-lede">{shortDate(conversation.created_at)}</p>
        <ol className="ac-msgs">
          {conversation.messages.map((message) => (
            <li key={message.id} className={`ac-msg${message.role === "user" ? " ac-me" : ""}`}>
              <h2>{message.role === "user" ? "You" : "Guide"}</h2>
              <p>{message.content}</p>
            </li>
          ))}
        </ol>
      </main>
    </DesignShell>
  );
}
