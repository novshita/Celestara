"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { journeyFrame, STAGE } from "@/lib/homeScene";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The journey into the doorway: zoom the scene into the door and show the chart wheel in it, and
 * back out again. It moves by click (the zodiac toggles, the doorway), by a scroll over the door,
 * and back by the button, Escape, or scrolling the other way. The frame-by-frame animation is
 * done on the elements directly, so React does not re-render sixty times a second; React only
 * hears about the two things it must draw: is the chart shown, and is the doorway "inside".
 *
 * With reduced motion there is no travel: it is in or out at once.
 */
export function useJourney() {
  // The elements it moves. It owns these references and hands them back, to be attached to the
  // scene's elements; the scene uses the same ones for its pointer drift.
  const scene = useRef<HTMLDivElement>(null);
  /** The whole doorway scene, which is moved and scaled. */
  const world = useRef<HTMLDivElement>(null);
  /** The doorway's galaxy, whose top corners straighten as it fills the scene. */
  const doorway = useRef<HTMLDivElement>(null);
  /** What the zoom leaves behind, which fades out. */
  const planetLayer = useRef<HTMLDivElement>(null);
  const clouds = useRef<HTMLDivElement>(null);
  const arcLayer = useRef<HTMLDivElement>(null);
  /** The chart inside the door, which fades in. */
  const overlay = useRef<HTMLDivElement>(null);

  const [inside, setInside] = useState(false);
  const [overlayOn, setOverlayOn] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const run = useRef({
    cur: 0,
    tgt: 0,
    raf: 0,
    settle: 0,
    focus: 0,
    trigger: null as HTMLElement | null,
  });

  const render = useCallback(() => {
    const frame = journeyFrame(run.current.cur);
    if (world.current) world.current.style.transform = frame.worldTransform;
    for (const layer of [planetLayer, clouds, arcLayer]) {
      if (layer.current) layer.current.style.opacity = String(frame.fade);
    }
    if (doorway.current) {
      const r = `${frame.radius.toFixed(1)}px`;
      doorway.current.style.borderRadius = `${r} ${r} 0 0`;
    }
    if (overlay.current) overlay.current.style.opacity = String(frame.overlay);
    // The scene's own edges fade as it fills the box, so the zoomed galaxy melts into the page;
    // at rest the fade is off, so it never dims a planet standing near a side.
    scene.current?.style.setProperty("--edge", String(1 - frame.ease));
  }, []);

  const focusLater = useCallback((target: "back" | "trigger") => {
    window.clearTimeout(run.current.focus);
    run.current.focus = window.setTimeout(() => {
      if (target === "back") backRef.current?.focus({ preventScroll: true });
      else run.current.trigger?.focus({ preventScroll: true });
    }, 0);
  }, []);

  // The animation calls itself every frame; going through a ref lets it do that without referring to itself
  const stepRef = useRef<() => void>(() => {});
  const step = useCallback(() => {
    const r = run.current;
    r.cur += (r.tgt - r.cur) * 0.06;
    if (Math.abs(r.tgt - r.cur) < 0.002) r.cur = r.tgt;
    render();
    if (r.cur === r.tgt) {
      r.raf = 0;
      if (r.tgt === 0) setOverlayOn(false);
      focusLater(r.tgt === 1 ? "back" : "trigger");
    } else {
      r.raf = requestAnimationFrame(() => stepRef.current());
    }
  }, [render, focusLater]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const go = useCallback(
    (target: 0 | 1) => {
      const r = run.current;
      r.tgt = target;
      window.clearTimeout(r.settle);
      setInside(target === 1);
      if (target === 1) setOverlayOn(true);
      if (reducedMotion()) {
        r.cur = target;
        render();
        if (target === 0) setOverlayOn(false);
        focusLater(target === 1 ? "back" : "trigger");
        return;
      }
      if (!r.raf) r.raf = requestAnimationFrame(() => stepRef.current());
    },
    [render, focusLater],
  );

  const enter = useCallback(
    (trigger: HTMLElement | null) => {
      run.current.trigger = trigger;
      go(1);
    },
    [go],
  );
  const exit = useCallback(() => go(0), [go]);

  // Scrolling over the door travels in; scrolling back travels out. It only takes the wheel over
  // the doorway at rest (so the page still scrolls everywhere else) and while it is mid-journey
  // or fully inside and scrolled outwards.
  useEffect(() => {
    const sceneEl = scene.current;
    if (!sceneEl) return;
    const onWheel = (e: WheelEvent) => {
      if (reducedMotion()) return;
      const r = run.current;
      const box = sceneEl.getBoundingClientRect();
      const x = ((e.clientX - box.left) / box.width) * STAGE.width;
      const y = ((e.clientY - box.top) / box.height) * STAGE.height;
      const onDoor = x > 190 && x < 410 && y > 390;
      const midway = r.cur > 0.01 && r.cur < 0.99;
      const leaving = r.cur >= 0.99 && e.deltaY < 0;
      const arriving = r.cur <= 0.01 && e.deltaY > 0 && onDoor;
      if (!(midway || leaving || arriving)) return;
      e.preventDefault();
      window.cancelAnimationFrame(r.raf);
      r.raf = 0;
      r.cur = Math.min(1, Math.max(0, r.cur + e.deltaY * 0.0016));
      r.tgt = r.cur;
      setInside(r.cur > 0.5);
      setOverlayOn(true);
      render();
      window.clearTimeout(r.settle);
      r.settle = window.setTimeout(() => go(r.cur > 0.5 ? 1 : 0), 450);
    };
    sceneEl.addEventListener("wheel", onWheel, { passive: false });
    return () => sceneEl.removeEventListener("wheel", onWheel);
  }, [go, render]);

  // Escape steps back out
  useEffect(() => {
    if (!inside) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inside, go]);

  useEffect(
    () => () => {
      const r = run.current;
      window.cancelAnimationFrame(r.raf);
      window.clearTimeout(r.settle);
      window.clearTimeout(r.focus);
    },
    [],
  );

  return {
    inside,
    overlayOn,
    backRef,
    enter,
    exit,
    refs: { scene, world, doorway, planetLayer, clouds, arcLayer, overlay },
  };
}
