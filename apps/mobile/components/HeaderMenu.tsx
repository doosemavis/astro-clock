import { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";
import type { ExportSettings, ExportToggleKey } from "../lib/exportSettings";

interface Props {
  visible: boolean;
  signedIn: boolean;
  canShare: boolean;            // Pro-only: show the Share item
  canSave: boolean;             // signed-in only: show the Save-to-Photos item
  onClose: () => void;
  onAuth: () => void;
  onEditBirth: () => void;
  onSave: () => void;           // Save chart to Photos
  onShare: () => void;          // Share chart (Pro)
  exportSettings: ExportSettings;
  onToggleExport: (key: ExportToggleKey) => void;
  canToggleLogo: boolean;
}

/** Dropdown under the header avatar: auth (Sign in / Account) + Edit birth, plus a split
 *  "Save to Photos" button whose caret opens a floating options dropdown (overlays, with a
 *  shadow, and stays open while you flip toggles). */
export function HeaderMenu({
  visible, signedIn, canShare, canSave, onClose, onAuth, onEditBirth, onSave, onShare,
  exportSettings, onToggleExport, canToggleLogo,
}: Props) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [rowH, setRowH] = useState(46);
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

        {canSave ? (
          <>
            <View style={styles.divider} />
            {/* Split "Save to Photos" button; the caret opens a floating options dropdown. */}
            <View style={styles.splitWrap}>
              <View style={styles.splitRow} onLayout={(e) => setRowH(e.nativeEvent.layout.height)}>
                <Pressable style={styles.splitMain} onPress={onSave}>
                  <Text style={styles.itemText}>Save to Photos</Text>
                </Pressable>
                <Pressable style={styles.splitCaret} onPress={() => setOptionsOpen((o) => !o)} hitSlop={6}>
                  <Text style={styles.caretText}>{optionsOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
              </View>
              {optionsOpen ? (
                <View style={[styles.popover, { top: rowH + 4 }]}>
                  <ExportOption label="Date" on={exportSettings.dateTime} onPress={() => onToggleExport("dateTime")} />
                  <ExportOption label="Stars" on={exportSettings.cosmicBackground} onPress={() => onToggleExport("cosmicBackground")} />
                  {canToggleLogo ? (
                    <ExportOption label="Logo" on={exportSettings.logo} onPress={() => onToggleExport("logo")} />
                  ) : null}
                </View>
              ) : null}
            </View>
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

function ExportOption({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { palette: p } = useTheme();
  return (
    <Pressable style={optionStyles.row} onPress={onPress}>
      <Text style={{ color: p.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: on ? p.live : p.textDim }}>{on ? "On" : "Off"}</Text>
    </Pressable>
  );
}

const optionStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, paddingHorizontal: 18, gap: 18 },
});

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  card: {
    position: "absolute", top: 92, right: 20, minWidth: 210,
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 12,
    paddingVertical: 4,
  },
  item: { paddingVertical: 13, paddingHorizontal: 16 },
  itemText: { color: p.text, fontSize: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: p.border, marginHorizontal: 8 },
  // Split button: label area (saves) + a caret area (opens the floating options dropdown).
  splitWrap: { position: "relative", zIndex: 10 },
  splitRow: { flexDirection: "row", alignItems: "center" },
  splitMain: { flex: 1, paddingVertical: 13, paddingHorizontal: 16 },
  splitCaret: { paddingVertical: 13, paddingHorizontal: 16, borderLeftWidth: 1, borderLeftColor: p.border },
  caretText: { color: p.text, fontSize: 18, fontWeight: "700", transform: [{ scaleX: 1.4 }] },
  // Floating dropdown — overlays the items below with a shadow; anchored under the caret.
  popover: {
    position: "absolute", right: 0, minWidth: 184,
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 10,
    paddingVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12,
    elevation: 16, zIndex: 100,
  },
});
