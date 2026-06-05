import { useMemo } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";
import type { ExportSettings, ExportToggleKey } from "../lib/exportSettings";

interface Props {
  visible: boolean;
  signedIn: boolean;
  canShare: boolean;            // Pro-only: show the Share item
  onClose: () => void;
  onAuth: () => void;
  onEditBirth: () => void;
  onSave: () => void;           // Save chart to Photos
  onShare: () => void;          // Share chart (Pro)
  exportSettings: ExportSettings;
  onToggleExport: (key: ExportToggleKey) => void;
  canToggleLogo: boolean;
}

/** Small dropdown anchored under the header avatar: auth (Sign in / Account) + Edit birth.
 *  Tapping the backdrop closes it; taps on the card body are absorbed. */
export function HeaderMenu({ visible, signedIn, canShare, onClose, onAuth, onEditBirth, onSave, onShare, exportSettings, onToggleExport, canToggleLogo }: Props) {
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
        <Pressable style={styles.item} onPress={onSave}>
          <Text style={styles.itemText}>Save to Photos</Text>
        </Pressable>
        {canShare ? (
          <Pressable style={styles.item} onPress={onShare}>
            <Text style={styles.itemText}>Share…</Text>
          </Pressable>
        ) : null}
        <View style={styles.divider} />
        <ExportOption label="Date" on={exportSettings.dateTime} onPress={() => onToggleExport("dateTime")} />
        <ExportOption label="Stars" on={exportSettings.cosmicBackground} onPress={() => onToggleExport("cosmicBackground")} />
        {canToggleLogo ? (
          <ExportOption label="Logo" on={exportSettings.logo} onPress={() => onToggleExport("logo")} />
        ) : null}
      </View>
    </Modal>
  );
}

function ExportOption({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16 }}
      onPress={onPress}
    >
      <Text style={{ color: p.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: on ? p.live : p.textDim }}>{on ? "On" : "Off"}</Text>
    </Pressable>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  card: {
    position: "absolute", top: 92, right: 20, minWidth: 190,
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 12,
    paddingVertical: 4,
  },
  item: { paddingVertical: 13, paddingHorizontal: 16 },
  itemText: { color: p.text, fontSize: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: p.border, marginHorizontal: 8 },
});
