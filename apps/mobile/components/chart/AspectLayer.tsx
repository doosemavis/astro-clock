import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line } from "react-native-svg";
import { R, polar, aspectBetween, aspectColor, PLANET_KEYS } from "@astro/engine";
import type { Positions } from "@astro/engine";

interface Props {
  positions: Positions;
}

// One line between every pair of natal planets that forms an aspect, colored for the dark
// theme (aspectColor(def, 0)). Static natal wheel: every detected aspect is drawn.
function AspectLayerBase({ positions }: Props) {
  const lines: ReactElement[] = [];
  for (let i = 0; i < PLANET_KEYS.length; i++) {
    for (let j = i + 1; j < PLANET_KEYS.length; j++) {
      const a = PLANET_KEYS[i];
      const b = PLANET_KEYS[j];
      const def = aspectBetween(positions[a], positions[b]);
      if (!def) continue;
      const [x1, y1] = polar(R.aspect, positions[a]);
      const [x2, y2] = polar(R.aspect, positions[b]);
      lines.push(
        <Line
          key={`${a}-${b}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={aspectColor(def, 0)}
          strokeWidth={def.width}
          opacity={def.opacity}
          strokeDasharray={def.dash || undefined}
        />,
      );
    }
  }
  return <G>{lines}</G>;
}

export const AspectLayer = memo(AspectLayerBase);
