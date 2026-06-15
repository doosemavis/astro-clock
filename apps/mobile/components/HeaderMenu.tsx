import { useMemo } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";
import { Segmented } from "./Segmented";
import type { ThemeMode } from "../lib/chartModel";

interface Props {
  visible: boolean;
  signedIn: boolean;
  canShare: boolean;            // Pro-only: show the Share item
  canSave: boolean;             // signed-in only: show the Save-to-Photos item
  themeMode: ThemeMode;
  onTheme: (m: ThemeMode) => void;
  onClose: () => void;
  onAuth: () => void;
  onEditBirth: () => void;
  onSave: () => void;           // Save chart to Photos (always includes the full image)
  onShare: () => void;          // Share chart (Pro)
  onReplayWalkthrough: () => void;  // replay the onboarding walkthrough
}

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];

/** Dropdown under the header ☰ button: auth (Sign in / Account) + Edit birth + Theme + Save to Photos. */
export function HeaderMenu({
  visible, signedIn, canShare, canSave, themeMode, onTheme, onClose, onAuth, onEditBirth, onSave, onShare, onReplayWalkthrough,
}: Props) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.card} onStartShouldSetResponder={() => true}>
        <Pressable style={styles.item} onPress={onAuth}>
          <Text style={styles.itemText}>{signedIn ? "Account" : "Sign in"}</Text>
        </Pressable>
        {signedIn ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.item} onPress={onEditBirth}>
              <Text style={styles.itemText}>Edit birth details</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.divider} />
        <View style={styles.themeRow}>
          <Text style={styles.themeLabel}>Theme</Text>
          <Segmented options={THEMES} value={themeMode} onChange={onTheme} />
        </View>

        <View style={styles.divider} />
        <Pressable style={styles.item} onPress={onReplayWalkthrough}>
          <Text style={styles.itemText}>How it works</Text>
        </Pressable>

        {canSave ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.item} onPress={onSave}>
              <Text style={styles.itemText}>Save to Photos</Text>
            </Pressable>
          </>
        ) : null}

        {canShare ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.item} onPress={onShare}>
              <Text style={styles.itemText}>Share…</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  card: {
    position: "absolute", top: 92, right: 20, minWidth: 210,
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 12,
    paddingVertical: 4,
  },
  item: { paddingVertical: 13, paddingHorizontal: 16 },
  themeRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  themeLabel: { color: p.textDim, fontSize: 13, fontWeight: "600" },
  itemText: { color: p.text, fontSize: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: p.border, marginHorizontal: 8 },
});
