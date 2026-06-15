import { memo } from "react";
import { Pressable } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../lib/theme";

interface Props {
  onPress: () => void;
  size?: number;
}

/** Round ☰ button (three lines) that opens the settings/account menu. */
function MenuButtonBase({ onPress, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const r = size / 2;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - 1} fill={p.panel} stroke={p.live} strokeWidth={1.5} />
        <Path
          d={`M${r - 8} ${r - 6} H${r + 8} M${r - 8} ${r} H${r + 8} M${r - 8} ${r + 6} H${r + 8}`}
          stroke={p.live}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

export const MenuButton = memo(MenuButtonBase);
