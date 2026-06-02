import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line } from "react-native-svg";
import { R, polar, findAspects, aspectColor } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import type { VisMap } from "../../lib/chartModel";

interface Props {
  positions: Positions;
  showMajor?: boolean;
  showMinor?: boolean;
  visLive?: VisMap;
}

// Lines between aspecting planet pairs, filtered by tier via the engine's findAspects.
// Colored for the dark theme (aspectColor(def, 0)); mirrors the web AspectLayer.
function AspectLayerBase({ positions, showMajor = true, showMinor = true, visLive }: Props) {
  const { t } = useTheme();
  const lines: ReactElement[] = findAspects(positions, { major: showMajor, minor: showMinor })
    .filter(({ a, b }) => !visLive || (visLive[a] && visLive[b]))
    .map(
    ({ a, b, def }) => {
      const [x1, y1] = polar(R.aspect, positions[a]);
      const [x2, y2] = polar(R.aspect, positions[b]);
      return (
        <Line
          key={`${a}-${b}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={aspectColor(def, t)}
          strokeWidth={def.width + 0.7}
          opacity={def.opacity}
          strokeDasharray={def.dash || undefined}
        />
      );
    },
  );
  return <G>{lines}</G>;
}

export const AspectLayer = memo(AspectLayerBase);
