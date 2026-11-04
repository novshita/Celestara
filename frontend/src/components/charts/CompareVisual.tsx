"use client";

import { useState } from "react";

import { KundaliChart } from "@/components/charts/KundaliChart";
import { ZodiacWheel } from "@/components/charts/ZodiacWheel";
import type { ChartComparison } from "@/lib/types";

type View = "together" | "vedic" | "western";

const VIEWS: { value: View; label: string }[] = [
  { value: "together", label: "Together" },
  { value: "vedic", label: "Vedic" },
  { value: "western", label: "Western" },
];

/**
 * Both drawings in one place (product spec §6, §26). Choosing a view does not
 * swap one picture for another: the panels slide and fade into their new
 * proportions, so the two systems read as one chart being looked at in
 * different ways. Neither is presented as the better one.
 */
export function CompareVisual({ comparison }: { comparison: ChartComparison }) {
  const [view, setView] = useState<View>("together");
  const columns =
    view === "together" ? "1fr 1fr" : view === "vedic" ? "1fr 0fr" : "0fr 1fr";

  const panel = (shown: boolean) =>
    `min-w-0 overflow-hidden transition-opacity duration-500 ${
      shown ? "opacity-100" : "pointer-events-none opacity-0 max-md:hidden"
    }`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="group" aria-label="Which chart to show" className="flex gap-1 text-sm">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            onClick={() => setView(option.value)}
            className={`rounded-md px-3 py-1 transition ${
              view === option.value
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        className="grid w-full gap-4 transition-[grid-template-columns] duration-500 max-md:!grid-cols-1 md:gap-0"
        style={{ gridTemplateColumns: columns }}
      >
        <div className={panel(view !== "western")} aria-hidden={view === "western"}>
          <h3 className="mb-2 text-center text-sm font-medium text-slate-400">
            Vedic · sidereal
          </h3>
          <div className="flex justify-center">
            <KundaliChart chart={comparison.vedic} />
          </div>
        </div>
        <div className={panel(view !== "vedic")} aria-hidden={view === "vedic"}>
          <h3 className="mb-2 text-center text-sm font-medium text-slate-400">
            Western · tropical
          </h3>
          <div className="flex justify-center">
            <ZodiacWheel chart={comparison.western} />
          </div>
        </div>
      </div>
    </div>
  );
}
