import type { WesternChart } from "@/lib/types";

/** Mirrors `VedicChartResult`: renders exactly what the backend returned,
 * no interpretation. See that component's docstring for why. */
export function WesternChartResult({ chart }: { chart: WesternChart }) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">
          Western natal chart
        </h2>
        <span className="text-xs text-slate-500">
          {chart.metadata.engine_id} · v{chart.metadata.calculation_version} ·{" "}
          {chart.metadata.house_system} houses
        </span>
      </header>

      {chart.metadata.moment.assumptions.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          {chart.metadata.moment.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      )}

      {chart.angles ? (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Ascendant: </span>
          {chart.angles.ascendant_sign}{" "}
          {chart.angles.ascendant_degrees.toFixed(2)}° · ruler{" "}
          {chart.angles.ascendant_ruler} ·{" "}
          <span className="text-slate-500">Midheaven: </span>
          {chart.angles.midheaven_sign}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Angles unavailable - {chart.metadata.unavailable.join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Body</th>
              <th className="py-2 pr-4 font-medium">Sign</th>
              <th className="py-2 pr-4 font-medium">Degrees</th>
              <th className="py-2 pr-4 font-medium">House</th>
              <th className="py-2 font-medium">Retrograde</th>
            </tr>
          </thead>
          <tbody>
            {chart.positions.map((position) => (
              <tr
                key={position.body}
                className="border-b border-slate-800/60 text-slate-300"
              >
                <td className="py-2 pr-4 font-medium text-slate-100">
                  {position.body}
                </td>
                <td className="py-2 pr-4">
                  {position.sign}
                  {position.uncertain && (
                    <span className="ml-1 text-xs text-amber-400">
                      (uncertain)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {position.degrees_in_sign.toFixed(2)}°
                </td>
                <td className="py-2 pr-4">{position.house ?? "—"}</td>
                <td className="py-2">{position.retrograde ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chart.aspects.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-slate-400">Aspects</h3>
          <ul className="flex flex-col gap-1 text-sm text-slate-300">
            {chart.aspects.map((aspect) => (
              <li key={`${aspect.first}-${aspect.second}-${aspect.aspect}`}>
                {aspect.first} {aspect.aspect} {aspect.second}
                <span className="text-slate-500">
                  {" "}
                  (orb {Math.abs(aspect.orb).toFixed(2)}°,{" "}
                  {aspect.applying ? "applying" : "separating"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
