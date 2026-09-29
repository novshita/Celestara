import type { ChartComparison } from "@/lib/types";

/**
 * Product spec §6: Compare is not a side-by-side chart viewer, it explains
 * *why* the two systems disagree. Every row here traces back to one number -
 * the ayanamsa - which is why that number is shown once, up top, rather than
 * repeated per row: it is the single cause, not a per-body coincidence.
 * Neither system is presented as more accurate than the other.
 */
export function CompareResult({
  comparison,
}: {
  comparison: ChartComparison;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">
          Vedic ↔ Western comparison
        </h2>
        <span className="text-xs text-slate-500">
          ayanamsa {comparison.metadata.ayanamsa_degrees.toFixed(4)}°
        </span>
      </header>

      <p className="text-sm text-slate-400">
        Every disagreement below comes from this one offset between the
        sidereal and tropical zodiacs - not from the two systems being
        differently accurate.
      </p>

      {comparison.ascendant ? (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Ascendant: </span>
          {comparison.ascendant.vedic_rashi} (Vedic) vs.{" "}
          {comparison.ascendant.western_sign} (Western) ·{" "}
          {comparison.ascendant.signs_apart} sign
          {comparison.ascendant.signs_apart === 1 ? "" : "s"} apart
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Ascendant unavailable - {comparison.metadata.unavailable.join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Body</th>
              <th className="py-2 pr-4 font-medium">Vedic rashi</th>
              <th className="py-2 pr-4 font-medium">Western sign</th>
              <th className="py-2 font-medium">Signs apart</th>
            </tr>
          </thead>
          <tbody>
            {comparison.shared_bodies.map((body) => (
              <tr
                key={body.body}
                className="border-b border-slate-800/60 text-slate-300"
              >
                <td className="py-2 pr-4 font-medium text-slate-100">
                  {body.body}
                </td>
                <td className="py-2 pr-4">
                  {body.vedic_rashi} {body.vedic_degrees_in_rashi.toFixed(2)}°
                  {body.vedic_uncertain && (
                    <span className="ml-1 text-xs text-amber-400">
                      (uncertain)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {body.western_sign} {body.western_degrees_in_sign.toFixed(2)}°
                  {body.western_uncertain && (
                    <span className="ml-1 text-xs text-amber-400">
                      (uncertain)
                    </span>
                  )}
                </td>
                <td className="py-2">{body.signs_apart}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
