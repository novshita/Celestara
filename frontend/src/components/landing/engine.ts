/**
 * The landing page's scroll story, ported from design/Celestara_landing.html.
 *
 * One tall section pins a stage; scroll position (0..1) drives a canvas
 * star-flight and a set of DOM layers (wheel, planets, headline, chart,
 * hotspots, cards). React renders the markup once and never touches it again,
 * so this module owns every style it sets. `startLanding` returns a function
 * that stops everything, which React Strict Mode and navigation both need.
 */

import { clamp, e2, e3, seg, wheel } from "./math";

type Star = { x: number; y: number; z: number; c: number; s: number };

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrap each word of an element's own text in a span, so words can animate
 * separately. Idempotent: a second call returns the spans already there. */
function splitWords(el: HTMLElement): HTMLElement[] {
  const existing = Array.from(el.querySelectorAll<HTMLElement>(":scope > .w"));
  if (existing.length) return existing;
  const words: HTMLElement[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType !== Node.TEXT_NODE) continue;
    const frag = document.createDocumentFragment();
    for (const t of (n.textContent ?? "").split(/(\s+)/)) {
      if (!t) continue;
      if (/^\s+$/.test(t)) {
        frag.appendChild(document.createTextNode(" "));
        continue;
      }
      const sp = document.createElement("span");
      sp.className = "w";
      sp.textContent = t;
      frag.appendChild(sp);
      words.push(sp);
    }
    el.replaceChild(frag, n);
  }
  return words;
}

/** A normally distributed random number (Box-Muller), from a seeded source. */
function gaussian(r: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Realistic colours for the Milky Way's tiny stars, with their weights. */
const MW_STARS: [string, number][] = [
  ["255,255,255", 0.36],
  ["190,210,255", 0.26],
  ["255,226,190", 0.24],
  ["255,200,140", 0.14],
];
/** The few bright stars stand out in colour, as in a photograph: warm and blue-white. */
const MW_BRIGHT: [string, number][] = [
  ["255,214,150", 0.3],
  ["255,172,104", 0.18],
  ["255,255,255", 0.22],
  ["200,218,255", 0.3],
];

function pickWeighted(r: () => number, table: [string, number][]): string {
  let x = r();
  for (const [value, weight] of table) {
    if (x < weight) return value;
    x -= weight;
  }
  return table[0][0];
}

/**
 * Paints a Milky Way like a long-exposure photograph, sharp at any size: a band
 * running about 25 degrees up to the right, made of tens of thousands of crisp
 * stars (more along the band, but sprinkled across the whole sky), a few bright
 * coloured stars with a glint, soft warm haze, a pale core, and mottled dark dust
 * down its centre. The sky is drawn for a 1600-wide picture and scaled up by
 * W / 1600, so on a big screen it is drawn bigger instead of being stretched.
 */
function paintMilkyWay(c: CanvasRenderingContext2D, W: number, H: number, purple: HTMLImageElement | null) {
  const S = W / 1600;
  const r = rng(21);
  const theta = (-25 * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // band coordinates (u along the band, v across it) to canvas coordinates
  const toX = (u: number, v: number) => W * 0.5 + u * cos - v * sin;
  const toY = (u: number, v: number) => H * 0.5 + u * sin + v * cos;
  const along = (u: number) => Math.exp(-(u * u) / (2 * (W * 0.3) ** 2)); // 1 in the middle, fading out

  c.fillStyle = "#000";
  c.fillRect(0, 0, W, H);

  const glow = (x: number, y: number, rad: number, rgb: string, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };

  c.globalCompositeOperation = "lighter";
  // soft warm haze along the band, strongest in the middle
  for (let k = 0; k < 28; k++) {
    const u = gaussian(r) * W * 0.3;
    const v = gaussian(r) * H * 0.05;
    glow(toX(u, v), toY(u, v), (110 + r() * 230) * S, "200,170,130", 0.05 + 0.07 * along(u));
  }
  // the pale core, a little off centre
  glow(toX(W * 0.06, -H * 0.01), toY(W * 0.06, -H * 0.01), W * 0.2, "235,220,190", 0.05);
  glow(toX(W * 0.06, -H * 0.01), toY(W * 0.06, -H * 0.01), W * 0.08, "235,220,190", 0.03);
  // only a faint hint of colour elsewhere: blue-grey, and hydrogen-alpha red
  for (let k = 0; k < 6; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const u = (r() - 0.5) * W * 1.1;
    const v = side * (H * 0.24 + r() * H * 0.2);
    glow(toX(u, v), toY(u, v), (200 + r() * 160) * S, k % 3 === 0 ? "150,60,70" : "90,110,160", 0.03 + r() * 0.02);
  }
  // The purple Milky Way photograph, blended into the middle of the band at ~58% and feathered at its
  // edges, so the centre glows violet while the rest of the sky stays as it is.
  if (purple) {
    const m = document.createElement("canvas");
    m.width = W;
    m.height = H;
    const mc = m.getContext("2d");
    if (mc) {
      const pw = W * 0.7;
      const ph = (pw * purple.height) / purple.width;
      mc.translate(toX(W * 0.04, 0), toY(W * 0.04, 0));
      mc.rotate(theta);
      mc.drawImage(purple, -pw / 2, -ph / 2, pw, ph);
      // feather: keep an ellipse along the band, fading to nothing at its rim
      mc.globalCompositeOperation = "destination-in";
      mc.save();
      mc.scale(1, 0.46);
      const fade = mc.createRadialGradient(0, 0, 0, 0, 0, pw * 0.5);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(0.55, "rgba(0,0,0,.85)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      mc.fillStyle = fade;
      mc.fillRect(-pw, -pw, pw * 2, pw * 2);
      mc.restore();
      c.save();
      c.globalAlpha = 0.4;
      c.drawImage(m, 0, 0);
      c.restore();
    }
  }
  // small warm-brown dust glows near the centre, like the photograph's orange-brown patches
  for (let k = 0; k < 46; k++) {
    const u = gaussian(r) * W * 0.2;
    const v = gaussian(r) * H * 0.03;
    glow(toX(u, v), toY(u, v), (8 + r() * 26) * S, "176,104,62", 0.03 + r() * 0.05);
  }

  // tens of thousands of crisp stars: many along the band, plenty across the whole sky
  for (let i = 0; i < 60000; i++) {
    const broad = r() < 0.46;
    const u = broad ? (r() - 0.5) * W * 1.9 : gaussian(r) * W * 0.27;
    const spread = broad ? H * 0.34 : H * 0.065 * (0.75 + 0.5 * along(u));
    const v = gaussian(r) * spread;
    const density = Math.exp(-(v * v) / (2 * (H * 0.09) ** 2)) * (0.5 + 0.5 * along(u));
    const a = (0.12 + r() * r() * 0.8) * (broad ? 0.62 : 0.26 + 0.6 * density);
    const size = (r() < 0.05 ? 1.2 + r() * 0.8 : 0.55 + r() * 0.6) * Math.max(S, 1) * 0.9;
    c.fillStyle = `rgba(${pickWeighted(r, MW_STARS)},${a.toFixed(3)})`;
    c.fillRect(toX(u, v) - size / 2, toY(u, v) - size / 2, size, size);
  }

  // a few bright stars, in colour, each with a soft halo and the brightest with a glint
  for (let k = 0; k < 150; k++) {
    const x = r() * W;
    const y = r() * H;
    const size = (1.3 + r() * r() * 2.4) * Math.max(S, 1);
    const rgb = pickWeighted(r, MW_BRIGHT);
    glow(x, y, size * 4.2, rgb, 0.2);
    c.fillStyle = `rgba(${rgb},${(0.75 + r() * 0.25).toFixed(2)})`;
    c.beginPath();
    c.arc(x, y, size * 0.55, 0, Math.PI * 2);
    c.fill();
    if (size > 3.45 * Math.max(S, 1)) {
      const len = size * (3.4 + r() * 2.6);
      c.strokeStyle = `rgba(${rgb},0.45)`;
      c.lineWidth = Math.max(1, S * 0.8);
      c.beginPath();
      c.moveTo(x - len, y);
      c.lineTo(x + len, y);
      c.moveTo(x, y - len);
      c.lineTo(x, y + len);
      c.stroke();
    }
  }
}

export function startLanding(root: HTMLElement): () => void {
  const q = <T extends Element = HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`landing: missing ${sel}`);
    return el;
  };
  const qa = <T extends Element = HTMLElement>(sel: string): T[] =>
    Array.from(root.querySelectorAll<T>(sel));

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stopped = false;

  /* wheel drawings */
  q("#plate").innerHTML = wheel(false);
  q("#chartSvg").innerHTML = wheel(true);

  const vWords = splitWords(q("#vH"));
  const aWords = splitWords(q("#acct"));

  /* canvas scene */
  const cv = q<HTMLCanvasElement>("#cv");
  const ctx = cv.getContext("2d");
  let CW = 2;
  let CH = 2;
  let dpr = 1;
  let dirty = true;

  const R = rng(7);
  const stars: Star[] = [];
  const N = 1500;
  // Real stars: mostly white and blue-white, some cream, a few amber. Weights add to 1.
  const cols = ["255,255,255", "255,226,190", "255,200,140", "190,210,255"];
  const colourOf = (u: number) => (u < 0.38 ? 0 : u < 0.64 ? 3 : u < 0.88 ? 1 : 2);
  for (let i = 0; i < N; i++) {
    stars.push({
      x: (R() * 2 - 1) * 1.7,
      y: (R() * 2 - 1) * 1.7,
      z: R(),
      c: colourOf(R()),
      s: 0.4 + R() * 1.2,
    });
  }

  // A photographic Milky Way: a diagonal band of warm dust and stars with dark lanes.
  // It is drawn at about the size it will be shown, so it stays crisp rather than stretched.
  let neb: HTMLCanvasElement | null = null;
  let skyTimer = 0;
  let purpleImage: HTMLImageElement | null = null;
  const buildSky = () => {
    if (stopped) return;
    const width = Math.min(3200, Math.max(1600, Math.round(CW * 1.25)));
    const sky = document.createElement("canvas");
    sky.width = width;
    sky.height = Math.round((width * 9) / 16);
    const sctx = sky.getContext("2d");
    if (!sctx) return;
    paintMilkyWay(sctx, sky.width, sky.height, purpleImage);
    neb = sky;
    dirty = true;
  };

  // The galaxy the fly-in passes through. It is drawn already tilted (twice as wide as tall), so each
  // star stays a small crisp dot; squashing a square picture at draw time turned them into flat flakes.
  const gal = document.createElement("canvas");
  gal.width = 1800;
  gal.height = 900;
  const gctx = gal.getContext("2d");
  if (gctx) {
    const r = rng(33);
    gctx.save();
    gctx.translate(900, 450);
    gctx.scale(1, 0.5);
    const g = gctx.createRadialGradient(0, 0, 0, 0, 0, 640);
    g.addColorStop(0, "rgba(255,246,214,.7)");
    g.addColorStop(0.12, "rgba(255,224,160,.4)");
    g.addColorStop(0.5, "rgba(176,196,238,.12)");
    g.addColorStop(1, "rgba(96,116,170,0)");
    gctx.fillStyle = g;
    gctx.fillRect(-900, -900, 1800, 1800);
    gctx.restore();
    for (let i = 0; i < 15000; i++) {
      const arm = i % 2;
      const t = Math.pow(r(), 0.7); // 0 at the centre, 1 at the edge
      const th = arm * Math.PI + t * 5.6 + (r() - 0.5) * (0.5 + t * 1.54);
      const x = 900 + Math.cos(th) * t * 860;
      const y = 450 + Math.sin(th) * t * 430;
      const size = 0.5 + r() * r() * 1.5;
      gctx.fillStyle = `rgba(${Math.round(255 - t * 85)},${Math.round(238 - t * 42)},${Math.round(196 + t * 59)},${(0.2 + r() * 0.6) * (1 - t * 0.55) * 0.8})`;
      gctx.fillRect(x, y, size, size);
    }
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    CW = cv.width = Math.max(2, Math.round(cv.clientWidth * dpr));
    CH = cv.height = Math.max(2, Math.round(cv.clientHeight * dpr));
    dirty = true;
  }

  function cover(img: HTMLCanvasElement, scale: number, alpha: number, ox: number, oy: number) {
    if (!ctx) return;
    const k = Math.max(CW / img.width, CH / img.height) * scale;
    const w = img.width * k;
    const h = img.height * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (CW - w) / 2 + ox, (CH - h) / 2 + oy, w, h);
  }

  function scene(vp: number, pvp: number, sx: number, sy: number) {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#02030a");
    g.addColorStop(0.6, "#04060e");
    g.addColorStop(1, "#010208");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = "lighter";
    if (neb) cover(neb, 1 + vp * 0.2, 1, -sx * CW * 0.02, -sy * CH * 0.02);
    const ga = 0.55 * seg(vp, 0.06, 0.35) * (1 - 0.45 * seg(vp, 0.6, 1));
    if (ga > 0.01) {
      const s = Math.min(CW, CH) * (0.5 + vp * 2.1);
      ctx.save();
      ctx.translate(CW * (0.62 - 0.12 * vp) - sx * CW * 0.03, CH * (0.42 + 0.08 * vp) - sy * CH * 0.03);
      ctx.rotate(-0.35 + vp * 0.5);
      ctx.globalAlpha = ga;
      ctx.drawImage(gal, -s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    const cz = vp * 3;
    const pcz = pvp * 3;
    const f = Math.min(CW, CH) * 0.55;
    const cx = CW / 2 - sx * CW * 0.02;
    const cy = CH / 2 - sy * CH * 0.02;
    for (let i = 0; i < N; i++) {
      const st = stars[i];
      const d = ((((st.z - cz) % 1) + 1) % 1) * 0.98 + 0.02;
      const dp = ((((st.z - pcz) % 1) + 1) % 1) * 0.98 + 0.02;
      const k = 0.25 / d;
      const x = cx + st.x * f * k;
      const y = cy + st.y * f * k;
      if (x < -20 || x > CW + 20 || y < -20 || y > CH + 20) continue;
      const a = Math.min(1, Math.pow(1 - d, 0.8) * 0.95 + 0.05);
      const r = st.s * (0.5 + (1 - d) * 1.6) * dpr;
      const dd = Math.abs(dp - d);
      const col = `rgba(${cols[st.c]},${a.toFixed(2)})`;
      if (dd > 0.0004 && dd < 0.3) {
        const de = clamp(d + (dp - d) * 3, 0.02, 1.2);
        const k0 = 0.25 / de;
        ctx.strokeStyle = col;
        ctx.lineWidth = r;
        ctx.beginPath();
        ctx.moveTo(cx + st.x * f * k0, cy + st.y * f * k0);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
  }

  /* elements */
  const nav = q("#lnav");
  const story = q("#story");
  const cam = q("#cam");
  const plate = q("#plate");
  const front = q("#front");
  const fog = q("#fog");
  const rk1 = q("#rk1");
  const rk3 = q("#rk3");
  const h0 = q("#h0");
  const hud = q("#hud");
  const cap = q("#cap");
  const hint = q("#hint");
  const L0 = q("#L0");
  const L1 = q("#L1");
  const L2 = q("#L2");
  const L3 = q("#L3");
  const L4 = q("#L4");
  const vision = q("#vision");
  const vChip = q("#vChip");
  const vP = q("#vP");
  const chart = q("#chart");
  const hss = qa(".hs");
  const cred = q("#cred");
  const card = q("#card");
  const num = q("#num");
  const spark = q<SVGPolylineElement>("#spark");
  const feats = qa(".feat");
  const prog = q("#prog");
  const solEl = q("#sol");

  // The markup carries the real figures (so they are right without scripts);
  // the count-up starts from zero.
  if (!reduce) for (const b of qa("#stats b")) b.textContent = "0";

  let len = 300;
  try {
    len = spark.getTotalLength();
  } catch {
    /* jsdom and some engines have no SVG geometry; the fallback is fine */
  }
  spark.style.strokeDasharray = String(len);
  spark.style.strokeDashoffset = String(len);

  const vis = (el: HTMLElement | SVGElement, on: boolean) => {
    el.style.visibility = on ? "visible" : "hidden";
  };

  let sp = 0; // smoothed scroll progress
  let p = 0; // raw scroll progress
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  let last = 0;
  let pvp = -1;

  function apply() {
    const H = window.innerHeight;
    const vp = e2(seg(sp, 0.05, 0.7));
    cam.style.transform = `translate3d(${-sx * 18}px,${-sy * 12 + (1 - vp) * H * 0.06}px,0) scale(${1 + 0.02 * (1 - vp)})`;
    if (dirty || Math.abs(vp - pvp) > 1e-4 || Math.abs(sx) > 0.001 || Math.abs(sy) > 0.001) {
      scene(vp, pvp < 0 ? vp : pvp, sx, sy);
      pvp = vp;
      dirty = false;
    }
    /* wheel plate flies toward the camera */
    const po = 1 - seg(vp, 0.05, 0.3);
    plate.style.opacity = String(po);
    plate.style.transform = `translateX(-50%) translate3d(${-sx * 14}px,${-sy * 8}px,0) scale(${1 + vp * 5})`;
    vis(plate, po > 0);
    /* planets in front of the headline */
    const fo = seg(sp, 0.03, 0.16);
    front.style.opacity = String(1 - fo);
    front.style.filter = `blur(${fo * 8}px)`;
    front.style.transform = `translateX(-50%) translate3d(${-sx * 12}px,${-sy * 8 + fo * 50}px,0) scale(${1 + fo * 1.4})`;
    vis(front, fo < 1);
    /* small floating bodies fly past */
    const fp = seg(sp, 0.02, 0.2);
    const fe = fp * fp;
    const rocks: [HTMLElement, number, number, number][] = [
      [rk1, -0.3, -0.6, 1.3],
      [rk3, 1, 0.55, 1.8],
    ];
    for (const [el, ax, ay, d] of rocks) {
      el.style.transform = `translate3d(${ax * fp * 70 + sx * -24 * d}vw,${ay * fp * 60 + sy * -16 * d}vh,0) scale(${1 + fe * 1.6 * d})`;
      el.style.filter = `blur(${fe * 5 * d}px)`;
      vis(el, fp < 1);
    }
    /* hero copy */
    const h = seg(sp, 0.02, 0.1);
    h0.style.transform = `translate3d(${-sx * 10}px,${-h * 80 - sy * 6}px,0) scale(${1 + h * 0.12})`;
    h0.style.filter = `blur(${h * 14}px)`;
    h0.style.opacity = String(1 - h);
    hud.style.transform = `translate3d(${sx * 26}px,${sy * 18 - h * 40}px,0)`;
    hud.style.opacity = String(1 - seg(sp, 0.02, 0.08));
    const co = 1 - seg(sp, 0.01, 0.05);
    cap.style.opacity = String(co);
    hint.style.opacity = String(co);
    vis(L0, h < 1);
    vis(L1, h < 1);
    /* nebula bank */
    const fg = e3(seg(sp, 0.38, 0.47));
    fog.style.opacity = String(fg);
    fog.style.transform = `translate3d(${(fg - 1) * 18 + sx * -10}vw,${sy * -6}px,0)`;
    vis(fog, fg > 0);
    /* vision */
    const vIn = seg(sp, 0.16, 0.27);
    const vOut = seg(sp, 0.34, 0.42);
    vWords.forEach((w, i) => {
      const k = clamp(vIn * 1.6 - i * 0.08);
      w.style.transform = `translate3d(0,${(1 - k) * 30 - vOut * 60}px,0)`;
      w.style.filter = `blur(${(1 - k) * 12 + vOut * 14}px)`;
      w.style.opacity = String(k * (1 - vOut));
    });
    const vo = clamp(vIn * 2 - 0.6) * (1 - vOut);
    // a dark halo behind the words (see .vision:before), fading with them, keeps them readable over the bright core
    vision.style.setProperty("--shade", String(vo));
    for (const e of [vChip, vP]) {
      e.style.opacity = String(vo);
      e.style.transform = `translate3d(0,${-vOut * 50}px,0)`;
    }
    vis(L2, vIn > 0 && vOut < 1);
    /* chart plate */
    const cIn = e3(seg(sp, 0.42, 0.52));
    const cDim = seg(sp, 0.7, 0.78);
    chart.style.opacity = String(cIn * (1 - 0.72 * cDim));
    chart.style.filter = `blur(${cDim * 3}px)`;
    chart.style.transform = `translate(-50%,-50%) translate3d(${-sx * 16}px,${-sy * 10}px,0) scale(${0.9 + cIn * 0.1}) rotate(${(sp - 0.4) * 60}deg)`;
    vis(chart, cIn > 0);
    /* accounting + hotspots */
    const aIn = seg(sp, 0.45, 0.55);
    const aOut = seg(sp, 0.63, 0.68);
    aWords.forEach((w, i) => {
      const k = clamp(aIn * 2.2 - (i / aWords.length) * 1.2);
      w.style.opacity = String((0.15 + 0.85 * k) * (1 - aOut) * (aIn > 0 ? 1 : 0));
      w.style.filter = `blur(${(1 - k) * 6 + aOut * 10}px)`;
    });
    hss.forEach((e, i) => {
      const k = seg(sp, 0.49 + i * 0.02, 0.53 + i * 0.02);
      e.style.transform = `translate(${-11 + sx * -30}px,${-11 + sy * -20}px) scale(${k * (1 - aOut)})`;
      e.style.visibility = k * (1 - aOut) > 0 ? "visible" : "hidden";
    });
    vis(L3, aIn > 0 && aOut < 1);
    /* station */
    const sIn = seg(sp, 0.72, 0.82);
    cred.style.opacity = String(sIn);
    cred.style.filter = `blur(${(1 - sIn) * 8}px)`;
    cred.style.transform = `translate3d(0,${(1 - sIn) * 30}px,0)`;
    const cc = e3(seg(sp, 0.74, 0.86));
    card.style.opacity = String(cc);
    card.style.transform = `perspective(900px) translate3d(${sx * -14}px,${(1 - cc) * 60 + sy * -10}px,0) rotateY(${sx * 8}deg) rotateX(${-sy * 8}deg)`;
    num.textContent = (24.2 * seg(sp, 0.76, 0.9)).toFixed(1);
    spark.style.strokeDashoffset = String(len * (1 - seg(sp, 0.77, 0.92)));
    feats.forEach((e, i) => {
      const k = e3(seg(sp, 0.76 + i * 0.025, 0.82 + i * 0.025));
      e.style.opacity = String(k);
      e.style.transform = `translateX(${(1 - k) * 40}px)`;
    });
    vis(L4, sIn > 0);
    prog.style.transform = `scaleX(${sp})`;
  }

  let raf = 0;
  function tick(t: number) {
    if (stopped) return;
    const dt = Math.min(64, t - last);
    last = t;
    const r = story.getBoundingClientRect();
    p = clamp(-r.top / (story.offsetHeight - window.innerHeight));
    if (reduce) {
      sp = p;
    } else {
      sp += (p - sp) * (1 - Math.pow(0.86, dt / 16.7));
      if (Math.abs(p - sp) < 0.0002) sp = p;
    }
    sx += (mx - sx) * 0.06;
    sy += (my - sy) * 0.06;
    apply();
    raf = requestAnimationFrame(tick);
  }

  /* listeners */
  const onPointerMove = (e: PointerEvent) => {
    // Pointer parallax is motion the visitor did not ask for; skip it when
    // their system asks for less.
    if (reduce) return;
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", size);
  size();
  const purple = new Image();
  purple.onload = () => {
    purpleImage = purple;
    skyTimer = window.setTimeout(buildSky, 0);
  };
  purple.onerror = () => {
    skyTimer = window.setTimeout(buildSky, 0); // without the purple centre
  };
  purple.src = "/sky/milkyway-purple.webp";
  raf = requestAnimationFrame(tick);

  /* interactions */
  for (const h of hss) {
    h.addEventListener("click", () => {
      const on = h.classList.contains("on");
      for (const x of hss) x.classList.remove("on");
      if (!on) h.classList.add("on");
    });
  }
  for (const c of qa(".sc")) {
    c.addEventListener("pointermove", (e) => {
      if (reduce) return;
      const b = c.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5;
      const y = (e.clientY - b.top) / b.height - 0.5;
      c.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    });
    c.addEventListener("pointerleave", () => {
      c.style.transform = "";
    });
  }
  const toStory = (frac: number) => {
    const top = story.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (story.offsetHeight - window.innerHeight) * frac,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  q("#tour").addEventListener("click", () => toStory(0.5));
  q("#replay").addEventListener("click", () => toStory(0));

  /* stats count-up, and the nav's switch to dark text over the pale panel */
  let counted = false;
  function countUp() {
    const els = qa("#stats b");
    const t0 = performance.now();
    const step = (t: number) => {
      if (stopped) return;
      const k = e3(clamp((t - t0) / 1600));
      for (const b of els) b.textContent = String(Math.round(Number(b.dataset.to) * k));
      if (k < 1) requestAnimationFrame(step);
    };
    step(t0);
  }
  function onScroll() {
    const top = solEl.getBoundingClientRect().top;
    nav.classList.toggle("on-paper", top < 60);
    if (!counted && top < window.innerHeight * 0.6) {
      counted = true;
      if (reduce) {
        for (const b of qa("#stats b")) b.textContent = b.dataset.to ?? "";
      } else {
        countUp();
      }
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  return () => {
    stopped = true;
    window.clearTimeout(skyTimer);
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", size);
    window.removeEventListener("scroll", onScroll);
  };
}
