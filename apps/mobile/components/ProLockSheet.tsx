import { useMemo } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Placeholder upgrade teaser shown when a Free user taps a Pro-locked feature.
 *  No purchase CTA yet — the subscription flow is a separate, deferred slice. */
export function ProLockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.card} onStartShouldSetResponder={() => true}>
        <Text style={styles.title}>Unlock more cool features with Pro!</Text>
        <Text style={styles.body}>Pro adds the Date, Range & Compare views and per-planet Glyph customization.</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  card: {
    position: "absolute", left: 24, right: 24, top: "38%",
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 16,
    padding: 20,
  },
  title: { color: p.text, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  body: { color: p.textDim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  close: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  closeText: { color: p.bg, fontSize: 15, fontWeight: "700" },
});
