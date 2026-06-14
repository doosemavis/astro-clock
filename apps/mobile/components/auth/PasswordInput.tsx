import { useMemo, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle, TextInputProps } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  style?: StyleProp<ViewStyle>;
};

/** Password field with a show/hide eye toggle. The caller's `style` (their `styles.input`)
 *  is applied to the bordered row; the TextInput is a flex child so the eye sits inside the
 *  box on the right. Defaults to hidden (secureTextEntry). */
export function PasswordInput({
  value, onChangeText, placeholder, placeholderTextColor, autoCapitalize = "none", style,
}: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [visible, setVisible] = useState(false);
  return (
    <View style={[style, s.row]}>
      <TextInput
        style={s.field}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={!visible}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={s.toggle}
      >
        <EyeIcon crossed={visible} color={p.textDim} />
      </Pressable>
    </View>
  );
}

/** Feather-style eye; a diagonal slash is added when `crossed` (password currently visible). */
function EyeIcon({ crossed, color }: { crossed: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <Circle cx={12} cy={12} r={3} />
      {crossed ? <Line x1={3} y1={3} x2={21} y2={21} /> : null}
    </Svg>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  // `style` (styles.input) supplies the border/background/padding; row lays out field + eye.
  row: { flexDirection: "row", alignItems: "center" },
  // Field re-declares text color/size (a View ignores them) and clears default padding.
  field: { flex: 1, padding: 0, color: p.text, fontSize: 16 },
  toggle: { paddingLeft: 10 },
});
