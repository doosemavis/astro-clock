import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line, Circle, Text as SvgText } from "react-native-svg";
import { R, polar, declutter, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART, GLYPH_FONT } from "./palette";
import { useTheme } from "../../lib/theme";
import type { VisMap } from "../../lib/chartModel";

interface Props {
  positions: Positions;
  vis?: VisMap;
}

// Fixed birth glyphs on the inner ring, fanned out so a stellium doesn't overlap (declutter),
// each with a leader tick back to its true longitude and a bordered token (mirrors web NatalLayer).
function NatalLayerBase({ positions, vis }: Props) {
  const { palette: p } = useTheme();
  const disp = declutter(positions);
  const nodes: (ReactElement | null)[] = PLANET_KEYS.map((key) => {
    if (vis && !vis[key]) return null;
    const [tx, ty] = polar(R.signInner, positions[key]);
    const [gx, gy] = polar(R.natalGlyph, disp[key]);
    return (
      <G key={key}>
        <Line x1={tx} y1={ty} x2={gx} y2={gy} stroke={p.natal} strokeWidth={CHART.natalTickStroke} opacity={CHART.natalTickOpacity} />
        <Circle cx={gx} cy={gy} r={CHART.natalTokenR} fill={p.bg} stroke={p.natal} strokeWidth={CHART.tokenStroke} />
        <SvgText
          x={gx} y={gy}
          fill={p.natal}
          stroke={p.natal}
          strokeWidth={0.5}
          fontFamily={GLYPH_FONT}
          fontSize={CHART.natalGlyphSize}
          textAnchor="middle"
          dy={CHART.natalGlyphSize * 0.35}
        >
          {PLANET_GLYPH[key]}
        </SvgText>
      </G>
    );
  });
  return <G>{nodes}</G>;
}

export const NatalLayer = memo(NatalLayerBase);
