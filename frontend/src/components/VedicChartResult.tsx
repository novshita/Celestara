import type { VedicChart } from "@/lib/types";

/**
 * Renders exactly what the backend returned - no interpretation, no
 * inferred meaning. Product spec §1: "The system calculates. The AI
 * interprets." There is no AI layer yet, so this component's only job is to
 * make the calculated facts legible, never to explain what they mean.
 */
export function VedicChartResult({ chart }: { chart: VedicChart }) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">
          Rashi (D1) chart
        </h2>
        <span className="text-xs text-slate-500">
          {chart.metadata.engine_id} · v{chart.metadata.calculation_version} ·
          ayanamsa {chart.metadata.ayanamsa_degrees.toFixed(4)}°
        </span>
      </header>

      {chart.metadata.moment.assumptions.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          {chart.metadata.moment.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      )}

      {chart.ascendant ? (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Ascendant (Lagna): </span>
          {chart.ascendant.rashi} {chart.ascendant.degrees_in_rashi.toFixed(2)}
          ° · {chart.ascendant.nakshatra.name} pada{" "}
          {chart.ascendant.nakshatra.pada} · lord {chart.ascendant.lord}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Ascendant unavailable - {chart.metadata.unavailable.join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Graha</th>
              <th className="py-2 pr-4 font-medium">Rashi</th>
              <th className="py-2 pr-4 font-medium">Degrees</th>
              <th className="py-2 pr-4 font-medium">Nakshatra</th>
              <th className="py-2 pr-4 font-medium">Pada</th>
              <th className="py-2 font-medium">Retrograde</th>
            </tr>
          </thead>
          <tbody>
            {chart.placements.map((placement) => (
              <tr
                key={placement.graha}
                className="border-b border-slate-800/60 text-slate-300"
              >
                <td className="py-2 pr-4 font-medium text-slate-100">
                  {placement.graha}
                </td>
                <td className="py-2 pr-4">
                  {placement.rashi}
                  {!placement.certainty.rashi_certain && (
                    <span className="ml-1 text-xs text-amber-400">
                      (uncertain)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {placement.degrees_in_rashi.toFixed(2)}°
                </td>
                <td className="py-2 pr-4">{placement.nakshatra.name}</td>
                <td className="py-2 pr-4">{placement.nakshatra.pada}</td>
                <td className="py-2">{placement.retrograde ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
