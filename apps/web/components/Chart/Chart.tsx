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
import { CompareWheel } from "./CompareWheel";
import { useAnimationFrame } from "./useAnimationFrame";
import { DY, resolveDate, fmtDate, fmtTime, readoutTz, localApproxLoc } from "./chartModel";
import type { Mode, ThemeMode, TimeFormat, CompareLayout, Layer, Vis, VisMap } from "./types";
import { createClient } from "@/lib/supabase/client";
import { upsertPrimaryBirthChart } from "@/lib/birthCharts";

const STORAGE_KEY = "astroBirth";
const TIME_FORMAT_KEY = "ac:timeFormat";

const allVis = (value: boolean): VisMap =>
  PLANET_KEYS.reduce((m, k) => { m[k] = value; return m; }, {} as VisMap);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The living chart. The zodiac ring + birth glyphs stay fixed; the moveable glyphs
 * ride their true ephemeris positions for the selected moment. All astronomy, geometry,
 * color, and data come from @astro/engine — this component is the React renderer + the
 * interactive state (mode, theme, visibility, playback) ported from prototype/index.html.
 */
interface ChartProps {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  initialBirth?: BirthData | null;
}

export default function Chart({ userId = null, userEmail = null, userName = null, initialBirth = null }: ChartProps) {
  const anonymous = userId == null;

  // --- birth + derived natal data ---
  const [birth, setBirth] = useState<BirthData>(initialBirth ?? DEFAULT_BIRTH);
  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const bigThree = useMemo(() => {
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}  ·  ☽ ${signOf(natalPos.moon)}  ·  ↑ ${signOf(asc)}`;
  }, [birthMs, birth.lat, birth.lon, natalPos]);

  // --- control state ---
  const [mode, setMode] = useState<Mode>(userId && initialBirth ? "birth" : "now");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  // Global time format (12h default, persisted). SSR + first client render always use the
  // default to avoid a hydration mismatch; the mount effect below corrects from storage.
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  // Left-panel collapse. Session-only (NOT persisted) so a returning visitor never lands on
  // a hidden panel; the always-visible toggle button can reopen it.
  const [panelOpen, setPanelOpen] = useState(true);
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
  // Compare view: two independent moments. A defaults to the birth instant (so it renders
  // as the birth chart), B to "now" (seeded on mount). Layout is session-only.
  const [compareAMs, setCompareAMs] = useState(birthMs);
  const [compareBMs, setCompareBMs] = useState(birthMs);
  const [compareLayout, setCompareLayout] = useState<CompareLayout>("side");

  // --- per-frame state (null until the first client frame; keeps SSR deterministic) ---
  const [frame, setFrame] = useState<{ date: Date; t: number } | null>(null);
  const posRef = useRef(0);

  // --- tooltip ---
  const [hover, setHover] = useState<{ layer: Layer; key: PlanetKey } | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  // --- starfield mask ---
  const stageRef = useRef<HTMLDivElement>(null);
  const [starMask, setStarMask] = useState<string | undefined>(undefined);
  // "intersect" when there are two wheels (Compare) so both holes are cut; undefined for one.
  const [starMaskComposite, setStarMaskComposite] = useState<string | undefined>(undefined);

  // Load saved birth + seed now-based defaults on mount (client only -> no SSR drift).
  useEffect(() => {
    const now = Date.now();
    setRangeEndMs(now);
    setMomentMs(now);
    setCompareBMs(now); // Compare's Chart B starts at "now"; Chart A stays at the birth instant
    try {
      const tf = localStorage.getItem(TIME_FORMAT_KEY);
      if (tf === "12h" || tf === "24h") setTimeFormat(tf);
    } catch { /* ignore */ }

    if (userId) {
      // Logged in: if the account has no saved chart yet, migrate the local one once.
      if (!initialBirth) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const b = JSON.parse(raw) as BirthData;
            setBirth(b);
            void upsertPrimaryBirthChart(createClient(), b, userId);
          }
        } catch { /* ignore */ }
      }
      return;
    }
    // Anonymous: birth comes from localStorage (free chart still works logged out).
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBirth(JSON.parse(raw) as BirthData);
    } catch { /* ignore */ }
  }, [userId, initialBirth]);

  // Mask the starfield to the area outside the wheel (prototype updateStarMask).
  useEffect(() => {
    function measure() {
      const svgs = stageRef.current?.querySelectorAll("svg.ac-chart");
      if (!svgs || !svgs.length) return;
      const feather = 16;
      const grads: string[] = [];
      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        // The drawn wheel is the largest square centered in the (possibly letterboxed) box.
        const size = Math.min(rect.width, rect.height);
        if (!size) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = size * (R.outer / 1000);
        grads.push(`radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, rgba(0,0,0,0) ${(radius - feather).toFixed(1)}px, rgba(0,0,0,1) ${radius.toFixed(1)}px)`);
      });
      if (!grads.length) return;
      // Multiple holes need "intersect" so a point hidden by ANY wheel stays hidden.
      setStarMask(grads.join(", "));
      setStarMaskComposite(grads.length > 1 ? "intersect" : undefined);
    }
    const id = requestAnimationFrame(measure);
    const t = setTimeout(measure, 120);
    // Re-measure after the panel collapse/expand animation (~280ms) settles, so the mask
    // re-centers on the wheel's new position.
    const tAnim = setTimeout(measure, 340);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(id); clearTimeout(t); clearTimeout(tAnim); window.removeEventListener("resize", measure); };
  }, [panelOpen, mode, compareLayout]);

  // --- animation loop (prototype loop) ---
  useAnimationFrame(
    useCallback((dt: number) => {
      if (mode === "compare") return; // static: each wheel is computed directly from its moment
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

  // Compare: two independent charts, plus a single shared sky. Light/Dark are flat; Auto
  // follows Chart A's moment (two moments can't drive one sky) using the birth location.
  const compareAPos: Positions = useMemo(() => positions(new Date(compareAMs)), [compareAMs]);
  const compareBPos: Positions = useMemo(() => positions(new Date(compareBMs)), [compareBMs]);
  const compareThemeT = useMemo(() => {
    if (themeMode === "light") return 1;
    if (themeMode === "dark") return 0;
    return solarT(new Date(compareAMs), birth.lat, birth.lon);
  }, [themeMode, compareAMs, birth.lat, birth.lon]);
  const skyThemeT = mode === "compare" ? compareThemeT : themeT;

  // Mirror theme variables onto <html> so react-aria popovers (the date picker, its
  // month/year dropdowns) inherit them — those portal outside .ac-root, where var(--panel)
  // etc. would otherwise resolve to nothing and render transparent.
  useEffect(() => {
    const el = document.documentElement;
    const vars = themeVars(skyThemeT);
    for (const key in vars) el.style.setProperty(key, vars[key]);
  }, [skyThemeT]);

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
  const applyMode = useCallback((m: Mode) => { if (anonymous) return; setMode(m); setPlaying(false); }, [anonymous]);
  // Persist on change only — NOT via a [timeFormat] effect, which would fire on mount with
  // the default and clobber the stored value before the mount read applies it.
  const changeTimeFormat = useCallback((f: TimeFormat) => {
    setTimeFormat(f);
    try { localStorage.setItem(TIME_FORMAT_KEY, f); } catch { /* ignore */ }
  }, []);
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
    setCompareAMs(birthInstant(b).getTime());
    setEditing(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    if (userId) void upsertPrimaryBirthChart(createClient(), b, userId);
  }, [userId]);
  const togglePlay = useCallback(() => { if (posRef.current >= 1) posRef.current = 0; setPlaying((p) => !p); }, []);
  const resetPlay = useCallback(() => { posRef.current = 0; setPlaying(false); }, []);

  // --- readout (prototype roDate / roSub) ---
  const suffix = mode === "now" ? "   — live" : mode === "birth" ? "   — birth" : mode === "moment" ? "   — selected" : "";
  const readoutDate = mode === "compare"
    ? "Compare"
    : frame
      ? `${fmtDate(frame.date, mode, birth)}  ·  ${fmtTime(frame.date, mode, birth, timeFormat)}  ${readoutTz(frame.date, mode, birth)}`
      : "—";
  const readoutSub = mode === "compare"
    ? "Two charts · two moments"
    : frame ? `☉ ${degInSign(livePos.sun).toFixed(0)}° ${signOf(livePos.sun)}${suffix}` : "—";

  // Per-wheel captions for Compare (local zone, honoring the 12h/24h preference).
  const cmpCaption = (ms: number) =>
    `${fmtDate(new Date(ms), "moment", birth)} · ${fmtTime(new Date(ms), "moment", birth, timeFormat)} ${readoutTz(new Date(ms), "moment", birth)}`;

  // Location label shown in the Auto theme note (Now follows the viewer's timezone; others the chart).
  const themePlace = mode === "now"
    ? "your location"
    : birth.placeLabel || `(${birth.lat.toFixed(2)}, ${birth.lon.toFixed(2)})`;

  const rootStyle = { ...themeVars(skyThemeT) } as CSSProperties;

  return (
    <div className={`ac-root${panelOpen ? "" : " panel-collapsed"}`} style={rootStyle}>
      <StarLayer opacity={1 - skyThemeT} maskImage={starMask} maskComposite={starMaskComposite} />
      <CloudLayer opacity={skyThemeT} maskImage={starMask} maskComposite={starMaskComposite} />
      <button
        type="button"
        className="ac-panel-toggle"
        aria-expanded={panelOpen}
        aria-label={panelOpen ? "Collapse panel" : "Open panel"}
        onClick={() => setPanelOpen((v) => !v)}
      >
        {panelOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="14 6 8 12 14 18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        )}
      </button>
      <Panel
        name={(birth.name && birth.name !== "You") ? birth.name : (userName || "You")}
        userEmail={userEmail}
        bigThree={bigThree}
        readoutDate={readoutDate}
        readoutSub={readoutSub}
        mode={mode}
        themeMode={themeMode}
        timeFormat={timeFormat}
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
        compareAMs={compareAMs}
        compareBMs={compareBMs}
        compareLayout={compareLayout}
        onMode={applyMode}
        onTheme={setThemeMode}
        onTimeFormat={changeTimeFormat}
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
        onCompareA={setCompareAMs}
        onCompareB={setCompareBMs}
        onCompareLayout={setCompareLayout}
        locked={anonymous}
      />
      <div className={`ac-stage${mode === "compare" ? " is-compare" : ""}`} ref={stageRef}>
        {mode === "compare" ? (
          <div className={`ac-compare ${compareLayout}`}>
            <CompareWheel idPrefix="a-" caption="Chart A" subCaption={cmpCaption(compareAMs)} pos={compareAPos} vis={vis.natal} showMajor={showMajor} showMinor={showMinor} themeT={skyThemeT} />
            <CompareWheel idPrefix="b-" caption="Chart B" subCaption={cmpCaption(compareBMs)} pos={compareBPos} vis={vis.natal} showMajor={showMajor} showMinor={showMinor} themeT={skyThemeT} />
          </div>
        ) : (
          <svg className="ac-chart" viewBox="0 0 1000 1000" aria-label="living astrological chart">
            <Dial />
            {!anonymous && <NatalLayer natalPos={natalPos} vis={vis.natal} mode={mode} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />}
            {frame && <AspectLayer pos={livePos} visLive={vis.live} showMajor={showMajor} showMinor={showMinor} themeT={themeT} />}
            {frame && <LiveLayer pos={livePos} vis={vis.live} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />}
          </svg>
        )}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
