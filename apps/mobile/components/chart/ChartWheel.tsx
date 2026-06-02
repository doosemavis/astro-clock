import { memo } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg from "react-native-svg";
import type { Positions } from "@astro/engine";
import type { Vis } from "../../lib/chartModel";
import { CHART } from "./palette";
import { Dial } from "./Dial";
import { AspectLayer } from "./AspectLayer";
import { NatalLayer } from "./NatalLayer";
import { LiveLayer } from "./LiveLayer";

interface Props {
  natalPositions: Positions;
  livePositions: Positions;
  curvedLabels?: boolean;
  showMajor?: boolean;
  showMinor?: boolean;
  vis?: Vis;
}

// One square <Svg> sized to the screen. Birth glyphs on the outer ring (fixed); the moveable
// "now" glyphs ride the inner live ring; aspect lines connect the moveable positions.
function ChartWheelBase({ natalPositions, livePositions, curvedLabels = true, showMajor = true, showMinor = true, vis }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 1000 1000">
        <Dial curvedLabels={curvedLabels} />
        <NatalLayer positions={natalPositions} vis={vis?.natal} />
        <AspectLayer positions={livePositions} showMajor={showMajor} showMinor={showMinor} visLive={vis?.live} />
        <LiveLayer positions={livePositions} vis={vis?.live} />
      </Svg>
    </View>
  );
}

export const ChartWheel = memo(ChartWheelBase);
