import type { DashaPeriod, VimshottariResponse } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Mirrors `VedicChartResult`: renders exactly what the backend returned,
 * no interpretation. See that component's docstring for why. */
export function DashaResult({ dasha }: { dasha: VimshottariResponse }) {
  const { timeline, active_now } = dasha;

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">
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
                  <span className="ml-1 text-xs text-slate-500">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Mahadasha lord</th>
              <th className="py-2 pr-4 font-medium">Start</th>
              <th className="py-2 pr-4 font-medium">End</th>
              <th className="py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {timeline.periods.map((period: DashaPeriod) => (
              <tr
                key={`${period.lord}-${period.start}`}
                className="border-b border-slate-800/60 text-slate-300"
              >
                <td className="py-2 pr-4 font-medium text-slate-100">
                  {period.lord}
                  {period.is_partial && (
                    <span className="ml-1 text-xs text-amber-400">
                      (partial)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{formatDate(period.start)}</td>
                <td className="py-2 pr-4">{formatDate(period.end)}</td>
                <td className="py-2">
                  {period.duration_years.toFixed(2)} years
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        Showing Mahadasha periods only. Each one subdivides further
        (Antardasha and beyond) in the underlying data.
      </p>
    </section>
  );
}
