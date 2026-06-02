import { memo } from "react";
import type { ReactElement } from "react";
import { G, Text as SvgText } from "react-native-svg";
import { R, polar, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART, GLYPH_FONT } from "./palette";
import { useTheme } from "../../lib/theme";

interface Props {
  positions: Positions;
}

// The moveable glyphs — the planets at the current moment, riding the inner live ring
// (R.liveGlyph). Brighter "live" color; mirrors the web LiveLayer.
function LiveLayerBase({ positions }: Props) {
  const { palette: p } = useTheme();
  const nodes: ReactElement[] = PLANET_KEYS.map((key) => {
    const [x, y] = polar(R.liveGlyph, positions[key]);
    return (
      <SvgText
        key={key}
        x={x}
        y={y}
        fill={p.live}
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
