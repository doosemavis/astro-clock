import { memo } from "react";
import type { MouseEvent } from "react";
import { R, polar, declutter, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions, PlanetKey } from "@astro/engine";
import type { Layer, Mode, VisMap } from "./types";

interface Props {
  natalPos: Positions;
  vis: VisMap;
  mode: Mode;
  onEnter: (layer: Layer, key: PlanetKey, e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onLeave: () => void;
}

// The fixed birth glyphs sit on an inner ring, fanned out so a stellium doesn't
// overlap (declutter), each with a leader tick back to its true longitude, a bordered
// token, and a hover target. Hidden in Birth view because there the moveable glyphs
// already sit on the birth positions (prototype applyVisibility).
function NatalLayerBase({ natalPos, vis, mode, onEnter, onMove, onLeave }: Props) {
  const disp = declutter(natalPos);
  return (
    <g>
      {PLANET_KEYS.map((key) => {
        if (mode === "birth" || !vis[key]) return null;
        const [tx, ty] = polar(R.signInner, natalPos[key]);
        const [gx, gy] = polar(R.natalGlyph, disp[key]);
        return (
          <g key={key}>
            <line className="s-ntick" x1={tx} y1={ty} x2={gx} y2={gy} strokeWidth={1.5} opacity={0.4} />
            <circle className="s-ntoken" cx={gx} cy={gy} r={16} strokeWidth={1.5} />
            <text className="s-natal" x={gx} y={gy} textAnchor="middle" dominantBaseline="central" fontSize={22}>
              {PLANET_GLYPH[key]}
            </text>
            <circle
              cx={gx}
              cy={gy}
              r={19}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => onEnter("natal", key, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
    </g>
  );
}

export const NatalLayer = memo(NatalLayerBase);
