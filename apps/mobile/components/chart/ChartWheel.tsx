import { memo } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg from "react-native-svg";
import type { Positions } from "@astro/engine";
import { CHART } from "./palette";
import { Dial } from "./Dial";
import { AspectLayer } from "./AspectLayer";
import { NatalLayer } from "./NatalLayer";

interface Props {
  positions: Positions;
  curvedLabels?: boolean;
}

// One square <Svg> sized to the screen. Z-order: aspect lines under the dial, glyphs on top.
function ChartWheelBase({ positions, curvedLabels = true }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 1000 1000">
        <AspectLayer positions={positions} />
        <Dial curvedLabels={curvedLabels} />
        <NatalLayer positions={positions} />
      </Svg>
    </View>
  );
}

export const ChartWheel = memo(ChartWheelBase);
