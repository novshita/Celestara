// Pre-renders the three painted layers of the Home page's portal scene (the star field,
// the great teal planet and the cloud banks) from the drawing code in
// design/Celestara Home.html, into frontend/public/home/*.webp. They never change, so
// drawing them once here keeps the page free of the half-second of per-pixel work the
// planet would otherwise cost every visit.
//
//   node design/prepare_home.mjs        (needs the frontend's dev dependencies installed)
//
// Stars and clouds are drawn at twice their size, so they stay sharp on dense screens.

import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "public", "home");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const page = await browser.newPage();
await page.goto("about:blank");

const images = await page.evaluate(() => {
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  const webp = (c) => c.toDataURL("image/webp", 0.88);
  const result = {};

  // stars: 600 x 740 stage units, drawn at 2x, on a transparent ground
  {
    const d = 2, c = document.createElement("canvas"); c.width = 600 * d; c.height = 740 * d;
    const x = c.getContext("2d"); x.scale(d, d); const r = rng(3);
    // no background: the page's own sky shows through, so the scene has no rectangle of its own
    const cols = ["255,255,255", "255,255,255", "190,210,255", "255,226,190", "255,200,140"];
    for (let i = 0; i < 520; i++) { const s = r() < 0.06 ? 2 : r() < 0.3 ? 1.3 : 0.9; x.fillStyle = "rgba(" + cols[Math.floor(r() * 5)] + "," + (0.25 + r() * 0.75) + ")"; x.fillRect(r() * 600, r() * 500, s, s); }
    for (let i = 0; i < 7; i++) { const sx = 40 + r() * 520, sy = 30 + r() * 320, L = 10 + r() * 10; x.strokeStyle = "rgba(255,240,215,.7)"; x.lineWidth = 1; x.beginPath(); x.moveTo(sx - L, sy); x.lineTo(sx + L, sy); x.moveTo(sx, sy - L); x.lineTo(sx, sy + L); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(sx, sy, 1.8, 0, 6.3); x.fill(); }
    result.stars = webp(c);
  }

  // the great planet: marbled teal; drawn at 660 (the size it is shown at)
  {
    const N = 660, c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d"), im = x.createImageData(N, N), D = im.data;
    const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
    const vn = (a, b) => { const ai = Math.floor(a), bi = Math.floor(b), af = a - ai, bf = b - bi, u = af * af * (3 - 2 * af), v = bf * bf * (3 - 2 * bf); return hash(ai, bi) * (1 - u) * (1 - v) + hash(ai + 1, bi) * u * (1 - v) + hash(ai, bi + 1) * (1 - u) * v + hash(ai + 1, bi + 1) * u * v; };
    const fbm = (a, b) => { let s = 0, m = 0.5; for (let i = 0; i < 5; i++) { s += m * vn(a, b); a = a * 2.03 + 5.2; b = b * 2.03 + 1.3; m *= 0.5; } return s; };
    const ST = [[0, [3, 10, 24]], [0.35, [8, 66, 92]], [0.58, [18, 124, 156]], [0.78, [74, 196, 222]], [1, [205, 242, 250]]];
    const ramp = (t) => { let i = 0; while (i < ST.length - 2 && t > ST[i + 1][0]) i++; const a = ST[i], b = ST[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1); return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k]; };
    for (let py = 0; py < N; py++) for (let pxx = 0; pxx < N; pxx++) {
      const nx = (pxx / N) * 2 - 1, ny = (py / N) * 2 - 1, d2 = nx * nx + ny * ny, o = (py * N + pxx) * 4;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), u = nx / (0.55 + nz * 0.45), v = ny / (0.55 + nz * 0.45);
      const q = fbm(u * 2.1 + 3, v * 2.1), w = fbm(u * 3 + q * 2.6 + 1.7, v * 3 - q * 2.6), val = clamp((w - 0.22) * 1.9, 0, 1);
      const col = ramp(val), light = Math.max(0.1, -0.34 * nx - 0.5 * ny + 0.8 * nz), sh = 0.2 + 0.95 * light, rim = Math.pow(1 - nz, 3);
      D[o] = clamp(col[0] * sh + rim * 20, 0, 255); D[o + 1] = clamp(col[1] * sh + rim * 70, 0, 255); D[o + 2] = clamp(col[2] * sh + rim * 90, 0, 255);
      D[o + 3] = clamp((1 - Math.sqrt(d2)) * N * 0.5, 0, 1) * 255;
    }
    x.putImageData(im, 0, 0);
    result.planet = webp(c);
  }

  // clouds: 600 x 740 stage units, drawn at 2x
  {
    const d = 2, c = document.createElement("canvas"); c.width = 600 * d; c.height = 740 * d;
    const x = c.getContext("2d"); x.scale(d, d); const r = rng(9);
    function puff(px, py, rad) {
      let g = x.createRadialGradient(px, py + rad * 0.25, rad * 0.1, px, py + rad * 0.25, rad); g.addColorStop(0, "rgba(120,128,156,.55)"); g.addColorStop(1, "rgba(120,128,156,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py + rad * 0.25, rad, 0, 6.3); x.fill();
      g = x.createRadialGradient(px - rad * 0.15, py - rad * 0.2, rad * 0.05, px, py, rad); g.addColorStop(0, "rgba(248,245,252,.92)"); g.addColorStop(0.6, "rgba(214,214,230,.55)"); g.addColorStop(1, "rgba(200,200,222,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.3); x.fill();
    }
    const banks = [[110, 540, 150, 34], [500, 520, 150, 34], [300, 700, 300, 22], [40, 600, 70, 12], [560, 610, 70, 12]];
    banks.forEach((b) => { for (let j = 0; j < b[3]; j++) { const rr = 34 + r() * 54, ang = r() * 6.28, dist = Math.sqrt(r()) * b[2]; puff(b[0] + Math.cos(ang) * dist * 1.1, b[1] + Math.sin(ang) * dist * 0.38, rr); } });
    result.clouds = webp(c);
  }
  return result;
});

for (const [name, url] of Object.entries(images)) {
  const file = join(out, `${name}.webp`);
  writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  console.log(name.padEnd(7), Math.round(Buffer.from(url.split(",")[1], "base64").length / 1024), "KB");
}
await browser.close();
