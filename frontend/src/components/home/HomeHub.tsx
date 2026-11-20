"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import type { ProfileStrip } from "@/lib/dashboard";
import { ZODIAC_COPY, asOf, ayanamsaNote, signsOf } from "@/lib/homeScene";
import type { HomeSky } from "@/lib/sky";
import type { Mode } from "@/lib/universe";

import { PortalScene } from "./PortalScene";
import "./home.css";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "vedic", label: "Vedic" },
  { mode: "western", label: "Western" },
  { mode: "compare", label: "Compare" },
];

const PERIODS = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "birth_chart", label: "Birth chart" },
] as const;

const FOCI = [
  { value: "", label: "General" },
  { value: "career", label: "Career" },
  { value: "love", label: "Love" },
  { value: "relationships", label: "Relationships" },
  { value: "growth", label: "Growth" },
] as const;

const DEPTHS = [
  { value: "beginner", label: "Beginner" },
  { value: "technical", label: "Technical" },
] as const;

const abbreviation = (lord: string) => lord.slice(0, 2);

/** The three icons of the doors, from the design. */
const ICON = {
  chart: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="32" height="32" /><path d="M4 4L36 36M36 4L4 36M20 4L36 20L20 36L4 20Z" />
    </svg>
  ),
  sky: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="6" /><path d="M20 3v6M20 31v6M3 20h6M31 20h6M8 8l4 4M28 28l4 4M32 8l-4 4M12 28l-4 4" />
    </svg>
  ),
  guide: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false">
      <path d="M20 4c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12z" /><circle cx="32" cy="31" r="3" />
    </svg>
  ),
};

function ProfileStripView({ strip, homePath }: { strip: ProfileStrip; homePath: string }) {
  if (strip.status !== "saved") {
    return (
      <div className="hm-strip" id="strip">
        <div className="hm-off">
          <span>
            {strip.status === "none"
              ? "Save a birth profile to see your current Dasha and where the Moon, Jupiter and Saturn are now."
              : strip.status === "unavailable"
                ? "Your saved profile could not be loaded just now."
                : "Log in to see your current Dasha and where the Moon, Jupiter and Saturn are now."}
          </span>
          {strip.status !== "unavailable" && (
            <Link className="hm-go hm-o" href="/profile">
              {strip.status === "none" ? "Save a birth profile" : "Log in"}
            </Link>
          )}
        </div>
      </div>
    );
  }
  const d = strip.dashboard;
  if (!d) {
    return (
      <div className="hm-strip" id="strip">
        <div className="hm-off">
          <span>Your Dasha and the sky now could not be calculated just now. Your birth chart is on its own page.</span>
          <Link className="hm-go hm-o" href="/chart">Open the birth chart</Link>
        </div>
      </div>
    );
  }
  const total = d.bar.reduce((sum, p) => sum + p.years, 0) || 1;
  return (
    <div className="hm-strip" id="strip">
      <div className="hm-on">
        <div>
          <h4>Current Dasha</h4>
          <div className="hm-dashalords">
            {d.current.maha || "None reported"}
            {d.current.antar ? ` · ${d.current.antar}` : ""}
          </div>
          <p className="hm-note" style={{ marginTop: 4 }}>Mahadasha · Antardasha</p>
          <div style={{ position: "relative", paddingTop: 18 }}>
            <div className="hm-dbar" role="img" aria-label={`Your Mahadashas to scale: ${d.bar.map((p) => `${p.lord}${p.current ? " (now)" : ""}`).join(", ")}`}>
              <em style={{ left: `${(d.nowFraction * 100).toFixed(1)}%` }}>NOW</em>
              {d.bar.map((p, i) => (
                <span key={`${p.lord}-${i}`} className={p.current ? "hm-n" : undefined} style={{ flex: `${(p.years / total).toFixed(4)} 1 0` }}>
                  {abbreviation(p.lord)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div>
          <h4>In the sky now · Vedic</h4>
          <table>
            <tbody>
              {d.sky.map((item) => (
                <tr key={item.graha}>
                  <td>{item.graha}</td>
                  <td>{item.rashi}{item.retrograde ? " (Rx)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hm-note" style={{ marginTop: 8 }}>
            <Link className="hm-link" href="/chart">All transits on the Birth Chart page →</Link>
          </p>
        </div>
        <div>
          <h4>Suggested from your chart</h4>
          <div className="hm-sq">
            {d.questions.map((question) => (
              <Link key={question} href={`${homePath}?q=${encodeURIComponent(question)}#ask`} scroll>
                {question}
              </Link>
            ))}
          </div>
          <p className="hm-note" style={{ marginTop: 8 }}>Choosing one only fills the Guide box.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Home (design/Celestara Home.html): the sky as it is now, as a portal scene whose arc of signs
 * carries the nine grahas, with three ways in below it - the birth chart, a reading, and the
 * Guide - and a strip for a saved profile. The reading and Guide doors choose what to ask and
 * take you to the matching form further down the page, filled in; nothing is sent until you
 * press that form's own button.
 */
export function HomeHub({ sky, homePath, strip }: { sky: HomeSky | null; homePath: string; strip: ProfileStrip }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vedic");
  const [selected, setSelected] = useState(-1);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("weekly");
  const [focus, setFocus] = useState<(typeof FOCI)[number]["value"]>("");
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]["value"]>("beginner");
  const [question, setQuestion] = useState("");
  const [needQuestion, setNeedQuestion] = useState(false);
  const questionRef = useRef<HTMLInputElement>(null);

  const ayanamsa = sky?.ayanamsa ?? 0;
  const bodies = sky?.bodies ?? [];
  const picked = selected >= 0 ? bodies[selected] : undefined;
  const signs = picked ? signsOf(picked.tropical, ayanamsa) : null;

  const readingParams = new URLSearchParams({ period });
  if (focus) readingParams.set("focus", focus);
  readingParams.set("depth", depth);
  const readingHref = `${homePath}?${readingParams.toString()}#reading`;

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) {
      setNeedQuestion(true);
      questionRef.current?.focus();
      return;
    }
    setNeedQuestion(false);
    router.push(`${homePath}?${new URLSearchParams({ q: text, depth }).toString()}#ask`);
  };

  return (
    <main className="hm" id="top">
      <section className="hm-hero" aria-labelledby="h">
        <div>
          <div className="hm-eyebrow cx-mono">
            <span>The sky now</span>
            {sky && <span>{asOf(sky.moment)}</span>}
          </div>
          <h1 id="h">Your celestial universe</h1>
          <p className="hm-lede">
            Calculate your Vedic and Western charts, read the sky as it is now, and ask questions of a guide that
            interprets only what has been calculated. For reflection, not prediction.
          </p>
          <div className="hm-seg" role="group" aria-label="Zodiac">
            {MODES.map((m) => (
              <button key={m.mode} type="button" aria-pressed={mode === m.mode} onClick={() => setMode(m.mode)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="hm-zinfo" aria-live="polite">
            <p>{ZODIAC_COPY[mode]}</p>
            {sky && <small>{ayanamsaNote(ayanamsa)}</small>}
          </div>
          <div className="hm-pinfo" aria-live="polite">
            {!sky ? (
              <p style={{ margin: 0 }}>The live sky could not be loaded just now. Your birth chart still works.</p>
            ) : !picked || !signs ? (
              <p style={{ margin: 0 }}>Choose a planet on the arc to see its sign in each zodiac.</p>
            ) : (
              <>
                <h2>{picked.name}{picked.retrograde ? " (retrograde)" : ""}</h2>
                <div className="hm-rows">
                  {mode !== "western" && (<><span>Vedic</span><span><b>{signs.vedic}</b> · sidereal</span></>)}
                  {mode !== "vedic" && (<><span>Western</span><span><b>{signs.western}</b> · tropical</span></>)}
                </div>
              </>
            )}
          </div>
          {sky && (
            <details>
              <summary>Positions as text</summary>
              <div>
                <table>
                  <thead><tr><th>Graha</th><th>Western</th><th>Vedic</th></tr></thead>
                  <tbody>
                    {bodies.map((body) => {
                      const s = signsOf(body.tropical, ayanamsa);
                      return (
                        <tr key={body.name}>
                          <td>{body.name}{body.retrograde ? " (Rx)" : ""}</td>
                          <td>{s.western}</td>
                          <td>{s.vedic}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
        <PortalScene mode={mode} onMode={setMode} sky={sky} selected={selected} onSelect={setSelected} />
      </section>

      <section className="hm-sec" id="start" aria-labelledby="sH">
        <h2 id="sH">Three ways in</h2>
        <p>Everything is calculated first. The guide only explains what the calculation found.</p>
        <ProfileStripView strip={strip} homePath={homePath} />
        <div className="hm-doors">
          <div className="hm-door">
            {ICON.chart}
            <h3>Start with your birth chart</h3>
            <p>Vedic, Western, a side-by-side comparison, your Dasha timeline and the current transits.</p>
            <Link className="hm-go" href="/chart">Calculate a chart <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hm-door">
            {ICON.sky}
            <h3>Read the sky</h3>
            <p>Built from today&apos;s real transits against your natal chart, never from a template.</p>
            <div className="hm-chips" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" className="hm-chip" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="hm-chips" role="group" aria-label="Focus">
              {FOCI.map((f) => (
                <button key={f.label} type="button" className="hm-chip" aria-pressed={focus === f.value} onClick={() => setFocus(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <Link className="hm-go" href={readingHref}>Open reading <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hm-door">
            {ICON.guide}
            <h3>Ask the Guide</h3>
            <p>Answers show their working: the calculated facts, the traditional knowledge and your own context.</p>
            <form className="hm-ask" onSubmit={ask} noValidate>
              <input
                ref={questionRef}
                id="q"
                type="text"
                placeholder="What would you like to understand?"
                aria-label="Question for the Guide"
                aria-invalid={needQuestion || undefined}
                aria-describedby={needQuestion ? "q-hint" : undefined}
                value={question}
                onChange={(e) => { setQuestion(e.target.value); setNeedQuestion(false); }}
              />
              <button className="hm-go" type="submit" aria-label="Ask the Guide">Ask</button>
            </form>
            {needQuestion && <p className="hm-alert" id="q-hint" role="alert">Type a question first, or choose a suggestion.</p>}
            <div className="hm-seg hm-sm" role="group" aria-label="Explanation">
              {DEPTHS.map((d) => (
                <button key={d.value} type="button" aria-pressed={depth === d.value} onClick={() => setDepth(d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="hm-note">Nothing is sent until you press Ask on the Guide form below.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
