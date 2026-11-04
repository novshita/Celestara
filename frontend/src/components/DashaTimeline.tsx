"use client";

import { useState } from "react";

import {
  activeIndex,
  formatDashaDate,
  isActive,
  positionInCycle,
  shareOf,
} from "@/lib/dashaTimeline";
import type { DashaPeriod } from "@/lib/types";

/** The cycle as a bar, one segment per Mahadasha, drawn to scale. Choosing a
 * segment lists its Antardashas. Everything shown is calculated; the
 * component only lays it out. */
export function DashaTimeline({
  periods,
  active,
  asOf,
}: {
  periods: DashaPeriod[];
  active: DashaPeriod[];
  asOf: string;
}) {
  const [selected, setSelected] = useState(() => activeIndex(periods, active));
  const current = periods[selected];
  const now = positionInCycle(periods, asOf);

  if (!current) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative pb-4">
        <div role="group" aria-label="Mahadasha periods" className="flex h-12 gap-0.5">
          {periods.map((period, index) => {
            const share = shareOf(period, periods[0].start, periods[periods.length - 1].end);
            const isSelected = index === selected;
            return (
              <button
                key={`${period.lord}-${period.start}`}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${period.lord} Mahadasha, ${formatDashaDate(period.start)} to ${formatDashaDate(period.end)}`}
                onClick={() => setSelected(index)}
                style={{ flexGrow: share, flexBasis: 0 }}
                className={`min-w-1 overflow-hidden rounded-sm text-xs transition ${
                  isSelected
                    ? "bg-amber-400 text-slate-950"
                    : isActive(period, active)
                      ? "bg-amber-400/30 text-amber-200 hover:bg-amber-400/45"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {share > 0.06 ? period.lord.slice(0, 3) : ""}
              </button>
            );
          })}
        </div>
        {now !== null && (
          <span
            aria-hidden
            style={{ left: `${now * 100}%` }}
            className="absolute -bottom-0 -translate-x-1/2 text-[10px] leading-none text-amber-300"
          >
            ▲ now
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2" aria-live="polite">
        <h3 className="text-sm font-medium text-slate-100">
          {current.lord} Mahadasha
          {current.is_partial && (
            <span className="ml-1 text-xs text-amber-400">(partial)</span>
          )}
          <span className="ml-2 font-normal text-slate-500">
            {formatDashaDate(current.start)} – {formatDashaDate(current.end)} ·{" "}
            {current.duration_years.toFixed(2)} years
          </span>
        </h3>

        {current.sub_periods.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {current.sub_periods.map((sub) => {
              const share = shareOf(sub, current.start, current.end);
              const isNow = isActive(sub, active);
              return (
                <li
                  key={`${sub.lord}-${sub.start}`}
                  className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm"
                >
                  <span className={isNow ? "font-medium text-amber-300" : "text-slate-300"}>
                    {sub.lord}
                    {isNow && <span className="ml-1 text-xs">· now</span>}
                  </span>
                  <span className="h-1.5 rounded-full bg-slate-800">
                    <span
                      style={{ width: `${Math.max(share * 100, 1)}%` }}
                      className={`block h-full rounded-full ${isNow ? "bg-amber-400" : "bg-slate-500"}`}
                    />
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDashaDate(sub.start)} – {formatDashaDate(sub.end)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No sub-periods in the generated data.</p>
        )}
      </div>
    </div>
  );
}
