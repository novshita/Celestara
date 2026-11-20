"use client";

import { useEffect, useRef } from "react";

import type { HomeSky } from "@/lib/sky";
import {
  ARC,
  GRAHA_LOOK,
  RING_ITEMS,
  STAGE,
  archMarkup,
  arcPathData,
  orbOffsets,
  arcPoint,
  ringStyle,
} from "@/lib/homeScene";
import type { Mode } from "@/lib/universe";

import { ChartOverlay } from "./ChartOverlay";
import { useJourney } from "./useJourney";

const ARCH = archMarkup();
const ARC_PATH = arcPathData();

/** A small seeded random source: the galaxy's stars sit in the same places every visit. */
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The slowly turning spiral inside the doorway, drawn on a small canvas. */
function startGalaxy(canvas: HTMLCanvasElement, animate: boolean): () => void {
  const x = canvas.getContext("2d");
  if (!x) return () => {};
  const W = canvas.width;
  const H = canvas.height;
  const r = rng(21);
  const n = 1500;
  const stars: [number, number, number][] = [];
  for (let i = 0; i < n; i++) stars.push([r(), r(), r()]);

  function draw(t: number) {
    if (!x) return;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = "#030816";
    x.fillRect(0, 0, W, H);
    const rot = t * 0.00022;
    const cx = W * 0.5;
    const cy = H * 0.46;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
    g.addColorStop(0, "rgba(255,226,170,.85)");
    g.addColorStop(0.12, "rgba(255,190,110,.4)");
    g.addColorStop(0.5, "rgba(50,100,190,.22)");
    g.addColorStop(1, "rgba(20,50,120,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    for (let k = 0; k < n; k++) {
      const p = stars[k];
      const rr = Math.pow(p[0], 0.62) * W * 0.62;
      const th = (k % 3) * 2.094 + rr * 0.034 + rot * (1 + (1 - p[0]) * 0.8) + (p[1] - 0.5) * 0.7;
      const xx = cx + Math.cos(th) * rr;
      const yy = cy + Math.sin(th) * rr * 1.05;
      const tt = rr / (W * 0.62);
      let cr: number;
      let cg: number;
      let cb: number;
      if (tt < 0.15) { cr = 255; cg = 232; cb = 185; }
      else if (tt < 0.5) { cr = 110; cg = 170; cb = 255; }
      else { cr = 50; cg = 110; cb = 190; }
      x.fillStyle = `rgba(${cr},${cg},${cb},${((0.25 + p[2] * 0.7) * (1 - tt * 0.5)).toFixed(2)})`;
      x.beginPath();
      x.arc(xx, yy, (((1 + p[2] * 2.2) * W) / 248) * 0.42, 0, 6.3);
      x.fill();
    }
  }
  draw(0);
  if (!animate) return () => {};

  let raf = 0;
  let last = 0;
  let visible = true;
  const loop = (t: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (t - last > 33) {
      last = t;
      draw(t);
    }
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  observer.observe(canvas);
  document.addEventListener("visibilitychange", start);
  start();
  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    document.removeEventListener("visibilitychange", start);
  };
}

const TOGGLES: { mode: Mode; label: string; aria: string; icon: string; left: number; top: number; cap: string }[] = [
  { mode: "vedic", label: "Vedic zodiac", aria: "Vedic zodiac", icon: "hm-cl", left: 187, top: 365, cap: "Vedic" },
  { mode: "compare", label: "Compare both zodiacs", aria: "Compare both zodiacs", icon: "hm-mn", left: 300, top: 272, cap: "Both" },
  { mode: "western", label: "Western zodiac", aria: "Western zodiac", icon: "hm-cr", left: 413, top: 365, cap: "Western" },
];

/**
 * The portal scene: a stair climbing to a glowing doorway under a great planet, with an arc
 * over the doorway that carries the nine grahas. The sky is real (the planets stand where the
 * backend says they do), and changing zodiac turns the signs around the planets, not the
 * planets around the signs. The painted layers are images, and the scene moves a little with
 * the pointer unless the visitor has asked for less motion.
 */
export function PortalScene({
  mode,
  onMode,
  sky,
  selected,
  onSelect,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  sky: HomeSky | null;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const journey = useJourney();
  const { scene, world, doorway, planetLayer, clouds, arcLayer, overlay } = journey.refs;
  const stars = useRef<HTMLDivElement>(null);
  const archLayer = useRef<HTMLDivElement>(null);
  const galaxy = useRef<HTMLCanvasElement>(null);

  const ayanamsa = sky?.ayanamsa ?? 24;
  const bodies = sky?.bodies ?? [];

  // The doorway's galaxy turns slowly (once, still, with reduced motion)
  useEffect(() => {
    const canvas = galaxy.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return startGalaxy(canvas, !reduced);
  }, []);

  // A little parallax: each layer drifts against the pointer by its own amount (inside the zoom, so both move together)
  useEffect(() => {
    const el = scene.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers: [HTMLElement | null, number][] = [
      [planetLayer.current, 10],
      [arcLayer.current, 6],
      [archLayer.current, 4],
    ];
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const apply = () => {
      raf = 0;
      px += (tx - px) * 0.07;
      py += (ty - py) * 0.07;
      for (const [layer, depth] of layers) {
        if (layer) layer.style.transform = `translate3d(${-px * depth}px,${-py * depth * 0.7}px,0)`;
      }
      if (clouds.current) clouds.current.style.transform = `translate3d(${-px * 16}px,${-py * 10}px,0)`;
      if (stars.current) stars.current.style.transform = `translate3d(${-px * 3}px,${-py * 2}px,0)`;
      if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) raf = requestAnimationFrame(apply);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      tx = (e.clientX - b.left) / b.width - 0.5;
      ty = (e.clientY - b.top) / b.height - 0.5;
      kick();
    };
    const leave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [scene, planetLayer, clouds, arcLayer]);

  const offsets = orbOffsets(bodies.map((b) => b.tropical));
  const picked = selected >= 0 ? bodies[selected] : undefined;
  const rawTip = picked ? arcPoint(picked.tropical, ARC.radius + 30 + Math.max(0, offsets[selected])) : null;
  // The label is centred on its point. Near either side it would be cut off, so it is moved in,
  // and then dropped below the planet so it does not cover it.
  const nearSide = rawTip !== null && (rawTip[0] < 56 || rawTip[0] > STAGE.width - 56);
  const tip = rawTip
    ? [Math.min(STAGE.width - 56, Math.max(56, rawTip[0])), Math.max(24, rawTip[1]) + (nearSide ? 38 : 0)]
    : null;

  return (
    <div
      ref={scene}
      className="hm-scene"
      aria-label="A stair climbing to a glowing doorway under a great planet. An arc over the doorway carries the nine grahas."
      role="group"
    >
      <div className="hm-stage">
        <div ref={world} className="hm-lay hm-world" style={{ transformOrigin: "300px 487px" }} inert={journey.inside}>
        <div className="hm-fade">
        <div ref={stars} className="hm-stars" aria-hidden="true" />
        <div ref={planetLayer} className="hm-lay" aria-hidden="true">
          <div className="hm-planet" />
          <span className="hm-glint" style={{ left: 130, top: 130 }}><i /></span>
          <span className="hm-glint" style={{ left: 470, top: 70, transform: "scale(.7)" }}><i /></span>
          <span className="hm-glint" style={{ left: 360, top: 205, transform: "scale(.55)" }}><i /></span>
        </div>
        <div ref={clouds} className="hm-clouds" aria-hidden="true" />
        </div>
        <div ref={arcLayer} className="hm-lay">
          <svg className="hm-arc" viewBox="0 0 600 740" aria-hidden="true" focusable="false">
            <path className="hm-g" d={ARC_PATH} />
            <path d={ARC_PATH} />
          </svg>
          <div>
            {RING_ITEMS.map((item) => {
              const style = ringStyle(item, mode, ayanamsa);
              const tone = item.system === "tropical" ? "hm-t" : "hm-s";
              return (
                <span key={`${item.system}-${item.index}`} aria-hidden="true">
                  <div className={`hm-ringitem ${tone}`} style={{ transform: style.tick.transform, opacity: style.opacity }}>
                    <i className="hm-rt" />
                  </div>
                  <div className={`hm-ringitem ${tone}`} style={{ transform: style.label.transform, opacity: style.opacity }}>
                    <span className="hm-rl">{item.name}</span>
                  </div>
                </span>
              );
            })}
          </div>
          <div style={{ pointerEvents: "none" }}>
            {bodies.map((body, i) => {
              const look = GRAHA_LOOK[body.name] ?? GRAHA_LOOK.Moon;
              const [left, top] = arcPoint(body.tropical, ARC.radius + offsets[i]);
              return (
                <button
                  key={body.name}
                  type="button"
                  className="hm-orb"
                  aria-pressed={selected === i}
                  aria-label={body.retrograde ? `${body.name}, retrograde` : body.name}
                  title={body.retrograde ? `${body.name} (retrograde)` : body.name}
                  data-code={body.name.slice(0, 2)}
                  style={{
                    left: left.toFixed(1) + "px",
                    top: top.toFixed(1) + "px",
                    ["--img" as string]: `url(/grahas/${look.slug}.webp)`,
                    ["--w" as string]: `${look.width}px`,
                    ["--h" as string]: `${look.height}px`,
                  }}
                  onClick={() => onSelect(selected === i ? -1 : i)}
                >
                  <i />
                </button>
              );
            })}
          </div>
          <div
            className={`hm-tip${tip ? " hm-on" : ""}`}
            aria-hidden="true"
            style={tip ? { left: tip[0], top: tip[1] } : undefined}
          >
            {picked?.name}
          </div>
          {TOGGLES.map((t) => (
            <button
              key={t.mode}
              type="button"
              className="hm-tg"
              aria-pressed={mode === t.mode}
              aria-label={t.aria}
              style={{ left: t.left, top: t.top }}
              onClick={(e) => {
                onMode(t.mode);
                journey.enter(e.currentTarget);
              }}
            >
              <i className={t.icon} />
              <span className="hm-cap">{t.cap}</span>
            </button>
          ))}
        </div>
        <div className="hm-fade">
        <div ref={archLayer} className="hm-lay">
          <svg className="hm-arch" viewBox="0 0 600 350" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ARCH }} />
          <div ref={doorway} className="hm-gxw"><canvas ref={galaxy} width={620} height={790} aria-hidden="true" /></div>
          <span className="hm-step-l">Enter your chart</span>
          <a
            className="hm-portal"
            href="#start"
            aria-label="Step through the doorway to your chart"
            onClick={(e) => {
              e.preventDefault();
              journey.enter(e.currentTarget);
            }}
          />
        </div>
        </div>
        </div>
        <ChartOverlay
          overlayRef={overlay}
          backRef={journey.backRef}
          inside={journey.inside}
          drawn={journey.overlayOn}
          mode={mode}
          onMode={onMode}
          sky={sky}
          selected={selected}
          onSelect={onSelect}
          onBack={journey.exit}
        />
      </div>
    </div>
  );
}
