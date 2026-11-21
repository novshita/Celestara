// The slowly turning spiral galaxy inside a doorway, drawn on a canvas. Home's portal scene and the
// sealed door on the Profile and Journal pages both use it.

/** A small seeded random source: the galaxy's stars sit in the same places every visit. */
export function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The slowly turning spiral inside the doorway, drawn on a small canvas. */
export function startGalaxy(canvas: HTMLCanvasElement, animate: boolean): () => void {
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
