"use client";

import { Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { startLanding } from "./engine";
import "./landing.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-ln-serif" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-ln-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-ln-mono" });

/**
 * The signed-out front door (design/Celestara_landing.html): a pinned scroll
 * story - a flight through a zodiac wheel into a chart - then a panel saying
 * what is inside. The chart on it is an illustration, not anyone's chart.
 *
 * React renders this markup once; engine.ts drives every animated style from
 * scroll position, so nothing here holds state.
 */
export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    return startLanding(root.current);
  }, []);

  return (
    <div ref={root} className={`landing ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <nav className="nav" id="lnav" aria-label="Primary">
        <a className="logo" href="#story" aria-label="Celestara home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.2" transform="rotate(-24 16 16)" />
            <circle cx="16" cy="16" r="4" fill="#f4d27a" />
          </svg>
          Celestara
        </a>
        <div className="menu">
          <Link href="/guide">Readings</Link>
          <Link href="/guide#ask">AI Guide</Link>
          <Link href="/journal">Journal</Link>
          <Link href="/profile">Privacy</Link>
        </div>
        <div className="navr">
          <Link className="login" href="/profile">Log in</Link>
          <button className="talk" id="tour" type="button">
            Take the tour <i aria-hidden="true">›</i>
          </button>
        </div>
      </nav>

      <main>
        <section id="story" aria-label="Celestara introduction">
          <div className="stage" id="stage">
            <div className="cam" id="cam"><canvas id="cv" aria-hidden="true" /></div>
            <div className="shoot" aria-hidden="true" />
            <div id="plate" aria-hidden="true" />
            <div className="fog" id="fog" aria-hidden="true"><i className="f0" /><i className="f1" /></div>

            <div className="layer" id="L0">
              <div className="hero-copy" id="h0">
                <span className="chip">Vedic + Western astrology</span>
                <h1 className="big"><span className="ln"><span>Read the Sky <em>Both</em> Ways</span></span></h1>
              </div>
            </div>

            <div id="front" aria-hidden="true">
              <div className="orb jup" />
              <div className="orb sat" />
              <div className="orb mars" /><div className="orb moon" /><div className="orb merc" /><div className="orb sun" />
            </div>
            <div className="rock rk1" id="rk1" aria-hidden="true"><div className="bob" /></div>
            <div className="rock rk3" id="rk3" aria-hidden="true"><div className="bob" /></div>

            <div className="layer" id="L1">
              <div className="hud" id="hud">
                <span className="chip">Natal chart · sample</span>
                <div className="frame" />
                <pre>{"LAT  18.9756° N\nLON  72.8258° E\nAYANAMSA  LAHIRI"}</pre>
              </div>
              <p className="cap" id="cap">Calculated first.<br />Interpreted second.<br />Decided by you.</p>
              <div className="hint" id="hint">Scroll to enter <i aria-hidden="true" /></div>
            </div>

            <div className="layer" id="L2">
              <div className="vision" id="vision">
                <span className="chip" id="vChip">Our philosophy</span>
                <h2 id="vH">The system calculates.<br />The AI interprets.<br />The user decides.</h2>
                <p id="vP">Accurate underneath, understandable in the middle,<br />immersive on the surface.</p>
              </div>
            </div>

            <div className="chart" id="chart" aria-hidden="true"><div className="glow" /><div id="chartSvg" /></div>

            <div className="layer" id="L3">
              <p className="acct" id="acct">Two traditions, one moment of birth. Swiss Ephemeris calculations place every planet in the Vedic sidereal zodiac and the Western tropical zodiac, so you can see not only how the two differ, but why.</p>
              <button className="hs" type="button" style={{ left: "57%", top: "33%" }}><span className="dot" /><span><span className="lab">Vimshottari Dasha</span><em className="mono">Jupiter · Saturn (sample)</em></span></button>
              <button className="hs" type="button" style={{ left: "80%", top: "37%" }}><span className="dot" /><span><span className="lab">Gochar transit</span><em className="mono">Saturn · 11th bhava (sample)</em></span></button>
              <button className="hs" type="button" style={{ left: "56%", top: "70%" }}><span className="dot" /><span><span className="lab">Moon · Nakshatra</span><em className="mono">Read from your chart</em></span></button>
              <button className="hs" type="button" style={{ left: "81%", top: "72%" }}><span className="dot" /><span><span className="lab">Compare</span><em className="mono">Tropical − ayanamsa = sidereal</em></span></button>
            </div>

            <div className="layer" id="L4">
              <h3 className="cred" id="cred" style={{ fontWeight: 400 }}><span className="chip">✕ Chart 01 · Sample</span>Accurate underneath, understandable in the middle</h3>
              <div className="card" id="card">
                <h4>Lahiri ayanamsa:<br />why the two zodiacs differ</h4>
                <div className="note">Gap between tropical and sidereal · approx.</div>
                <div className="num"><span id="num">24.2</span><small>degrees</small></div>
                <span className="chip tagc">+0.014° / yr</span>
                <svg viewBox="0 0 220 70" role="img" aria-label="Lahiri ayanamsa growing from about 22.5 degrees in 1900 to 24.6 degrees in 2050">
                  <line x1="0" y1="60" x2="214" y2="60" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
                  <line x1="0" y1="35" x2="214" y2="35" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
                  <polyline id="spark" fill="none" stroke="#f4d27a" strokeWidth="1.6" points="0,58.6 35.7,50.7 71.3,42.9 107,34.9 142.7,27 179.8,18.8 214,11.1" />
                  <circle cx="71.3" cy="42.9" r="2.4" fill="#fff" /><circle cx="142.7" cy="27" r="2.4" fill="#fff" />
                  <circle cx="179.8" cy="18.8" r="3.6" fill="#f4d27a" />
                </svg>
                <div className="foot"><span>1900</span><span>1950</span><span>2000</span><span>2050</span></div>
              </div>
              <div className="feats" id="feats">
                <Link className="feat" href="/chart">Vedic D1 / Rashi chart <span aria-hidden="true">→</span></Link>
                <Link className="feat" href="/chart">Western natal chart and aspects <span aria-hidden="true">→</span></Link>
                <Link className="feat" href="/chart">Compare: why they differ <span aria-hidden="true">→</span></Link>
                <Link className="feat" href="/chart">Vimshottari Dasha and Gochar transits <span aria-hidden="true">→</span></Link>
                <Link className="feat" href="/guide#ask">AI Guide grounded in calculated facts <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="prog" aria-hidden="true"><i id="prog" /></div>
          </div>
        </section>

        <section id="sol" aria-labelledby="solH">
          <div className="sh">
            <div><span className="chip">What is inside</span><h2 id="solH">Explore the chart, then ask what it means</h2></div>
            <p>Celestara calculates both traditions first. The AI Guide then interprets only what was calculated, and shows its working. You choose what to keep.</p>
          </div>
          <div className="cards" id="cards">
            <article className="sc"><div className="bg bg1" /><div className="ov" /><div className="top"><span>[Readings]</span><span className="go" aria-hidden="true">→</span></div><div className="bot"><h3><Link href="/guide">Daily, weekly and monthly readings</Link></h3><p>Birth chart, career, love, relationships or growth, built from real transits and never from a template.</p></div></article>
            <article className="sc"><div className="bg bg2" /><div className="ov" /><div className="top"><span>[AI Guide]</span><span className="go" aria-hidden="true">→</span></div><div className="bot"><h3><Link href="/guide#ask">A guide that shows its working</Link></h3><p>Every answer lists the calculated facts, the traditional knowledge and the personal context behind it.</p></div></article>
            <article className="sc"><div className="bg bg3" /><div className="ov" /><div className="top"><span>[Journal and privacy]</span><span className="go" aria-hidden="true">→</span></div><div className="bot"><h3><Link href="/journal">Reflect freely, delete completely</Link></h3><p>Keep a journal, choose what the guide remembers, and erase everything with one confirmed action.</p></div></article>
          </div>
          <div className="stats" id="stats">
            <div><b data-to="2">2</b><span>Zodiac systems</span></div>
            <div><b data-to="9">9</b><span>Grahas tracked</span></div>
            <div><b data-to="120">120</b><span>Years in the Dasha cycle</span></div>
            <div><b data-to="12">12</b><span>Rashis and houses</span></div>
          </div>
        </section>
      </main>

      <footer>
        <div className="fin">
          <p>Celestara treats astrology as an interpretive and traditional framework, not scientifically validated prediction. Readings are for reflection and are not medical, legal or financial advice. The chart on this page is an illustration, not a real person&apos;s chart.</p>
          <div className="acts">
            <Link className="cta" href="/chart">Start with your birth chart <span aria-hidden="true">→</span></Link>
            <button className="replay" id="replay" type="button">Replay the fly-in <span aria-hidden="true">↑</span></button>
          </div>
        </div>
      </footer>
    </div>
  );
}
