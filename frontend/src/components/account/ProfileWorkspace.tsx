"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { useKeptFormAction } from "@/lib/useKeptFormAction";

import {
  addMemoryAction,
  deleteAccountAction,
  deleteAllConversationsAction,
  deleteConversationAction,
  deleteMemoryAction,
  forgetAllMemoriesAction,
  savePreferencesAction,
  type AccountFormState,
} from "@/app/account-actions";
import { saveProfileAction, type ProfileFormState } from "@/app/profile-actions";
import { DELETE_CONFIRMATION } from "@/lib/accountConfirm";
import {
  MAX_MEMORIES,
  TIME_CONFIDENCE_LABELS,
  birthGlance,
  calculationSummary,
  memoryMeter,
  shortDate,
} from "@/lib/account";
import type {
  BirthData,
  BirthTimeConfidence,
  ConversationSummary,
  ExplanationDepth,
  MemoryItem,
} from "@/lib/types";

import { ConfirmButton } from "./ConfirmButton";
import { useToast } from "./Toast";

const IDLE_PROFILE: ProfileFormState = { status: "idle" };
const IDLE_ACCOUNT: AccountFormState = { status: "idle" };

export interface ProfileData {
  email: string;
  birth: BirthData | null;
  depth: ExplanationDepth;
  patternDetection: boolean;
  calculationConfig: Record<string, unknown> | null;
  memories: MemoryItem[];
  conversations: ConversationSummary[];
}

/**
 * The signed-in Profile page (design/Celestara Account.html): a side list of sections and, beside
 * it, one section each for the birth profile, preferences, what the Guide remembers, saved
 * conversations and privacy. Each section saves on its own, and each delete is a separate action.
 */
export function ProfileWorkspace({ data }: { data: ProfileData }) {
  const { show, toast } = useToast();

  return (
    <main className="ac">
      <div className="ac-eyebrow cx-mono"><span>Signed in as {data.email}</span></div>
      <h1>Profile</h1>
      <p className="ac-lede">
        Your saved birth profile, preferences and what the Guide remembers. Each section saves on its own.
      </p>

      <div className="ac-ilay">
        <nav className="ac-side" aria-label="Profile sections">
          <a href="#birth">Birth profile</a>
          <a href="#preferences">Preferences</a>
          <a href="#memory">Guide memory</a>
          <a href="#conversations">Saved conversations</a>
          <a href="#privacy">Privacy and data</a>
          <div className="ac-glance">
            <span className="cx-mono" style={{ color: "var(--gold)" }}>Saved profile</span>
            <b>{data.birth ? birthGlance(data.birth) : "None yet"}</b>
            <Link href="/chart" style={{ padding: "8px 0", border: 0, color: "var(--gold)" }}>
              Open your birth chart →
            </Link>
          </div>
        </nav>

        <div>
          <BirthSection birth={data.birth} />
          <PreferencesSection depth={data.depth} patternDetection={data.patternDetection} config={data.calculationConfig} />
          <MemorySection memories={data.memories} />
          <ConversationsSection conversations={data.conversations} />
          <PrivacySection onDeleted={show} />
        </div>
      </div>
      {toast}
    </main>
  );
}

function Saved({ on }: { on: boolean }) {
  return (
    <span className={`ac-ok${on ? " ac-on" : ""}`} role="status">
      {on ? "Saved" : ""}
    </span>
  );
}

// ---- birth profile ---------------------------------------------------------------------------

function BirthSection({ birth }: { birth: BirthData | null }) {
  const [state, onSubmit, pending] = useKeptFormAction(saveProfileAction, IDLE_PROFILE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const [confidence, setConfidence] = useState<BirthTimeConfidence>(birth?.time_confidence ?? "EXACT");
  const timeUsable = confidence !== "UNKNOWN";

  return (
    <section className="ac-sect" id="birth" aria-labelledby="birth-title">
      <h2 id="birth-title">Birth profile</h2>
      <p className="ac-sub">One saved profile. The Birth Chart page can start from it.</p>
      <form className="ac-frm" onSubmit={onSubmit} aria-label="Birth profile">
        <Field label="Birth date" id="p-date" error={errors["birth.birth_date"]}>
          <input id="p-date" type="date" name="birth_date" required defaultValue={birth?.birth_date} aria-invalid={Boolean(errors["birth.birth_date"])} />
        </Field>
        <Field label="Birth time" id="p-time" error={errors["birth.birth_time"]} hint={!timeUsable ? "Not needed: the time is unknown." : undefined}>
          <input
            id="p-time"
            type="time"
            name="birth_time"
            step={1}
            disabled={!timeUsable}
            required={timeUsable}
            defaultValue={birth?.birth_time?.slice(0, 5)}
            aria-invalid={Boolean(errors["birth.birth_time"])}
          />
        </Field>
        <Field label="Time confidence" id="p-conf" full>
          <select id="p-conf" name="time_confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as BirthTimeConfidence)}>
            {(Object.keys(TIME_CONFIDENCE_LABELS) as BirthTimeConfidence[]).map((value) => (
              <option key={value} value={value}>{TIME_CONFIDENCE_LABELS[value]}</option>
            ))}
          </select>
        </Field>
        <Field label="Latitude" id="p-lat" error={errors["birth.latitude"]}>
          <input id="p-lat" type="number" name="latitude" step="any" min={-90} max={90} required placeholder="18.9756" defaultValue={birth?.latitude} aria-invalid={Boolean(errors["birth.latitude"])} />
        </Field>
        <Field label="Longitude" id="p-lon" error={errors["birth.longitude"]}>
          <input id="p-lon" type="number" name="longitude" step="any" min={-180} max={180} required placeholder="72.8258" defaultValue={birth?.longitude} aria-invalid={Boolean(errors["birth.longitude"])} />
        </Field>
        <Field label="Timezone" id="p-tz" full hint="Leave blank to detect it from the coordinates.">
          <input id="p-tz" type="text" name="timezone_name" placeholder="e.g. Asia/Kolkata" defaultValue={birth?.timezone_name ?? ""} />
        </Field>
        <div className="ac-full ac-saverow" style={{ marginTop: 4 }}>
          <button className="ac-go" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : birth ? "Save changes" : "Save profile"}
          </button>
          <Saved on={state.status === "success"} />
        </div>
        {state.status === "error" && <p className="ac-err ac-full" role="alert">{state.message}</p>}
      </form>
    </section>
  );
}

function Field({
  label,
  id,
  error,
  hint,
  full,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`ac-inp${full ? " ac-full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="ac-err" role="alert">{error}</p> : hint ? <p className="ac-hint">{hint}</p> : null}
    </div>
  );
}

// ---- preferences -----------------------------------------------------------------------------

function PreferencesSection({
  depth,
  patternDetection,
  config,
}: {
  depth: ExplanationDepth;
  patternDetection: boolean;
  config: Record<string, unknown> | null;
}) {
  const [state, onSubmit, pending] = useKeptFormAction(savePreferencesAction, IDLE_ACCOUNT);
  const summary = calculationSummary(config);

  return (
    <section className="ac-sect" id="preferences" aria-labelledby="prefs-title">
      <h2 id="prefs-title">Preferences</h2>
      <p className="ac-sub">How the Guide explains things. A request in the Guide wins over the saved depth.</p>
      <form onSubmit={onSubmit} aria-label="Preferences">
        <div className="ac-opts" role="radiogroup" aria-label="Explanation depth">
          <label className="ac-opt">
            <input type="radio" name="depth" value="beginner" defaultChecked={depth === "beginner"} />
            <span><b>Beginner</b>Plain language, the default.</span>
          </label>
          <label className="ac-opt">
            <input type="radio" name="depth" value="technical" defaultChecked={depth === "technical"} />
            <span><b>Technical</b>Degrees, ayanamsa and house system.</span>
          </label>
          <label className="ac-opt">
            <input type="checkbox" name="patternDetection" defaultChecked={patternDetection} />
            <span><b>Show themes in my questions</b>If a topic keeps coming up in your saved questions, Home can point it out.</span>
          </label>
        </div>
        <div className="ac-cfg">
          <span>Ayanamsa</span><span>{summary.ayanamsa}</span>
          <span>House system</span><span>{summary.houses}</span>
        </div>
        <div className="ac-saverow">
          <button className="ac-go" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Save preferences"}
          </button>
          <Saved on={state.status === "success"} />
        </div>
        {state.status === "error" && <p className="ac-err" role="alert">{state.message}</p>}
      </form>
    </section>
  );
}

// ---- Guide memory ----------------------------------------------------------------------------

const KIND_LABEL = { note: "Note", preference: "Preference" } as const;

function MemorySection({ memories }: { memories: MemoryItem[] }) {
  const meter = memoryMeter(memories.length);
  const formRef = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Kept on a failure (the words typed are still there to fix); emptied once they are saved
  const [state, onSubmit, pending] = useKeptFormAction(async (previous: AccountFormState, formData: FormData) => {
    const result = await addMemoryAction(previous, formData);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, IDLE_ACCOUNT);

  return (
    <section className="ac-sect" id="memory" aria-labelledby="memory-title">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 id="memory-title">Guide memory</h2>
        <span className="ac-note" style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".14em" }}>{meter.label}</span>
      </div>
      <p className="ac-sub">Only what you add here. Nothing is remembered on its own.</p>
      <div className="ac-bar" style={{ maxWidth: 620, margin: "0 0 14px" }} role="img" aria-label={`${meter.label} memories used`}>
        <i style={{ width: `${meter.percent}%` }} />
      </div>
      <div className="ac-list">
        {memories.length === 0 ? (
          <p className="ac-note" style={{ padding: "14px 0" }}>Nothing remembered yet.</p>
        ) : (
          memories.map((memory) => (
            <div className="ac-li" key={memory.id}>
              <span>{memory.content}<small>{KIND_LABEL[memory.kind]}</small></span>
              <form
                action={async (formData) => {
                  await deleteMemoryAction(formData);
                  input.current?.focus();
                }}
              >
                <input type="hidden" name="memory_id" value={memory.id} />
                <button type="submit" className="ac-lk ac-d" aria-label={`Forget: ${memory.content}`}>Forget</button>
              </form>
            </div>
          ))
        )}
      </div>
      <form className="ac-addrow" ref={formRef} onSubmit={onSubmit}>
        <div className="ac-inp ac-kind">
          <select name="kind" defaultValue="note" aria-label="Kind of memory">
            <option value="note">Note about me</option>
            <option value="preference">How I like answers</option>
          </select>
        </div>
        <div className="ac-inp">
          <input ref={input} type="text" name="content" required maxLength={500} placeholder="Add something for the Guide to keep" aria-label="Add a memory" />
        </div>
        <button className="ac-ghost" type="submit" disabled={pending || meter.full}>Add</button>
      </form>
      {meter.full && <p className="ac-hint">The Guide can keep up to {MAX_MEMORIES} things. Forget one to add another.</p>}
      {state.status === "error" && <p className="ac-err" role="alert">{state.message}</p>}
    </section>
  );
}

// ---- saved conversations ---------------------------------------------------------------------

function ConversationsSection({ conversations }: { conversations: ConversationSummary[] }) {
  const heading = useRef<HTMLHeadingElement>(null);

  return (
    <section className="ac-sect" id="conversations" aria-labelledby="conv-title">
      <h2 id="conv-title" ref={heading} tabIndex={-1}>Saved conversations</h2>
      <p className="ac-sub">Crisis messages and declined off-topic requests are never saved.</p>
      <div className="ac-list">
        {conversations.length === 0 ? (
          <p className="ac-note" style={{ padding: "14px 0" }}>
            No saved conversations. Conversations with the Guide are saved here while you are logged in.
          </p>
        ) : (
          conversations.map((conversation) => (
            <div className="ac-li" key={conversation.id}>
              <span className="ac-conv">{conversation.title}<small>{shortDate(conversation.updated_at)}</small></span>
              <span style={{ display: "flex", flex: "none", gap: 4 }}>
                <Link className="ac-lk" href={`/profile/conversations/${conversation.id}`} aria-label={`Read conversation: ${conversation.title}`} style={{ display: "inline-flex", alignItems: "center" }}>
                  Read
                </Link>
                <form
                  action={async (formData) => {
                    await deleteConversationAction(formData);
                    heading.current?.focus();
                  }}
                >
                  <input type="hidden" name="conversation_id" value={conversation.id} />
                  <button type="submit" className="ac-lk ac-d" aria-label={`Delete conversation: ${conversation.title}`}>Delete</button>
                </form>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ---- privacy and data ------------------------------------------------------------------------

function PrivacySection({ onDeleted }: { onDeleted: (message: string) => void }) {
  const [pending, start] = useTransition();
  const [typed, setTyped] = useState("");
  const [state, action, deleting] = useActionState(deleteAccountAction, IDLE_ACCOUNT);

  return (
    <section className="ac-sect" id="privacy" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Privacy and data</h2>
      <p className="ac-sub">Each delete is a single action, separate from the others.</p>
      <div className="ac-dz">
        <ConfirmButton
          label="Delete all memory"
          pending={pending}
          onConfirm={() => start(async () => { await forgetAllMemoriesAction(); onDeleted("All Guide memory deleted."); })}
        />
        <ConfirmButton
          label="Delete all conversations"
          pending={pending}
          onConfirm={() => start(async () => { await deleteAllConversationsAction(); onDeleted("All conversations deleted."); })}
        />
      </div>
      <form className="ac-danger2" action={action} aria-labelledby="delete-title">
        <h3 id="delete-title">Delete my data</h3>
        <p>
          Permanently erases your account and everything in it: profile, journal, memory and conversations. This happens
          immediately and cannot be undone. Type <b>{DELETE_CONFIRMATION}</b> to continue.
        </p>
        <div className="ac-row2">
          <div className="ac-inp">
            <input
              type="text"
              name="confirmation"
              autoComplete="off"
              placeholder={DELETE_CONFIRMATION}
              aria-label={`Type ${DELETE_CONFIRMATION} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <button type="submit" className="ac-go ac-bad" disabled={typed !== DELETE_CONFIRMATION || deleting} aria-busy={deleting}>
            {deleting ? "Deleting…" : "Delete my data"}
          </button>
        </div>
        {state.status === "error" && <p className="ac-err" role="alert">{state.message}</p>}
      </form>
    </section>
  );
}
