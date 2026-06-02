import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimationFrame } from "../lib/useAnimationFrame";
import { DY, resolveDate } from "../lib/chartModel";
import type { Mode } from "../lib/chartModel";

export interface ChartClock {
  mode: Mode;
  setMode: (m: Mode) => void;
  displayInstant: Date;
  momentMs: number; setMomentMs: (ms: number) => void;
  rangeStartMs: number; setRangeStartMs: (ms: number) => void;
  rangeEndMs: number; setRangeEndMs: (ms: number) => void;
  playing: boolean; togglePlay: () => void;
  loop: boolean; toggleLoop: () => void;
  rate: number; setRate: (r: number) => void;
  resetPlay: () => void;
}

/**
 * Owns the living chart's time state and yields one `displayInstant` for the wheel.
 * Mirrors the web Chart.tsx animation logic; the one departure is Now, which ticks at
 * 1 Hz here (a setInterval) rather than every animation frame — real planetary motion
 * per second is imperceptible, so 1 Hz is smooth and battery-friendly.
 */
export function useChartClock(birthMs: number): ChartClock {
  const [mode, setModeRaw] = useState<Mode>("now");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(DY); // 1 day / sec
  const [momentMs, setMomentMs] = useState(birthMs);
  const [rangeStartMs, setRangeStartMs] = useState(birthMs);
  const [rangeEndMs, setRangeEndMs] = useState(birthMs);
  const posRef = useRef(0);
  const [displayInstant, setDisplayInstant] = useState<Date>(() => new Date());

  // Seed now-based defaults once on mount (Range end + Date moment start at "now").
  useEffect(() => {
    const now = Date.now();
    setRangeEndMs(now);
    setMomentMs(now);
  }, []);

  // Range start tracks the birth instant (re-seeds when the birth changes).
  useEffect(() => { setRangeStartMs(birthMs); }, [birthMs]);

  // Birth / Date: static frame.
  useEffect(() => {
    if (mode === "birth") setDisplayInstant(new Date(birthMs));
    else if (mode === "moment") setDisplayInstant(new Date(momentMs));
  }, [mode, birthMs, momentMs]);

  // Now: tick once per second.
  useEffect(() => {
    if (mode !== "now") return;
    setDisplayInstant(new Date());
    const id = setInterval(() => setDisplayInstant(new Date()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Range, paused or bounds changed: hold the frame at the current position.
  useEffect(() => {
    if (mode !== "range" || playing) return;
    setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, posRef.current));
  }, [mode, playing, birthMs, momentMs, rangeStartMs, rangeEndMs]);

  // Range, playing: advance pos each frame and resolve the instant.
  useAnimationFrame(
    useCallback((dt: number) => {
      const span = rangeEndMs - rangeStartMs;
      if (span > 0) posRef.current += (rate * dt) / span;
      if (posRef.current >= 1) {
        if (loop) posRef.current = 0;
        else { posRef.current = 1; setPlaying(false); }
      }
      setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, posRef.current));
    }, [loop, rate, birthMs, momentMs, rangeStartMs, rangeEndMs]),
    mode === "range" && playing,
  );

  const setMode = useCallback((m: Mode) => { setModeRaw(m); setPlaying(false); }, []);
  const togglePlay = useCallback(() => {
    if (posRef.current >= 1) posRef.current = 0;
    setPlaying((p) => !p);
  }, []);
  const toggleLoop = useCallback(() => setLoop((v) => !v), []);
  const resetPlay = useCallback(() => {
    posRef.current = 0;
    setPlaying(false);
    setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, 0));
  }, [birthMs, momentMs, rangeStartMs, rangeEndMs]);

  return {
    mode, setMode, displayInstant,
    momentMs, setMomentMs, rangeStartMs, setRangeStartMs, rangeEndMs, setRangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
  };
}
