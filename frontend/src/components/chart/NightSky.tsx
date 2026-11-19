"use client";

import { useEffect, useRef } from "react";

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A still night sky behind the birth-chart page: near-black, a faint diagonal Milky Way
 * of tiny warm stars, and about nine hundred scattered stars in realistic colours. Drawn
 * once (and again, debounced, when the window is resized); nothing animates. */
function paint(canvas: HTMLCanvasElement) {
  const x = canvas.getContext("2d");
  if (!x) return;
  const d = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = (canvas.width = Math.round(window.innerWidth * d));
  const h = (canvas.height = Math.round(window.innerHeight * d));
  const r = rng(5);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#02030a");
  g.addColorStop(1, "#050a1c");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  x.save();
  x.translate(w * 0.62, h * 0.45);
  x.rotate(-0.42);
  for (let i = 0; i < 9; i++) {
    const gx = (i - 4) * w * 0.14;
    const rad = h * 0.35;
    const gg = x.createRadialGradient(gx, 0, 0, gx, 0, rad);
    gg.addColorStop(0, i > 2 && i < 6 ? "rgba(235,220,190,.07)" : "rgba(200,170,130,.04)");
    gg.addColorStop(1, "rgba(200,170,130,0)");
    x.fillStyle = gg;
    x.fillRect(gx - rad, -rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 5500; i++) {
    const u = (r() + r() + r() - 1.5) * w * 0.9;
    const v = (r() + r() + r() + r() - 2) * h * 0.16 * (1 - Math.abs(u) / (w * 0.8));
    x.fillStyle = `rgba(255,${225 + Math.round(r() * 30)},${190 + Math.round(r() * 60)},${0.1 + r() * 0.4})`;
    x.fillRect(u, v, d * 0.9, d * 0.9);
  }
  x.restore();

  const cols = ["255,255,255", "255,255,255", "190,210,255", "255,226,190", "255,200,140"];
  for (let i = 0; i < 900; i++) {
    const s = r() < 0.04 ? 1.8 : 1;
    x.fillStyle = `rgba(${cols[Math.floor(r() * 5)]},${0.2 + r() * 0.7})`;
    x.fillRect(r() * w, r() * h, s * d, s * d);
  }
}

export function NightSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paint(canvas);
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => paint(canvas), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return <canvas ref={ref} className="cx-sky" aria-hidden="true" />;
}
