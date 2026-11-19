/**
 * The wheel drawn on the birth-chart page's "instrument" (design/Celestara Birth Chart.html):
 * a zodiac wheel with a progress arc that fills as the form is completed, twelve sign glyphs,
 * a ring of constellations, the twelve houses, the ascendant line, a sun-and-moon at the
 * centre and nine planet discs. It is a preview, not the visitor's chart: its planet
 * positions are fixed, and the real chart is drawn in the results below.
 *
 * Returned as an SVG string (it never changes and contains no user input). What does
 * change - progress, houses, the cast animation - is driven by data attributes and a CSS
 * variable on the wrapper, so this is rendered once.
 */

export const SIGN_CODES = ["ARI", "TAU", "GEM", "CAN", "LEO", "VIR", "LIB", "SCO", "SAG", "CAP", "AQU", "PIS"] as const;

/** Planet codes and their angle on the preview wheel, in degrees. */
export const PREVIEW_PLANETS: readonly (readonly [string, number])[] = [
  ["Su", 20], ["Mo", 75], ["Ma", 140], ["Me", 200], ["Ju", 250],
  ["Ve", 295], ["Sa", 330], ["Ra", 100], ["Ke", 280],
];

/** Circumference of the progress arc (r = 494), which the CSS uses as its dash length. */
export const ARC_LENGTH = 2 * Math.PI * 494;

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A point on a circle of radius `r` about (500, 500), `deg` clockwise from 3 o'clock. */
export function point(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [500 + r * Math.cos(a), 500 + r * Math.sin(a)];
}

const n1 = (v: number) => v.toFixed(1);

// One drawn glyph per sign, in zodiac order
const GLYPHS = [
  "M0 12V-3M0 -3C0 -11 -10 -11 -10 -4M0 -3C0 -11 10 -11 10 -4",
  "M-6 6a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M-9 -10C-9 -3 9 -3 9 -10",
  "M-8 -10C-3 -7 3 -7 8 -10M-8 10C-3 7 3 7 8 10M-4 -8V8M4 -8V8",
  "M-10 -3a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M-9 -5C-5 -11 6 -10 10 -5M10 3a3.5 3.5 0 1 0 -7 0a3.5 3.5 0 1 0 7 0M9 5C5 11 -6 10 -10 5",
  "M-8 4a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M-2 4C-2 -10 8 -10 8 -3C8 4 4 6 4 10C4 12 6 12 8 11",
  "M-10 -8V8M-10 -3C-10 -9 -3 -9 -3 -3V8M-3 -3C-3 -9 4 -9 4 -3V8C4 12 10 12 10 6C10 2 6 2 4 6",
  "M-11 9H11M-11 4H-5C-8 -2 -6 -9 0 -9C6 -9 8 -2 5 4H11",
  "M-10 -8V8M-10 -3C-10 -9 -3 -9 -3 -3V8M-3 -3C-3 -9 4 -9 4 -3V8C4 11 7 11 10 8M10 8V12M10 8L6 9",
  "M-9 10L9 -9M2 -9H9V-2M-7 2L5 8",
  "M-10 -9V1C-10 4 -6 4 -6 1V-9C-6 -2 0 4 4 4A4 4 0 1 1 0 8",
  "M-11 -3L-7 -6L-3 -3L1 -6L5 -3L9 -6M-11 4L-7 1L-3 4L1 1L5 4L9 1",
  "M-6 -10C0 -3 0 3 -6 10M6 -10C0 -3 0 3 6 10M-9 0H9",
];

function emblem(cx: number, cy: number, kind: "sun" | "moon" | "jup" | "sat"): string {
  let s = `<g transform="translate(${cx} ${cy})"><circle class="cx-gl" r="58"/><circle class="cx-gl" r="50" opacity=".35"/>`;
  if (kind === "sun") {
    s += '<circle class="cx-gl" r="15"/>';
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      s += `<line class="cx-gl" x1="${n1(22 * Math.cos(a))}" y1="${n1(22 * Math.sin(a))}" x2="${n1(34 * Math.cos(a))}" y2="${n1(34 * Math.sin(a))}"/>`;
    }
  }
  if (kind === "moon") s += '<path class="cx-gl" d="M8 -28A28 28 0 1 0 8 28A22 22 0 1 1 8 -28Z"/>';
  if (kind === "jup") s += '<circle class="cx-gl" r="26"/><path class="cx-gl" d="M-24 -10H24M-26 0H26M-24 10H24"/>';
  if (kind === "sat") s += '<circle class="cx-gl" r="17"/><ellipse class="cx-gl" rx="36" ry="10" transform="rotate(-18)"/>';
  return s + "</g>";
}

/** The centre: a sun and a moon sharing one disc, with flame rays around it. */
function sunAndMoon(): string {
  let s = '<g transform="translate(500 500)"><circle r="150" fill="url(#cxsg)"/>';
  for (let i = 0; i < 24; i++) {
    const L = i % 2 === 0 ? 114 : 94;
    s += `<path d="M-7 -70C-10 -82 -3 -${L - 14} 2 -${L}C4 -${L - 14} 10 -82 7 -70Z" fill="${i % 2 === 0 ? "#d9b25c" : "rgba(217,178,92,.5)"}" transform="rotate(${i * 15})"/>`;
  }
  s +=
    '<circle r="68" fill="none" stroke="#d9b25c" stroke-width="1.6"/><clipPath id="cxsd"><circle r="62"/></clipPath><g clip-path="url(#cxsd)">' +
    '<rect x="-62" y="-62" width="124" height="124" fill="#e2bd6a"/>' +
    '<path d="M4 -64C-8 -34 -8 34 4 64L64 64L64 -64Z" fill="#05060a"/>' +
    '<g fill="#e2bd6a"><circle cx="30" cy="22" r="1.6"/><circle cx="40" cy="36" r="1.2"/><circle cx="22" cy="46" r="1.4"/><circle cx="46" cy="2" r="1.2"/><circle cx="26" cy="-38" r="1.4"/><circle cx="42" cy="-26" r="1"/></g></g>' +
    '<g fill="none" stroke="#05060a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M-46 -14Q-36 -22 -24 -16M-44 -4Q-35 3 -26 -3M-18 -6Q-12 8 -17 16Q-13 19 -8 17M-26 32Q-18 27 -10 31Q-18 38 -26 32"/></g>' +
    '<g fill="#05060a"><circle cx="-42" cy="10" r="1.2"/><circle cx="-38" cy="16" r="1.2"/><circle cx="-46" cy="18" r="1.2"/><circle cx="-35" cy="10" r="1.2"/><circle cx="-41" cy="24" r="1.2"/></g>' +
    '<g fill="none" stroke="#e2bd6a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 -16Q26 -22 38 -14M20 -4Q28 3 37 -4M6 -6Q0 8 5 16Q1 19 -2 17M2 31Q10 27 18 32Q10 38 2 31"/></g></g>';
  return s;
}

export function wheelMarkup(): string {
  const r = rng(11);
  let s =
    '<svg viewBox="-40 -40 1080 1080" aria-hidden="true" focusable="false"><defs>' +
    '<radialGradient id="cxnv" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#06070b"/><stop offset=".7" stop-color="#020306"/><stop offset="1" stop-color="#000000"/></radialGradient>' +
    '<radialGradient id="cxsg"><stop offset="0" stop-color="#f2c55c" stop-opacity=".22"/><stop offset="1" stop-color="#f2c55c" stop-opacity="0"/></radialGradient>' +
    '<filter id="cxgw" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  s += '<circle cx="500" cy="500" r="470" fill="url(#cxnv)"/>';
  s += `<circle class="cx-pt" cx="500" cy="500" r="494"/><circle class="cx-pa" cx="500" cy="500" r="494" transform="rotate(-90 500 500)" stroke-dasharray="${ARC_LENGTH.toFixed(1)}"/>`;
  s += emblem(80, 80, "sun") + emblem(920, 80, "moon") + emblem(80, 920, "jup") + emblem(920, 920, "sat");
  s +=
    '<g id="ring"><circle class="cx-rg" cx="500" cy="500" r="470"/><circle class="cx-rg" cx="500" cy="500" r="466" opacity=".3"/><circle class="cx-rg" cx="500" cy="500" r="400"/><circle cx="500" cy="500" r="435" fill="none" stroke="rgba(217,178,92,.06)" stroke-width="70"/>';
  for (let i = 0; i < 72; i++) {
    const a = point(400, i * 5);
    const b = point(i % 6 === 0 ? 418 : 408, i * 5);
    s += `<line class="cx-tk" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const a = point(400, 180 + i * 30);
    const b = point(470, 180 + i * 30);
    s += `<line class="cx-sp" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`;
  }
  s += '<g id="ringlabels">';
  for (let i = 0; i < 12; i++) {
    const ang = 180 + i * 30 + 15;
    let t = point(443, ang);
    s += `<path class="cx-gl" d="${GLYPHS[i]}" transform="translate(${n1(t[0])} ${n1(t[1])}) rotate(${ang + 90}) scale(1.35)"/>`;
    t = point(414, ang);
    s += `<text class="cx-nm" x="${n1(t[0])}" y="${n1(t[1])}" transform="rotate(${ang + 90} ${n1(t[0])} ${n1(t[1])})">${SIGN_CODES[i]}</text>`;
  }
  s += "</g></g>";
  s += '<circle class="cx-rg cx-t" cx="500" cy="500" r="290"/><circle class="cx-rg cx-d" cx="500" cy="500" r="150"/>';
  s += '<g id="const" filter="url(#cxgw)">';
  for (let i = 0; i < 12; i++) {
    const pts: [number, number][] = [];
    for (let j = 0; j < 4; j++) pts.push(point(190 + r() * 80, 180 + i * 30 + 4 + r() * 22));
    s += `<polyline fill="none" stroke="rgba(255,224,150,.6)" stroke-width="1.2" points="${pts.map((p) => `${n1(p[0])},${n1(p[1])}`).join(" ")}"/>`;
    for (const p of pts) s += `<circle cx="${n1(p[0])}" cy="${n1(p[1])}" r="${(2.2 + r() * 1.8).toFixed(1)}" fill="#fff6d8"/>`;
  }
  s += '</g><g id="houses">';
  for (let i = 0; i < 12; i++) {
    const a = point(150, 180 + i * 30);
    const b = point(290, 180 + i * 30);
    s += `<line class="cx-sp" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`;
    const t = point(168, 180 + i * 30 + 15);
    s += `<text class="cx-hn" x="${n1(t[0])}" y="${n1(t[1])}">${i + 1}</text>`;
  }
  s += '<line class="cx-asc" x1="30" y1="500" x2="290" y2="500"/><text class="cx-ascl" x="-4" y="486">ASC</text></g>';
  s += sunAndMoon();
  s += '<g id="planets">';
  for (const [code, deg] of PREVIEW_PLANETS) {
    const q = point(345, deg);
    const su = code === "Su";
    s += `<circle class="cx-pd${su ? " cx-su" : ""}" cx="${n1(q[0])}" cy="${n1(q[1])}" r="20"/><text class="cx-pl${su ? " cx-k" : ""}" x="${n1(q[0])}" y="${n1(q[1])}">${code}</text>`;
  }
  s += "</g></svg>";
  return s;
}
