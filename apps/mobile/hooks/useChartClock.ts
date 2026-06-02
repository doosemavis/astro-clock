import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "../lib/useAnimationFrame";
import { DY, resolveDate } from "../lib/chartModel";
import type { Mode, CompareView, CompareMoment } from "../lib/chartModel";
import { zonedInstant } from "../lib/timezone";
import type { BirthData } from "@astro/engine";

const localZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
};
const z2 = (n: number) => String(n).padStart(2, "0");
const birthMoment = (b: BirthData): CompareMoment => ({ date: b.date, time: b.time, zone: b.ianaTz ?? localZone() });
const nowMoment = (): CompareMoment => {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`,
    time: `${z2(d.getHours())}:${z2(d.getMinutes())}`,
    zone: localZone(),
  };
};

export interface ChartClock {
  mode: Mode;
  setMode: (m: Mode) => void;
  displayInstant: Date;
  momentMs: number; setMomentMs: (ms: number) => void;
  rangeStart: CompareMoment; setRangeStart: (m: CompareMoment) => void;
  rangeEnd: CompareMoment; setRangeEnd: (m: CompareMoment) => void;
  rangeStartMs: number; rangeEndMs: number;
  playing: boolean; togglePlay: () => void;
  loop: boolean; toggleLoop: () => void;
  rate: number; setRate: (r: number) => void;
  resetPlay: () => void;
  compareA: CompareMoment; setCompareA: (m: CompareMoment) => void;
  compareB: CompareMoment; setCompareB: (m: CompareMoment) => void;
  compareAMs: number; compareBMs: number;
  compareView: CompareView; setCompareView: (v: CompareView) => void;
}

/**
 * Owns the living chart's time state and yields one `displayInstant` for the wheel.
 * Mirrors the web Chart.tsx animation logic; the one departure is Now, which ticks at
 * 1 Hz here (a setInterval) rather than every animation frame — real planetary motion
 * per second is imperceptible, so 1 Hz is smooth and battery-friendly.
 */
export function useChartClock(birthMs: number, birth: BirthData): ChartClock {
  const [mode, setModeRaw] = useState<Mode>("now");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(DY); // 1 day / sec
  const [momentMs, setMomentMs] = useState(birthMs);
  const [rangeStart, setRangeStart] = useState<CompareMoment>(() => birthMoment(birth));
  const [rangeEnd, setRangeEnd] = useState<CompareMoment>(() => nowMoment());
  const rangeStartMs = useMemo(() => zonedInstant(rangeStart.date, rangeStart.time, rangeStart.zone), [rangeStart]);
  const rangeEndMs = useMemo(() => zonedInstant(rangeEnd.date, rangeEnd.time, rangeEnd.zone), [rangeEnd]);
  const [compareA, setCompareA] = useState<CompareMoment>(() => birthMoment(birth));
  const [compareB, setCompareB] = useState<CompareMoment>(() => nowMoment());
  const [compareView, setCompareView] = useState<CompareView>("both");
  const compareAMs = useMemo(() => zonedInstant(compareA.date, compareA.time, compareA.zone), [compareA]);
  const compareBMs = useMemo(() => zonedInstant(compareB.date, compareB.time, compareB.zone), [compareB]);
  const posRef = useRef(0);
  const [displayInstant, setDisplayInstant] = useState<Date>(() => new Date());

  // Seed the Date-mode moment to "now" once on mount.
  useEffect(() => { setMomentMs(Date.now()); }, []);

  // Range "From" and Compare's Chart A track the birth (re-seed when the birth changes).
  useEffect(() => {
    const bm = birthMoment(birth);
    setRangeStart(bm);
    setCompareA(bm);
  }, [birth.date, birth.time, birth.ianaTz]);

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
    momentMs, setMomentMs, rangeStart, setRangeStart, rangeEnd, setRangeEnd, rangeStartMs, rangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
    compareA, setCompareA, compareB, setCompareB, compareAMs, compareBMs, compareView, setCompareView,
  };
}
