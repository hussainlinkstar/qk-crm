"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to the new one over ~600ms. Formatting stays with
 * the caller so money, counts and percentages all animate the same way. Honours reduced motion.
 */
export default function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-GB"),
  duration = 600,
}: {
  value: number;
  format?: (value: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // Frame timestamps can precede the effect's start time; clamp so easing never runs negative.
      const t = reduce ? 1 : Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      setShown(next);
      fromRef.current = next;
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    // Background tabs throttle animation frames; settle on the final value regardless.
    const settle = window.setTimeout(() => {
      window.cancelAnimationFrame(frame);
      setShown(value);
      fromRef.current = value;
    }, duration + 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value, duration]);

  return <>{format(shown)}</>;
}
