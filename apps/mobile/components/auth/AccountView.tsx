import { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

export function AccountView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const name = (user?.user_metadata?.name as string | undefined) ?? null;
  const email = user?.email ?? "—";

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Account</Text>
          {name ? (
            <>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{name}</Text>
            </>
          ) : null}
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>

          <Pressable style={[styles.signout, busy && styles.signoutOff]} onPress={onSignOut} disabled={busy}>
            <Text style={styles.signoutText}>{busy ? "…" : "Sign out"}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28,
  },
  title: { color: p.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  label: { color: p.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 2 },
  value: { color: p.text, fontSize: 16 },
  signout: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 22 },
  signoutOff: { opacity: 0.5 },
  signoutText: { color: "#ff6b6b", fontSize: 16, fontWeight: "700" },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
});
