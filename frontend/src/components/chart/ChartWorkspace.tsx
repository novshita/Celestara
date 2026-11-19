"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { submitBirthData, type ChartFormState, type ChartSystem } from "@/app/actions";
import { explorePlanetAction, type ExploreFormState } from "@/app/explore-actions";
import {
  SERVER_FIELD,
  chartErrors,
  okDate,
  okLatitude,
  okLongitude,
  okTime,
  plateOffset,
  stepsSet,
  type ChartErrors,
  type ChartField,
  type ChartInputs,
  type TimeConfidenceChoice,
} from "@/lib/chartValidation";
import { wheelMarkup } from "@/lib/chartInstrument";
import type { BirthData } from "@/lib/types";

import { ChartResults, type ChartSuccess } from "./ChartResults";
import { ExplorePanel, type ExploreSelection } from "./ExplorePanel";
import { LENSES, LENS_ICON, lensByKey } from "./lenses";

export type SavedStatus = "saved" | "none" | "anonymous" | "unavailable";

/** The wheel never changes, so it is built once. */
const WHEEL = wheelMarkup();

const CONFIDENCE: { value: TimeConfidenceChoice; label: string }[] = [
  { value: "EXACT", label: "Exact, I know the time" },
  { value: "ESTIMATED", label: "Approximate" },
  { value: "UNKNOWN", label: "I don't know the time" },
];

const MOON_PHASES = [
  <circle key="a" cx="13" cy="13" r="11" fill="none" stroke="#f1ede4" strokeWidth="1.5" />,
  <g key="b"><circle cx="13" cy="13" r="11" fill="none" stroke="#f1ede4" strokeWidth="1.5" /><path d="M13 2a11 11 0 0 0 0 22a7 11 0 0 1 0-22z" fill="#f1ede4" /></g>,
  <g key="c"><circle cx="13" cy="13" r="11" fill="none" stroke="#f1ede4" strokeWidth="1.5" /><path d="M13 2a11 11 0 0 0 0 22z" fill="#f1ede4" /></g>,
  <g key="d"><circle cx="13" cy="13" r="11" fill="none" stroke="#f1ede4" strokeWidth="1.5" /><path d="M13 2a11 11 0 0 0 0 22a7 11 0 0 0 0-22z" fill="#f1ede4" /></g>,
  <circle key="e" cx="13" cy="13" r="11" fill="#f2c55c" />,
];

interface Fields extends ChartInputs {
  timezone: string;
  tzManual: boolean;
}

const fieldsFrom = (b?: BirthData): Fields => ({
  date: b?.birth_date ?? "",
  time: b?.birth_time?.slice(0, 5) ?? "",
  confidence: b?.time_confidence ?? "EXACT",
  latitude: b ? String(b.latitude) : "",
  longitude: b ? String(b.longitude) : "",
  timezone: b?.timezone_name ?? "",
  tzManual: Boolean(b?.timezone_name),
});

const EMPTY = fieldsFrom(undefined);

/** Everything that decides whether calculated results still describe the form. */
const keyOf = (f: Fields) =>
  JSON.stringify([f.date, f.confidence === "UNKNOWN" ? "" : f.time, f.confidence, f.latitude, f.longitude, f.tzManual ? f.timezone : ""]);

// ---- the calculation, remembered per set of inputs ----------------------------------

interface Calc {
  /** Latest answer (success or error) from the server. */
  last: ChartFormState;
  /** Which inputs `results` were calculated from, or null before the first calculation. */
  key: string | null;
  results: Partial<Record<ChartSystem, ChartSuccess>>;
  /** The submitted values, so the planet explorer can ask about the same birth. */
  fields: Record<string, string>;
}

const START: Calc = { last: { status: "idle" }, key: null, results: {}, fields: {} };

async function calculate(previous: Calc, formData: FormData): Promise<Calc> {
  const key = String(formData.get("__key") ?? "");
  formData.delete("__key");
  const fields: Record<string, string> = {};
  for (const [name, value] of formData.entries()) if (typeof value === "string") fields[name] = value;

  const next = await submitBirthData({ status: "idle" }, formData);
  if (next.status !== "success") return { ...previous, last: next };
  // Same inputs: add this view to the ones already calculated. New inputs: start again.
  const results = previous.key === key ? { ...previous.results } : {};
  results[next.system] = next as ChartSuccess;
  return { last: next, key, results, fields };
}

const EXPLORE_START: ExploreFormState = { status: "idle" };

export function ChartWorkspace({ defaults, saved }: { defaults?: BirthData; saved: SavedStatus }) {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(defaults));
  const [lens, setLens] = useState<ChartSystem>("vedic");
  const [errors, setErrors] = useState<ChartErrors>({});
  // A message from something the visitor just did that the server was not part of
  const [note, setNote] = useState<string | null>(null);
  const [filled, setFilled] = useState<"saved" | "cleared" | null>(defaults ? "saved" : null);
  const [selection, setSelection] = useState<ExploreSelection>({ system: "vedic", body: "Jupiter" });

  const [calc, runCalc, calculating] = useActionState(calculate, START);
  const [exploration, runExplore, exploring] = useActionState(
    async (_previous: ExploreFormState, formData: FormData) => explorePlanetAction(_previous, formData),
    EXPLORE_START,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollNext = useRef(false);

  const shown = calc.key !== null;
  const currentKey = keyOf(fields);
  const stale = shown && currentKey !== calc.key;
  const set = stepsSet(fields);
  const known = fields.confidence !== "UNKNOWN";
  const plate = plateOffset(fields);

  // The server's complaints about particular fields (rare: the form checks first)
  const serverErrors: ChartErrors = {};
  if (calc.last.status === "error") {
    for (const [name, message] of Object.entries(calc.last.fieldErrors)) {
      const field = SERVER_FIELD[name];
      if (field) serverErrors[field] = message;
    }
  }
  const shownErrors: ChartErrors = { ...serverErrors, ...errors };

  const update = (patch: Partial<Fields>) => {
    setFields((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      const merged = { ...fields, ...patch };
      if (okDate(merged)) delete next.date;
      if (okTime(merged)) delete next.time;
      if (okLatitude(merged)) delete next.latitude;
      if (okLongitude(merged)) delete next.longitude;
      return next;
    });
  };

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Validates, then calculates `system` (or shows it at once if these inputs already have it). */
  const submit = (system: ChartSystem) => {
    const found = chartErrors(fields);
    setErrors(found);
    const first = (["date", "time", "latitude", "longitude"] as ChartField[]).find((f) => found[f]);
    if (first) {
      setNote("A few details are missing. Check the highlighted fields.");
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setLens(system);
    if (calc.key === currentKey && calc.results[system]) {
      setNote(`${lensByKey(system).name} ready below.`);
      return;
    }
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("system", system);
    data.set("__key", currentKey);
    scrollNext.current = !shown;
    setNote(null);
    startTransition(() => runCalc(data));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!calculating) submit(lens);
  };

  // Bring the first result into view
  useEffect(() => {
    if (calc.last.status === "success" && scrollNext.current) {
      scrollNext.current = false;
      resultsRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }, [calc.last]);

  // Ask about the chosen planet whenever a chart exists and the choice (or the chart) changes
  useEffect(() => {
    if (calc.key === null) return;
    const data = new FormData();
    for (const [name, value] of Object.entries(calc.fields)) data.set(name, value);
    data.set("system", selection.system);
    data.set("body", selection.body);
    startTransition(() => runExplore(data));
    // runExplore is stable; the chart's fields are fixed by calc.key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc.key, selection.system, selection.body]);

  const toggleProfile = () => {
    if (filled === "saved") {
      setFields(EMPTY);
      setFilled("cleared");
    } else {
      setFields(fieldsFrom(defaults));
      setFilled("saved");
    }
    setErrors({});
  };

  const lensName = lensByKey(lens);
  // What the status line says, in order of what matters most right now
  const status = calculating
    ? `Calculating ${lensName.name}…`
    : (note ?? (shown ? "Chart ready below." : "Free to use. No account needed to calculate."));
  const failure = !calculating && calc.last.status === "error" ? calc.last.message : null;
  const castState = calculating ? "running" : shown ? "done" : "idle";
  const confidenceNote =
    fields.confidence === "UNKNOWN"
      ? "No birth time: no ascendant or houses."
      : fields.confidence === "ESTIMATED"
        ? "Birth time approximate: ascendant and houses are drawn, and flagged as uncertain."
        : "Birth time exact: ascendant and houses will be drawn.";

  return (
    <div className="cx-shell" id="top">
      <aside className="cx-instr" aria-label="Chart instrument preview" data-cast={castState} data-houses={known ? "on" : "off"} style={{ ["--p" as string]: set / 5 }}>
        <div className="cx-wheelbox">
          <div id="wheel" dangerouslySetInnerHTML={{ __html: WHEEL }} />
        </div>
        <div className="cx-readout" aria-live="polite">
          <b>{lensName.name}</b>
          <span>{lensName.system}</span>
          <span>{confidenceNote}</span>
          {shown && <span className="cx-aside">An illustration. Your calculated chart is in the results.</span>}
        </div>
        <div>
          <div className="cx-moons" aria-hidden="true">
            {MOON_PHASES.map((phase, i) => (
              <svg key={i} viewBox="0 0 26 26" className={set > i ? "cx-on" : ""}>{phase}</svg>
            ))}
          </div>
          <p className="cx-mono cx-moons-l" style={{ marginTop: 10 }}>{set} of 5 set</p>
        </div>
      </aside>

      <main>
        <div className="cx-eyebrow cx-mono">Set your instrument</div>
        <h1>Birth chart</h1>
        <p className="cx-lede">
          Enter a birth record to calculate its Vedic, Western or compared chart, its Vimshottari Dasha timeline, or
          the current transits. The calculation engine does the maths. Nothing on this page interprets.
        </p>

        <div className="cx-prof">
          {saved === "saved" && defaults ? (
            <>
              <span>
                {filled === "saved"
                  ? "Filled in from your saved profile. Changes here are for this calculation only."
                  : "Fields cleared. Your saved profile is untouched."}
              </span>
              <button type="button" onClick={toggleProfile}>
                {filled === "saved" ? "Clear fields" : "Use saved profile"}
              </button>
            </>
          ) : saved === "none" ? (
            <>
              <span>You haven&apos;t saved a birth profile yet. Save one and this page will fill itself in.</span>
              <Link href="/profile">Save a birth profile</Link>
            </>
          ) : saved === "unavailable" ? (
            <span>Your saved profile could not be loaded just now. Fill this in for a one-off.</span>
          ) : (
            <>
              <span>Log in to start from your saved birth profile, or fill this in for a one-off.</span>
              <Link href="/profile">Log in</Link>
            </>
          )}
        </div>

        <form ref={formRef} className="cx-form" noValidate onSubmit={onSubmit}>
          <fieldset>
            <legend><i>I</i>When <small>the moment of birth</small></legend>
            <div className="cx-row">
              <div className="cx-f">
                <label htmlFor="f-date">Birth date</label>
                <input type="date" id="f-date" name="birth_date" value={fields.date} onChange={(e) => update({ date: e.target.value })} aria-invalid={shownErrors.date ? true : undefined} aria-describedby="e-date" />
                <p className="cx-err" id="e-date">{shownErrors.date}</p>
              </div>
              <div className="cx-f">
                <label htmlFor="f-time">Birth time</label>
                <input type="time" id="f-time" name="birth_time" step={1} value={known ? fields.time : ""} disabled={!known} onChange={(e) => update({ time: e.target.value })} aria-invalid={shownErrors.time ? true : undefined} aria-describedby="e-time" />
                <p className="cx-err" id="e-time">{shownErrors.time}</p>
              </div>
            </div>
            <div className="cx-f">
              <span className="cx-lab" id="tcl">Time confidence</span>
              <div className="cx-pills" role="radiogroup" aria-labelledby="tcl" style={{ marginTop: 8 }}>
                {CONFIDENCE.map((option) => (
                  <label key={option.value} className="cx-pill">
                    <input type="radio" name="time_confidence" value={option.value} checked={fields.confidence === option.value} onChange={() => update({ confidence: option.value })} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {!known && (
              <div className="cx-note">
                <span aria-hidden="true">☾</span>
                <span>
                  Without a birth time there is no ascendant and no houses, so the wheel leaves them out and only the
                  South Indian layout is offered. Everything that doesn&apos;t depend on the time is still calculated.
                </span>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend><i>II</i>Where <small>the place of birth</small></legend>
            <div className="cx-where">
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div className="cx-f">
                  <label htmlFor="f-latitude">Latitude</label>
                  <input type="number" id="f-latitude" name="latitude" step="any" placeholder="e.g. 18.9756" inputMode="decimal" value={fields.latitude} onChange={(e) => update({ latitude: e.target.value })} aria-invalid={shownErrors.latitude ? true : undefined} aria-describedby="e-latitude" />
                  <p className="cx-err" id="e-latitude">{shownErrors.latitude}</p>
                </div>
                <div className="cx-f">
                  <label htmlFor="f-longitude">Longitude</label>
                  <input type="number" id="f-longitude" name="longitude" step="any" placeholder="e.g. 72.8258" inputMode="decimal" value={fields.longitude} onChange={(e) => update({ longitude: e.target.value })} aria-invalid={shownErrors.longitude ? true : undefined} aria-describedby="e-longitude" />
                  <p className="cx-err" id="e-longitude">{shownErrors.longitude}</p>
                </div>
              </div>
              <div>
                <div
                  className={`cx-plate${plate ? " cx-on" : ""}`}
                  role="img"
                  aria-label={plate ? `World grid, with your place of birth marked at ${fields.latitude}, ${fields.longitude}` : "World grid; enter the place of birth to mark it"}
                  style={plate ? { ["--x" as string]: `${plate.x}%`, ["--y" as string]: `${plate.y}%` } : undefined}
                >
                  <i className="cx-h" /><i className="cx-v" /><i className="cx-dot" />
                  <small style={{ left: 6, top: 4 }}>90°N</small>
                  <small style={{ left: 6, bottom: 4 }}>90°S</small>
                  <small style={{ right: 6, top: 4 }}>180°E</small>
                  <small style={{ left: "50%", bottom: 4, transform: "translateX(-50%)" }}>0°</small>
                </div>
                <p className="cx-hint" style={{ marginTop: 8 }}>Your coordinates, plotted. West is left, north is up.</p>
              </div>
            </div>
            <div className="cx-f">
              <span className="cx-lab">Timezone</span>
              {fields.tzManual ? (
                <div className="cx-tz">
                  <input
                    type="text"
                    name="timezone_name"
                    placeholder="e.g. Asia/Kolkata"
                    aria-label="Timezone"
                    value={fields.timezone}
                    onChange={(e) => update({ timezone: e.target.value })}
                    style={{ maxWidth: 300, width: "100%", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", color: "var(--ink)", font: "400 22px var(--sans)", padding: "10px 0", minHeight: 48 }}
                  />
                  <button type="button" onClick={() => update({ tzManual: false, timezone: "" })}>Detect automatically</button>
                </div>
              ) : (
                <div className="cx-tz">
                  <span className="cx-hint" style={{ fontSize: 15, color: "var(--ink2)" }}>Detected from your coordinates</span>
                  <button type="button" onClick={() => update({ tzManual: true })}>Set manually</button>
                </div>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend><i>III</i>What to see <small>choose a lens</small></legend>
            <div className="cx-lenses" role="radiogroup" aria-label="Chart view">
              {LENSES.map((l) => (
                <div key={l.key} className="cx-lens">
                  <input type="radio" id={`lens-${l.key}`} name="system" value={l.key} checked={lens === l.key} onChange={() => setLens(l.key)} aria-describedby={`lens-${l.key}-d`} />
                  {LENS_ICON[l.key]}
                  <label htmlFor={`lens-${l.key}`}><b>{l.name}</b></label>
                  <span id={`lens-${l.key}-d`}>{l.description}</span>
                </div>
              ))}
            </div>
            <div className="cx-cta">
              <button className="cx-go" type="submit" aria-busy={calculating || undefined}>
                {calculating ? "Casting the chart…" : "Calculate chart"} <span aria-hidden="true">→</span>
              </button>
              <p role="status">{status}</p>
            </div>
            {failure && <p role="alert" className="cx-alert">{failure}</p>}
          </fieldset>
        </form>

        {shown && (
          <div ref={resultsRef}>
            <ChartResults lens={lens} results={calc.results} stale={stale} busy={calculating} onTab={submit} />
          </div>
        )}

        <ExplorePanel calculated={shown} selection={selection} state={exploration} busy={exploring} onSelect={setSelection} />
      </main>
    </div>
  );
}
