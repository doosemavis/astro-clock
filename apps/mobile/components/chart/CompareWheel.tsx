import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";
import { NIGHT } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { Dial } from "./Dial";
import { AspectLayer } from "./AspectLayer";
import { LiveLayer } from "./LiveLayer";

interface Props {
  /** Unique per wheel ("a-" / "b-") so two Dials' <Defs> ids never collide on web. */
  idPrefix: string;
  /** "Chart A" / "Chart B". */
  caption: string;
  /** Formatted date · time · tz for this wheel's moment. */
  subCaption: string;
  /** Square edge length in px. */
  size: number;
  /** Planets at this wheel's moment. */
  pos: Positions;
  showMajor: boolean;
  showMinor: boolean;
}

/** One Compare chart for a single instant: the zodiac Dial, this moment's planets (live
 *  ring) and that moment's own aspects. No fixed natal overlay — mirrors the web CompareWheel. */
function CompareWheelBase({ idPrefix, caption, subCaption, size, pos, showMajor, showMinor }: Props) {
  return (
    <View style={styles.cell}>
      <Text style={styles.pill}>{`${caption}  ·  ${subCaption}`}</Text>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 1000 1000">
          <Dial idPrefix={idPrefix} />
          <AspectLayer positions={pos} showMajor={showMajor} showMinor={showMinor} />
          <LiveLayer positions={pos} />
        </Svg>
      </View>
    </View>
  );
}

export const CompareWheel = memo(CompareWheelBase);

const styles = StyleSheet.create({
  cell: { alignItems: "center" },
  // The same readout pill the other four views use (App.tsx `moment`): rounded, bordered,
  // panel-filled, tabular figures — here it reads "Chart A · date · time · tz".
  pill: {
    color: NIGHT.text, fontSize: 13, letterSpacing: 0.5, textAlign: "center",
    fontVariant: ["tabular-nums"],
    backgroundColor: NIGHT.panel, borderColor: NIGHT.border, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, overflow: "hidden",
    marginBottom: 10,
  },
});
