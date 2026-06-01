import { useEffect, useRef } from "react";

/**
 * Runs `callback(dtSeconds)` on every animation frame while `active`.
 * dt is clamped to 0.25s so a backgrounded tab can't fast-forward Range mode
 * (mirrors the prototype's `if (dt > 0.25) dt = 0.25`).
 *
 * The callback is held in a ref so changing it never restarts the rAF loop —
 * only `active` toggling starts/stops it.
 */
export function useAnimationFrame(callback: (dt: number) => void, active = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (t: number) => {
      if (last === null) last = t;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      cbRef.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
