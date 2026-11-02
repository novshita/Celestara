import type { AnswerFactors, ExplanationDepth, FactKind } from "@/lib/types";

const KIND_LABEL: Record<FactKind, string> = {
  natal_chart: "Your natal chart",
  transits: "Current transits",
  period_changes: "Changes in the period",
  dasha: "Vimshottari Dasha",
  unavailable: "Not available",
};

/**
 * Product spec §23: every interpretation keeps four things apart, and this
 * panel shows them as such - the calculated facts, the traditional knowledge
 * drawn on, what was specific to this person, and (the answer itself, above
 * it) the AI's own explanation. Collapsed by default: technical detail is
 * there on request, not in the way (spec §24).
 */
export function AnswerFactorsPanel({
  factors,
  depth,
}: {
  factors: AnswerFactors;
  depth: ExplanationDepth;
}) {
  // Fixed responses (a crisis, a declined request) are not built from
  // anything, so there is nothing honest to show.
  if (factors.calculated.length === 0 && factors.knowledge.length === 0) {
    return null;
  }

  const personal = factors.memory_used > 0 || factors.history_turns > 0;

  return (
    <details className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
        How this was built
      </summary>

      <div className="mt-3 flex flex-col gap-4 text-slate-300">
        <section className="flex flex-col gap-2">
          <h4 className="font-medium text-amber-300">
            Calculated facts
            <span className="ml-2 font-normal text-slate-500">
              from the chart engine - the AI did not calculate these
            </span>
          </h4>
          {factors.calculated.map((group) => (
            <div key={group.kind}>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {KIND_LABEL[group.kind]}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-400">
                {group.facts.map((fact, index) => (
                  <li key={index}>{fact}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {factors.knowledge.length > 0 && (
          <section className="flex flex-col gap-1">
            <h4 className="font-medium text-amber-300">
              Traditional knowledge
              <span className="ml-2 font-normal text-slate-500">
                curated reference entries
              </span>
            </h4>
            <ul className="text-xs text-slate-400">
              {factors.knowledge.map((entry) => (
                <li key={entry.id}>
                  {entry.title}{" "}
                  <span className="text-slate-600">v{entry.version}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {personal && (
          <section className="flex flex-col gap-1">
            <h4 className="font-medium text-amber-300">About you</h4>
            <p className="text-xs text-slate-400">
              {factors.memory_used > 0 &&
                `${factors.memory_used} ${
                  factors.memory_used === 1 ? "memory" : "memories"
                } you chose to keep. `}
              {factors.history_turns > 0 &&
                `${factors.history_turns} earlier ${
                  factors.history_turns === 1 ? "turn" : "turns"
                } of this conversation.`}
            </p>
          </section>
        )}

        <p className="text-xs text-slate-500">
          Explanation depth: {depth}. The answer above is the AI&apos;s
          interpretation of these facts, offered for reflection.
        </p>
      </div>
    </details>
  );
}
