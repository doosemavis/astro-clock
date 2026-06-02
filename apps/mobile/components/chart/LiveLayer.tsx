import { memo } from "react";
import type { ReactElement } from "react";
import { G, Text as SvgText } from "react-native-svg";
import { R, polar, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART, GLYPH_FONT } from "./palette";
import { useTheme } from "../../lib/theme";
import type { VisMap } from "../../lib/chartModel";

interface Props {
  positions: Positions;
  vis?: VisMap;
}

// The moveable glyphs — the planets at the current moment, riding the inner live ring
// (R.liveGlyph). Brighter "live" color; mirrors the web LiveLayer.
function LiveLayerBase({ positions, vis }: Props) {
  const { palette: p } = useTheme();
  const nodes: (ReactElement | null)[] = PLANET_KEYS.map((key) => {
    if (vis && !vis[key]) return null;
    const [x, y] = polar(R.liveGlyph, positions[key]);
    return (
      <SvgText
        key={key}
        x={x}
        y={y}
        fill={p.live}
        stroke={p.live}
        strokeWidth={1.0}
        fontFamily={GLYPH_FONT}
        fontSize={CHART.liveGlyphSize}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {PLANET_GLYPH[key]}
      </SvgText>
    );
  });
  return <G>{nodes}</G>;
}

export const LiveLayer = memo(LiveLayerBase);
