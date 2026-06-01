import { memo } from "react";
import type { MouseEvent } from "react";
import { R, polar, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions, PlanetKey } from "@astro/engine";
import type { Layer, VisMap } from "./types";

interface Props {
  pos: Positions;
  vis: VisMap;
  onEnter: (layer: Layer, key: PlanetKey, e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onLeave: () => void;
}

// The moveable glyphs — the planets at the selected moment, riding the live ring.
// Re-rendered every frame; cheap (≤10 text nodes + hover targets).
function LiveLayerBase({ pos, vis, onEnter, onMove, onLeave }: Props) {
  return (
    <g>
      {PLANET_KEYS.map((key) => {
        if (!vis[key]) return null;
        const [x, y] = polar(R.liveGlyph, pos[key]);
        return (
          <g key={key}>
            <text className="s-live" x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={31}>
              {PLANET_GLYPH[key]}
            </text>
            <circle
              cx={x}
              cy={y}
              r={19}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => onEnter("live", key, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
    </g>
  );
}

export const LiveLayer = memo(LiveLayerBase);
