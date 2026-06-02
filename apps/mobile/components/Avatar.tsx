import { memo } from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import type { Palette } from "@astro/engine";
import { GLYPH_FONT } from "./chart/palette";
import { useTheme } from "../lib/theme";

interface Props {
  /** Glyph shown as the default avatar image (the user's sign). */
  glyph: string;
  size?: number;
}

/** A circular avatar. Default content is the user's sign glyph, centered with the same
 *  baseline trick the chart layers use (textAnchor="middle" + dy ≈ 0.35·fontSize) so the
 *  symbol sits dead-center on web and device. A future `imageUri` could render an image. */
function AvatarBase({ glyph, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const r = size / 2;
  const fs = size * 0.5;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill={p.panel} stroke={p.live} strokeWidth={1.5} />
      <SvgText
        x={r}
        y={r}
        dy={fs * 0.35}
        fill={p.live}
        fontFamily={GLYPH_FONT}
        fontSize={fs}
        textAnchor="middle"
      >
        {glyph}
      </SvgText>
    </Svg>
  );
}

export const Avatar = memo(AvatarBase);
