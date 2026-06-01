"use client";
import { memo, useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { formatDMS, PLANET_GLYPH } from "@astro/engine";
import type { Positions, PlanetKey } from "@astro/engine";
import { Dial } from "./Dial";
import { LiveLayer } from "./LiveLayer";
import { AspectLayer } from "./AspectLayer";
import { Tooltip } from "./Tooltip";
import type { TipState } from "./Tooltip";
import type { Layer, VisMap } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  /** Unique prefix for this wheel's Dial arc-path ids (two wheels share the DOM). */
  idPrefix: string;
  /** "Chart A" / "Chart B". */
  caption: string;
  /** Formatted date · time · tz for this wheel's moment. */
  subCaption: string;
  /** Planets at this wheel's selected moment. */
  pos: Positions;
  vis: VisMap;
  showMajor: boolean;
  showMinor: boolean;
  themeT: number;
}

/**
 * One Compare wheel: a self-contained chart for a single instant — the zodiac Dial, the
 * planets at this moment (LiveLayer), and the aspects among them — with its own hover
 * tooltip so the two wheels never cross-talk. No fixed natal overlay: each wheel IS a
 * chart for its own date/time (Chart A defaults to the birth instant, so it renders as
 * the birth chart until the user moves it).
 */
function CompareWheelBase({ idPrefix, caption, subCaption, pos, vis, showMajor, showMinor, themeT }: Props) {
  const [hover, setHover] = useState<PlanetKey | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const placeTip = useCallback((e: MouseEvent) => {
    let x = e.clientX + 16;
    const y = Math.max(8, e.clientY - 14);
    if (x > window.innerWidth - 180) x = e.clientX - 176;
    setTipPos({ x, y });
  }, []);
  const onEnter = useCallback((_layer: Layer, key: PlanetKey, e: MouseEvent) => { setHover(key); placeTip(e); }, [placeTip]);
  const onMove = useCallback((e: MouseEvent) => placeTip(e), [placeTip]);
  const onLeave = useCallback(() => setHover(null), []);

  const tip: TipState | null = hover
    ? { glyph: PLANET_GLYPH[hover], name: cap(hover), deg: formatDMS(pos[hover]), x: tipPos.x, y: tipPos.y }
    : null;

  return (
    <div className="ac-compare-cell">
      <div className="ac-compare-cap">
        <span className="cap-name">{caption}</span>
        <span className="cap-sub">{subCaption}</span>
      </div>
      <svg className="ac-chart" viewBox="0 0 1000 1000" aria-label={`${caption} chart`}>
        <Dial idPrefix={idPrefix} />
        <AspectLayer pos={pos} visLive={vis} showMajor={showMajor} showMinor={showMinor} themeT={themeT} />
        <LiveLayer pos={pos} vis={vis} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export const CompareWheel = memo(CompareWheelBase);
