import { DashaTimeline } from "@/components/DashaTimeline";
import type { VimshottariResponse } from "@/lib/types";

/** Mirrors `VedicChartResult`: renders exactly what the backend returned,
 * no interpretation. See that component's docstring for why. */
export function DashaResult({ dasha }: { dasha: VimshottariResponse }) {
  const { timeline, active_now } = dasha;

  return (
    <section className="flex flex-col gap-6 panel reveal p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-lg font-semibold text-amber-300">
          Vimshottari Dasha
        </h2>
        <span className="text-xs text-slate-500">
          starting lord {timeline.starting_lord} · balance{" "}
          {timeline.balance_years.toFixed(2)}y
        </span>
      </header>

      {timeline.moment.assumptions.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          {timeline.moment.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      )}

      {timeline.uncertainty_days > 0 && (
        <p className="text-sm text-amber-300">
          Period boundaries could shift by up to{" "}
          {timeline.uncertainty_days.toFixed(1)} days given the birth-time
          uncertainty.
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-400">
          Active now
        </h3>
        {active_now.length > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            {active_now.map((period, index) => (
              <span key={`${period.level}-${period.lord}-${period.start}`}>
                {index > 0 && <span className="text-slate-600"> → </span>}
                <span className="rounded bg-slate-800 px-2 py-1">
                  {period.lord}
                  <span className="ml-1 text-xs text-slate-400">
                    ({period.level})
                  </span>
                </span>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            The requested moment falls outside the generated cycle.
          </p>
        )}
      </div>

      <DashaTimeline
        periods={timeline.periods}
        active={active_now}
        asOf={dasha.as_of}
      />

      <p className="text-xs text-slate-600">
        Choose a Mahadasha to see its Antardashas. The bar is drawn to scale.
      </p>
    </section>
  );
}
