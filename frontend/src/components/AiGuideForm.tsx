"use client";

import { useEffect, useRef, useState } from "react";

import { askAiGuideAction, type AiChatFormState } from "@/app/ai-actions";
import { AiThinking } from "@/components/AiThinking";
import { AnswerFactorsPanel } from "@/components/AnswerFactorsPanel";
import { BirthFieldsFieldset } from "@/components/BirthFieldsFieldset";
import { DepthSelect } from "@/components/DepthSelect";
import { Field } from "@/components/Field";
import type { AiSystem, BirthData } from "@/lib/types";
import { useKeptFormAction } from "@/lib/useKeptFormAction";

const INITIAL_STATE: AiChatFormState = { status: "idle" };

const SYSTEM_OPTIONS: { value: AiSystem; label: string }[] = [
  { value: "vedic", label: "Vedic (Rashi / D1)" },
  { value: "western", label: "Western (Tropical)" },
  { value: "compare", label: "Compare both" },
];

export function AiGuideForm({
  defaults,
  initialQuestion,
}: {
  defaults?: BirthData;
  initialQuestion?: string;
}) {
  const [state, onSubmit, isPending] = useKeptFormAction(
    askAiGuideAction,
    INITIAL_STATE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  // The birth data stays for the next question; the answered question does
  // not (a failed one stays, so it can be sent again).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status !== "success") return;
    const question = formRef.current?.elements.namedItem("question");
    if (question instanceof HTMLTextAreaElement) question.value = "";
  }, [state]);

  // A saved answer names the conversation the next question continues. The
  // visitor can start afresh, which just means not sending that id: the
  // state they dismissed is remembered, so the next answer starts a new one.
  const [dismissed, setDismissed] = useState<typeof state | null>(null);
  const conversationId =
    state.status === "success" && state !== dismissed
      ? state.conversationId
      : null;

  return (
    <section id="ask" className="flex scroll-mt-4 flex-col gap-6 panel p-6">
      <div>
        <h2 className="display text-lg font-semibold text-amber-300">
          Ask the AI Guide
        </h2>
        <p className="text-sm text-slate-500">
          The calculated chart below is given to the AI as-is - it
          interprets, it never recalculates. Offered for reflection, not as
          scientifically validated prediction, and not a substitute for
          medical, legal, or financial advice.
        </p>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-300">
          {SYSTEM_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="system"
                value={option.value}
                defaultChecked={option.value === "vedic"}
                className="accent-amber-400"
              />
              {option.label}
            </label>
          ))}
        </div>

        <BirthFieldsFieldset fieldErrors={fieldErrors} defaults={defaults} />

        <DepthSelect />

        {conversationId !== null && (
          <>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <p className="flex items-center gap-3 text-sm text-slate-400">
              Continuing your saved conversation - the guide remembers what
              you have asked so far.
              <button
                type="button"
                onClick={() => setDismissed(state)}
                className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-500"
              >
                Start a new one
              </button>
            </p>
          </>
        )}

        <Field label="Your question" error={fieldErrors["question"]}>
          <textarea
            name="question"
            defaultValue={initialQuestion}
            required
            rows={3}
            maxLength={2000}
            placeholder="What does my Moon's nakshatra suggest about my temperament?"
            className="input"
          />
        </Field>

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-amber-400 px-5 py-2 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Asking…" : "Ask"}
        </button>

        {isPending && <AiThinking label="Connecting your chart to your question…" />}

        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {state.message}
          </p>
        )}
      </form>

      {state.status === "success" && <AiAnswer state={state} />}
    </section>
  );
}

function AiAnswer({
  state,
}: {
  state: Extract<AiChatFormState, { status: "success" }>;
}) {
  const isCrisis = state.safetyFlags.includes("crisis");
  const wasReplaced = state.safetyFlags.some((flag) => flag !== "crisis");

  return (
    <div
      role="status"
      className={
        isCrisis
          ? "reveal flex flex-col gap-2 rounded-md border border-sky-800/60 bg-sky-950/30 p-4"
          : "reveal flex flex-col gap-3 rounded-md border border-amber-900/40 bg-amber-950/20 p-4"
      }
    >
      <p className="whitespace-pre-wrap text-sm text-slate-100">
        {state.answer}
      </p>

      {state.notice && (
        <p className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
          {state.notice}
        </p>
      )}

      {wasReplaced && (
        <p className="text-xs text-slate-500">
          The original answer could not be shown safely, so this standard
          response is shown instead.
        </p>
      )}

      {state.sessionExpired && (
        <p className="text-xs text-amber-400">
          Your session has expired, so you were logged out and this answer was
          not saved. Log in again to keep your conversations.
        </p>
      )}

      <AnswerFactorsPanel factors={state.factors} depth={state.depth} />

      <span className="text-xs text-slate-500">
        {state.model === null
          ? "Standard response - not generated by the AI"
          : `${state.systemUsed} · ${state.model}`}
      </span>
    </div>
  );
}
