"use client";

import type { ChartFormState, ChartSystem } from "@/app/actions";
import { CompareResult } from "@/components/CompareResult";
import { DashaResult } from "@/components/DashaResult";
import { TransitResult } from "@/components/TransitResult";
import { VedicChartResult } from "@/components/VedicChartResult";
import { WesternChartResult } from "@/components/WesternChartResult";

import { LENSES, lensByKey } from "./lenses";

export type ChartSuccess = Extract<ChartFormState, { status: "success" }>;

/** One calculated view, drawn by the same components the app has always used. */
function ResultView({ result }: { result: ChartSuccess }) {
  switch (result.system) {
    case "vedic":
      return <VedicChartResult chart={result.chart} />;
    case "western":
      return <WesternChartResult chart={result.chart} />;
    case "compare":
      return <CompareResult comparison={result.comparison} />;
    case "dasha":
      return <DashaResult dasha={result.dasha} />;
    case "transit":
      return <TransitResult report={result.report} />;
  }
}

/**
 * The results chapter: a heading, one tab per lens, and the chosen lens's real result.
 * A tab whose view has not been calculated for these inputs calculates it when pressed
 * (the page re-submits the form with that lens); the others show at once.
 */
export function ChartResults({
  lens,
  results,
  stale,
  busy,
  onTab,
}: {
  lens: ChartSystem;
  results: Partial<Record<ChartSystem, ChartSuccess>>;
  stale: boolean;
  busy: boolean;
  onTab: (lens: ChartSystem) => void;
}) {
  const current = results[lens];

  return (
    <section id="results" aria-labelledby="rH" className="cx-results">
      <div className="cx-rh">
        <h2 id="rH">Your chart</h2>
        {stale && <span className="cx-tag">Inputs changed · calculate again</span>}
      </div>

      <div className="cx-tabs" role="group" aria-label="Result view">
        {LENSES.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={l.key === lens}
            data-selected={l.key === lens}
            disabled={busy}
            onClick={() => onTab(l.key)}
          >
            {l.tab}
          </button>
        ))}
      </div>

      <div className="cx-panel" aria-busy={busy}>
        {current ? (
          <ResultView result={current} />
        ) : (
          <p className="cx-empty">
            {busy
              ? `Calculating ${lensByKey(lens).name}…`
              : `The ${lensByKey(lens).name} view isn't calculated for these details yet. Press its tab above, or Calculate chart.`}
          </p>
        )}
      </div>
    </section>
  );
}
