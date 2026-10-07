import type { TransitReport } from "@/lib/types";

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Mirrors `VedicChartResult`: renders exactly what the backend returned,
 * no interpretation. See that component's docstring for why. */
export function TransitResult({ report }: { report: TransitReport }) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">
          Current transits (Gochar)
        </h2>
        <span className="text-xs text-slate-500">
          as of {formatMoment(report.snapshot.moment)}
        </span>
      </header>

      {report.unavailable.length > 0 && (
        <p className="text-sm text-slate-500">
          Unavailable: {report.unavailable.join(", ")}.
        </p>
      )}

      <p className="text-sm text-slate-300">
        <span className="text-slate-500">Natal Ascendant: </span>
        {report.natal_ascendant_rashi ?? "unavailable"} ·{" "}
        <span className="text-slate-500">Natal Moon rashi: </span>
        {report.natal_moon_rashi ?? "unavailable"}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Graha</th>
              <th className="py-2 pr-4 font-medium">Transiting rashi</th>
              <th className="py-2 pr-4 font-medium">Natal rashi</th>
              <th className="py-2 pr-4 font-medium">Bhava (from Lagna)</th>
              <th className="py-2 pr-4 font-medium">Bhava (from Moon)</th>
              <th className="py-2 pr-4 font-medium">Separation</th>
              <th className="py-2 font-medium">Returned to natal rashi</th>
            </tr>
          </thead>
          <tbody>
            {report.transits.map((item) => (
              <tr
                key={item.graha}
                className="border-b border-slate-800/60 text-slate-300"
              >
                <td className="py-2 pr-4 font-medium text-slate-100">
                  {item.graha}
                </td>
                <td className="py-2 pr-4">
                  {item.transit.rashi}
                  {item.transit.retrograde && (
                    <span className="ml-1 text-xs text-amber-400">(Rx)</span>
                  )}
                </td>
                <td className="py-2 pr-4">{item.natal_rashi}</td>
                <td className="py-2 pr-4">
                  {item.bhava_from_ascendant ?? "—"}
                </td>
                <td className="py-2 pr-4">{item.bhava_from_moon ?? "—"}</td>
                <td className="py-2 pr-4">
                  {item.separation_from_natal.toFixed(1)}°
                </td>
                <td className="py-2">{item.in_natal_rashi ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
