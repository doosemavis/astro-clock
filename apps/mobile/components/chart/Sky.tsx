import { memo, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { makeStars } from "../../lib/stars";

/** Full-screen sky backdrop behind the wheel: a day gradient that fades in with themeT and a
 *  starfield that fades out. themeT 0 = night (stars), 1 = day (gradient). Non-interactive. */
function SkyBase({ themeT, width: wProp, height: hProp }: { themeT: number; width?: number; height?: number }) {
  const win = useWindowDimensions();
  const width = wProp ?? win.width;
  const height = hProp ?? win.height;
  const stars = useMemo(() => makeStars(160, 0x5eed), []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky-day" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#bcd6f5" />
            <Stop offset="1" stopColor="#7fa3d4" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky-day)" opacity={themeT} />
        <G opacity={1 - themeT}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#ffffff" opacity={s.o} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

export const Sky = memo(SkyBase);
