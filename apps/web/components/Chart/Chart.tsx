"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import {
  positions, birthInstant, ascendant, signOf, degInSign, formatDMS,
  themeVars, solarT, R, DEFAULT_BIRTH, PLANET_KEYS, PLANET_GLYPH,
} from "@astro/engine";
import type { BirthData, PlanetKey, Positions } from "@astro/engine";
import { Dial } from "./Dial";
import { StarLayer } from "./Starfield";
import { CloudLayer } from "./CloudLayer";
import { NatalLayer } from "./NatalLayer";
import { LiveLayer } from "./LiveLayer";
import { AspectLayer } from "./AspectLayer";
import { Tooltip } from "./Tooltip";
import type { TipState } from "./Tooltip";
import { Panel } from "./Panel";
import { useAnimationFrame } from "./useAnimationFrame";
import { DY, resolveDate, fmtDate, fmtTime, readoutTz, localApproxLoc } from "./chartModel";
import type { Mode, ThemeMode, Layer, Vis, VisMap } from "./types";

const STORAGE_KEY = "astroBirth";

const allVis = (value: boolean): VisMap =>
  PLANET_KEYS.reduce((m, k) => { m[k] = value; return m; }, {} as VisMap);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The living chart. The zodiac ring + birth glyphs stay fixed; the moveable glyphs
 * ride their true ephemeris positions for the selected moment. All astronomy, geometry,
 * color, and data come from @astro/engine — this component is the React renderer + the
 * interactive state (mode, theme, visibility, playback) ported from prototype/index.html.
 */
export default function Chart() {
  // --- birth + derived natal data ---
  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const bigThree = useMemo(() => {
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}  ·  ☽ ${signOf(natalPos.moon)}  ·  ↑ ${signOf(asc)}`;
  }, [birthMs, birth.lat, birth.lon, natalPos]);

  // --- control state ---
  const [mode, setMode] = useState<Mode>("now");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [vis, setVis] = useState<Vis>({ natal: allVis(true), live: allVis(true) });
  const [showMajor, setShowMajor] = useState(true);
  const [showMinor, setShowMinor] = useState(false);
  const [glyphPanelOpen, setGlyphPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(DY); // 1 day / sec
  const [rangeStartMs, setRangeStartMs] = useState(birthMs);
  const [rangeEndMs, setRangeEndMs] = useState(birthMs);
  const [momentMs, setMomentMs] = useState(birthMs);

  // --- per-frame state (null until the first client frame; keeps SSR deterministic) ---
  const [frame, setFrame] = useState<{ date: Date; t: number } | null>(null);
  const posRef = useRef(0);

  // --- tooltip ---
  const [hover, setHover] = useState<{ layer: Layer; key: PlanetKey } | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  // --- starfield mask ---
  const stageRef = useRef<HTMLDivElement>(null);
  const [starMask, setStarMask] = useState<string | undefined>(undefined);

  // Load saved birth + seed now-based defaults on mount (client only -> no SSR drift).
  useEffect(() => {
    const now = Date.now();
    setRangeEndMs(now);
    setMomentMs(now);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBirth(JSON.parse(raw) as BirthData);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Mask the starfield to the area outside the wheel (prototype updateStarMask).
  useEffect(() => {
    function measure() {
      const svg = stageRef.current?.querySelector("svg.ac-chart");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width * (R.outer / 1000);
      const feather = 16;
      setStarMask(
        `radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, rgba(0,0,0,0) ${(radius - feather).toFixed(1)}px, rgba(0,0,0,1) ${radius.toFixed(1)}px)`,
      );
    }
    const id = requestAnimationFrame(measure);
    const t = setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(id); clearTimeout(t); window.removeEventListener("resize", measure); };
  }, []);

  // --- animation loop (prototype loop) ---
  useAnimationFrame(
    useCallback((dt: number) => {
      if (mode === "range" && playing) {
        const span = rangeEndMs - rangeStartMs;
        if (span > 0) posRef.current += (rate * dt) / span;
        if (posRef.current >= 1) {
          if (loop) posRef.current = 0;
          else { posRef.current = 1; setPlaying(false); }
        }
      }
      const date = resolveDate(mode, birthMs, momentMs, rangeStartMs, rangeEndMs, posRef.current);
      let t: number;
      if (themeMode === "light") t = 1;
      else if (themeMode === "dark") t = 0;
      else if (mode === "range") t = 0;               // auto blend pauses while scrubbing
      else {
        // Now follows the viewer's current location (derived from their timezone);
        // Birth/Date describe a specific moment, so they use the chart's location.
        const loc = mode === "now" ? localApproxLoc() : birth;
        t = solarT(date, loc.lat, loc.lon);
      }
      setFrame((prev) =>
        prev && prev.date.getTime() === date.getTime() && prev.t === t ? prev : { date, t },
      );
    }, [mode, playing, loop, rate, birthMs, momentMs, rangeStartMs, rangeEndMs, themeMode, birth]),
  );

  const livePos: Positions = useMemo(() => (frame ? positions(frame.date) : natalPos), [frame, natalPos]);
  const themeT = frame?.t ?? 0;

  // Mirror theme variables onto <html> so react-aria popovers (the date picker, its
  // month/year dropdowns) inherit them — those portal outside .ac-root, where var(--panel)
  // etc. would otherwise resolve to nothing and render transparent.
  useEffect(() => {
    const el = document.documentElement;
    const vars = themeVars(themeT);
    for (const key in vars) el.style.setProperty(key, vars[key]);
  }, [themeT]);

  // --- tooltip handlers (stable refs so memoized layers don't churn each frame) ---
  const placeTip = useCallback((e: MouseEvent) => {
    let x = e.clientX + 16;
    const y = Math.max(8, e.clientY - 14);
    if (x > window.innerWidth - 180) x = e.clientX - 176;
    setTipPos({ x, y });
  }, []);
  const onEnter = useCallback((layer: Layer, key: PlanetKey, e: MouseEvent) => { setHover({ layer, key }); placeTip(e); }, [placeTip]);
  const onMove = useCallback((e: MouseEvent) => placeTip(e), [placeTip]);
  const onLeave = useCallback(() => setHover(null), []);

  const tip: TipState | null = hover
    ? {
        glyph: PLANET_GLYPH[hover.key],
        name: cap(hover.key),
        deg: formatDMS((hover.layer === "natal" ? natalPos : livePos)[hover.key]),
        x: tipPos.x, y: tipPos.y,
      }
    : null;

  // --- control handlers ---
  const applyMode = useCallback((m: Mode) => { setMode(m); setPlaying(false); }, []);
  const toggleVis = useCallback((key: PlanetKey | "all", layer: Layer) => {
    setVis((prev) => {
      const map = { ...prev[layer] };
      if (key === "all") {
        const anyOff = PLANET_KEYS.some((k) => !map[k]);
        PLANET_KEYS.forEach((k) => { map[k] = anyOff; });
      } else {
        map[key] = !map[key];
      }
      return { ...prev, [layer]: map };
    });
  }, []);
  const applyBirth = useCallback((b: BirthData) => {
    setBirth(b);
    setRangeStartMs(birthInstant(b).getTime());
    setEditing(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
  }, []);
  const togglePlay = useCallback(() => { if (posRef.current >= 1) posRef.current = 0; setPlaying((p) => !p); }, []);
  const resetPlay = useCallback(() => { posRef.current = 0; setPlaying(false); }, []);

  // --- readout (prototype roDate / roSub) ---
  const suffix = mode === "now" ? "   — live" : mode === "birth" ? "   — birth" : mode === "moment" ? "   — selected" : "";
  const readoutDate = frame
    ? `${fmtDate(frame.date, mode, birth)}  ·  ${fmtTime(frame.date, mode, birth)}  ${readoutTz(frame.date, mode, birth)}`
    : "—";
  const readoutSub = frame ? `☉ ${degInSign(livePos.sun).toFixed(0)}° ${signOf(livePos.sun)}${suffix}` : "—";

  // Location label shown in the Auto theme note (Now follows the viewer's timezone; others the chart).
  const themePlace = mode === "now"
    ? "your location"
    : birth.placeLabel || `(${birth.lat.toFixed(2)}, ${birth.lon.toFixed(2)})`;

  const rootStyle = { ...themeVars(themeT) } as CSSProperties;

  return (
    <div className="ac-root" style={rootStyle}>
      <StarLayer opacity={1 - themeT} maskImage={starMask} />
      <CloudLayer opacity={themeT} maskImage={starMask} />
      <Panel
        name={birth.name || "You"}
        bigThree={bigThree}
        readoutDate={readoutDate}
        readoutSub={readoutSub}
        mode={mode}
        themeMode={themeMode}
        birth={birth}
        placeLabel={themePlace}
        vis={vis}
        showMajor={showMajor}
        showMinor={showMinor}
        glyphPanelOpen={glyphPanelOpen}
        editing={editing}
        playing={playing}
        loop={loop}
        rate={rate}
        rangeStartMs={rangeStartMs}
        rangeEndMs={rangeEndMs}
        momentMs={momentMs}
        onMode={applyMode}
        onTheme={setThemeMode}
        onToggleMajor={() => setShowMajor((v) => !v)}
        onToggleMinor={() => setShowMinor((v) => !v)}
        onToggleGlyphPanel={() => setGlyphPanelOpen((v) => !v)}
        onToggleVis={toggleVis}
        onEditing={setEditing}
        onApplyBirth={applyBirth}
        onPlay={togglePlay}
        onLoop={() => setLoop((v) => !v)}
        onReset={resetPlay}
        onRate={setRate}
        onRangeStart={setRangeStartMs}
        onRangeEnd={setRangeEndMs}
        onMoment={setMomentMs}
      />
      <div className="ac-stage" ref={stageRef}>
        <svg className="ac-chart" viewBox="0 0 1000 1000" aria-label="living astrological chart">
          <Dial />
          <NatalLayer natalPos={natalPos} vis={vis.natal} mode={mode} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />
          {frame && <AspectLayer pos={livePos} visLive={vis.live} showMajor={showMajor} showMinor={showMinor} themeT={themeT} />}
          {frame && <LiveLayer pos={livePos} vis={vis.live} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />}
        </svg>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
