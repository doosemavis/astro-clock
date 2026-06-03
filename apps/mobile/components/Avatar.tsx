import { memo } from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import type { Palette } from "@astro/engine";
import { GLYPH_FONT } from "./chart/palette";
import { useTheme } from "../lib/theme";
import { textGlyph } from "../lib/glyph";

interface Props {
  /** Glyph shown as the default avatar image (the user's sign). */
  glyph: string;
  size?: number;
}

// Each zodiac glyph's ink sits a different fraction of an em ABOVE the alphabetic baseline
// in NotoSansSymbols — measured by rasterizing every sign and finding the ink centroid.
// SVG centers text by baseline/line-box, not ink, so we offset the baseline per glyph to
// land the *visible* symbol dead-center. (Values are vertical ink-center, in em, relative
// to the baseline; e.g. Leo's center is 0.25em above the baseline.)
const INK_EM_Y: Record<string, number> = {
  "♈": -0.38, "♉": -0.37, "♊": -0.35, "♋": -0.36, "♌": -0.25, "♍": -0.26,
  "♎": -0.36, "♏": -0.27, "♐": -0.35, "♑": -0.27, "♒": -0.35, "♓": -0.39,
};
const DEFAULT_EM_Y = -0.33;

/** A circular avatar. Default content is the user's sign glyph, centered by placing the
 *  alphabetic baseline at the measured ink offset so the symbol sits dead-center on web and
 *  device. A future `imageUri` could render an image instead. */
function AvatarBase({ glyph, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const r = size / 2;
  const fs = size * 0.5;
  const emY = INK_EM_Y[glyph] ?? DEFAULT_EM_Y;
  const baselineY = r - emY * fs; // ink center = baseline + emY·fs = r

  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill={p.panel} stroke={p.live} strokeWidth={1.5} />
      <SvgText x={r} y={baselineY} fill={p.live} fontFamily={GLYPH_FONT} fontSize={fs} textAnchor="middle">
        {textGlyph(glyph)}
      </SvgText>
    </Svg>
  );
}

export const Avatar = memo(AvatarBase);
