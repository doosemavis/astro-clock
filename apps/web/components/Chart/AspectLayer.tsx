import { memo } from "react";
import type { ReactNode } from "react";
import { R, polar, aspectBetween, aspectColor, PLANET_KEYS } from "@astro/engine";
import type { Positions } from "@astro/engine";
import type { VisMap } from "./types";

interface Props {
  pos: Positions;
  visLive: VisMap;
  showMajor: boolean;
  showMinor: boolean;
  themeT: number;
}

// Lines between every pair of moveable glyphs that form an aspect, colored for the
// current theme, filtered by the major/minor toggles and per-planet visibility
// (prototype drawAspects).
function AspectLayerBase({ pos, visLive, showMajor, showMinor, themeT }: Props) {
  const lines: ReactNode[] = [];
  for (let i = 0; i < PLANET_KEYS.length; i++) {
    for (let j = i + 1; j < PLANET_KEYS.length; j++) {
      const a = PLANET_KEYS[i];
      const b = PLANET_KEYS[j];
      if (!visLive[a] || !visLive[b]) continue;
      const def = aspectBetween(pos[a], pos[b]);
      if (!def) continue;
      if (def.tier === "major" && !showMajor) continue;
      if (def.tier === "minor" && !showMinor) continue;
      const [x1, y1] = polar(R.aspect, pos[a]);
      const [x2, y2] = polar(R.aspect, pos[b]);
      lines.push(
        <line
          key={`${a}-${b}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={aspectColor(def, themeT)}
          strokeWidth={def.width}
          opacity={def.opacity}
          strokeDasharray={def.dash || undefined}
        />,
      );
    }
  }
  return <g>{lines}</g>;
}

export const AspectLayer = memo(AspectLayerBase);
