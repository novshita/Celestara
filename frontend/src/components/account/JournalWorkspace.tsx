"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  createEntryAction,
  deleteEntryAction,
  updateEntryAction,
  type JournalFormState,
} from "@/app/journal-actions";
import {
  NEW_ENTRY,
  chooseEntry,
  isDirty,
  shortDate,
  shownDraft,
  withDraft,
  withoutDraft,
  type Drafts,
} from "@/lib/account";
import type { JournalEntry } from "@/lib/types";

import { useToast } from "./Toast";

type Saved = JournalFormState & { savedId?: number };
const IDLE: Saved = { status: "idle" };

/**
 * The signed-in Journal page (design/Celestara Account.html): the entries down one side and the
 * one being written beside them. Edits are kept for each entry until it is saved, so moving to
 * another entry (or starting a new one) never loses what was typed, and an entry with unsaved
 * edits says so in the list. A new entry carries the Moon's sign from the sky now; a saved entry
 * does not, because the sky it was written under was not kept.
 */
export function JournalWorkspace({
  email,
  entries,
  moonSign,
}: {
  email: string;
  entries: JournalEntry[];
  /** The Moon's Vedic sign now, or null when the sky could not be loaded. */
  moonSign: string | null;
}) {
  const { show, toast } = useToast();
  const [wanted, setWanted] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const title = useRef<HTMLInputElement>(null);
  const listTop = useRef<HTMLButtonElement>(null);

  const activeId = creating ? NEW_ENTRY : chooseEntry(entries, wanted);
  const entry = entries.find((e) => e.id === activeId);
  const showEditor = creating || entry !== undefined;
  const draft = shownDraft(entry, drafts);
  const dirty = isDirty(entry, drafts);

  const [state, save, saving] = useActionState(
    async (previous: Saved, formData: FormData): Promise<Saved> => {
      const id = Number(formData.get("entry_id")) || NEW_ENTRY;
      const result = id === NEW_ENTRY ? await createEntryAction(previous, formData) : await updateEntryAction(previous, formData);
      if (result.status !== "success") return result;
      const savedId = id === NEW_ENTRY ? (result.id ?? NEW_ENTRY) : id;
      setDrafts((current) => withoutDraft(current, id));
      if (id === NEW_ENTRY) {
        setCreating(false);
        setWanted(savedId);
      }
      return { ...result, savedId };
    },
    IDLE,
  );
  const errors = state.status === "error" ? state.fieldErrors : {};
  const justSaved = state.status === "success" && state.savedId === activeId && !dirty;

  // Starting a new entry puts the cursor in its title
  useEffect(() => {
    if (creating) title.current?.focus();
  }, [creating]);

  function edit(next: Partial<{ title: string; body: string }>) {
    setDrafts((current) => withDraft(current, entry, { ...shownDraft(entry, current), ...next }));
  }

  function choose(id: number) {
    setCreating(false);
    setConfirming(false);
    setWanted(id);
  }

  function startNew() {
    setConfirming(false);
    setCreating(true);
  }

  function discardNew() {
    setDrafts((current) => withoutDraft(current, NEW_ENTRY));
    setCreating(false);
    setConfirming(false);
    listTop.current?.focus();
  }

  function remove() {
    if (!entry) return;
    const formData = new FormData();
    formData.set("entry_id", String(entry.id));
    startDelete(async () => {
      await deleteEntryAction(formData);
      setDrafts((current) => withoutDraft(current, entry.id));
      setConfirming(false);
      show("Entry deleted.");
      listTop.current?.focus();
    });
  }

  const edited = entry && shortDate(entry.updated_at) !== shortDate(entry.created_at);

  return (
    <main className="ac">
      <div className="ac-eyebrow cx-mono"><span>Signed in as {email}</span></div>
      <h1>Journal</h1>
      <p className="ac-lede">Write what you notice. Entries are saved to your account.</p>

      <div className="ac-jlay">
        <div>
          <div className="ac-jh">
            <span className="cx-mono" style={{ color: "var(--gold)" }}>Entries</span>
            <button type="button" className="ac-go" onClick={startNew} style={{ minHeight: 44, padding: "0 18px" }}>
              New entry
            </button>
          </div>
          <div>
            {creating && (
              <button type="button" className="ac-ent" aria-pressed="true" onClick={() => setCreating(true)}>
                <b>{drafts[NEW_ENTRY]?.title.trim() || "New entry"}{isDirty(undefined, drafts) && <em className="ac-unsaved">Unsaved</em>}</b>
                <small>Not saved yet</small>
              </button>
            )}
            {entries.map((item, index) => {
              const shown = shownDraft(item, drafts);
              return (
                <button
                  key={item.id}
                  ref={index === 0 ? listTop : undefined}
                  type="button"
                  className="ac-ent"
                  aria-pressed={!creating && item.id === activeId}
                  onClick={() => choose(item.id)}
                >
                  <b>{shown.title.trim() || "Untitled"}{isDirty(item, drafts) && <em className="ac-unsaved">Unsaved</em>}</b>
                  <small>{shortDate(item.created_at)}</small>
                  <span>{shown.body}</span>
                </button>
              );
            })}
          </div>
        </div>

        {showEditor ? (
          <form className="ac-editor" action={save} aria-label={entry ? "Edit entry" : "New entry"}>
            <input type="hidden" name="entry_id" value={entry ? entry.id : NEW_ENTRY} />
            <div className="ac-dline">
              <i className="ac-moon" />
              <span>{entry ? (edited ? `${shortDate(entry.created_at)} · edited ${shortDate(entry.updated_at)}` : shortDate(entry.created_at)) : "New entry"}</span>
              {!entry && moonSign && (
                <>
                  <span className="cx-tag">The sky now</span>
                  <span>Moon in {moonSign} (Vedic)</span>
                </>
              )}
            </div>
            <input
              ref={title}
              className="ac-tin"
              type="text"
              name="title"
              maxLength={200}
              placeholder="Give it a title"
              aria-label="Entry title"
              aria-invalid={Boolean(errors["title"])}
              value={draft.title}
              onChange={(e) => edit({ title: e.target.value })}
            />
            {errors["title"] && <p className="ac-err" role="alert">{errors["title"]}</p>}
            <textarea
              name="body"
              maxLength={20000}
              placeholder="What did you notice today?"
              aria-label="Entry text"
              aria-invalid={Boolean(errors["body"])}
              value={draft.body}
              onChange={(e) => edit({ body: e.target.value })}
            />
            {errors["body"] && <p className="ac-err" role="alert">{errors["body"]}</p>}
            {state.status === "error" && !Object.keys(errors).length && <p className="ac-err" role="alert">{state.message}</p>}

            <div className="ac-jfoot">
              <div className="ac-jbtns">
                {confirming ? (
                  <>
                    <span style={{ fontSize: 15, color: "var(--ink2)" }} role="alert">Delete this entry?</span>
                    <button type="button" className="ac-go ac-bad" onClick={remove} disabled={deleting}>Delete</button>
                    <button type="button" className="ac-ghost" onClick={() => setConfirming(false)} autoFocus>Keep</button>
                  </>
                ) : (
                  <>
                    <button className="ac-go" type="submit" disabled={saving} aria-busy={saving}>
                      {saving ? "Saving…" : "Save entry"}
                    </button>
                    <button type="button" className="ac-ghost" onClick={() => (entry ? setConfirming(true) : discardNew())}>
                      {entry ? "Delete" : "Discard"}
                    </button>
                    <span className={`ac-ok${justSaved ? " ac-on" : ""}`} role="status">{justSaved ? "Saved" : ""}</span>
                  </>
                )}
              </div>
              <span className="ac-note">Reflective, not predictive: a place to note what you notice, not a log of forecasts.</span>
            </div>
          </form>
        ) : (
          <p className="ac-empty">No entries yet. Press New entry to write the first one.</p>
        )}
      </div>
      {toast}
    </main>
  );
}
