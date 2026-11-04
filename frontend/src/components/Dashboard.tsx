import Link from "next/link";

import { getDashboard, suggestedQuestions } from "@/lib/dashboard";
import type { BirthData } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Product spec §9: current transit, Dasha context and suggested questions,
 * layered under the birth-chart entry point. Everything shown was calculated
 * for the saved birth data; nothing here is interpretation.
 */
export async function Dashboard({ birth }: { birth: BirthData }) {
  const data = await getDashboard(birth);
  if (!data) {
    return null;
  }
  const questions = suggestedQuestions(data);

  return (
    <section
      aria-label="Your dashboard"
      className="grid gap-4 panel p-6 md:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Dasha now
        </h2>
        {data.dasha.length > 0 ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              {data.dasha.slice(0, 2).map((period, index) => (
                <span key={`${period.level}-${period.lord}`}>
                  {index > 0 && <span className="text-slate-600">→ </span>}
                  <span className="rounded bg-slate-800 px-2 py-1">
                    {period.lord}
                    <span className="ml-1 text-xs text-slate-500">
                      ({period.level})
                    </span>
                  </span>
                </span>
              ))}
            </p>
            <p className="text-xs text-slate-500">
              The {data.dasha[0].lord} period runs{" "}
              {formatDate(data.dasha[0].start)} to {formatDate(data.dasha[0].end)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No active period reported.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          The sky now
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-slate-300">
          {data.transits.map((item) => (
            <li key={item.graha}>
              <span className="font-medium text-slate-100">{item.graha}</span> in{" "}
              {item.transit.rashi}
              {item.transit.retrograde && (
                <span className="ml-1 text-xs text-amber-400">(Rx)</span>
              )}
              {item.bhava_from_moon !== null && (
                <span className="text-slate-500">
                  {" "}
                  · house {item.bhava_from_moon} from your Moon
                </span>
              )}
            </li>
          ))}
        </ul>
        <Link
          href="/chart"
          className="text-xs text-slate-500 transition hover:text-slate-300"
        >
          All transits on the Birth Chart page →
        </Link>
      </div>

      <div className="flex flex-col gap-2 md:col-span-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Ask the guide
        </h2>
        <ul className="flex flex-wrap gap-2">
          {questions.map((question) => (
            <li key={question}>
              <Link
                href={`/?q=${encodeURIComponent(question)}#ask`}
                className="inline-block rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-amber-400/60 hover:text-amber-300"
              >
                {question}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
