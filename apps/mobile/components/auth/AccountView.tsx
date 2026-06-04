import { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { useEntitlement } from "../../hooks/useEntitlement";
import { presentProPaywall, restorePurchases, showManageSubscriptions } from "../../lib/purchases";

export function AccountView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { user, signOut, session } = useAuth();
  const { isPro } = useEntitlement(session);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function onRestore() {
    setMsg(null); setActing(true);
    const restored = await restorePurchases();
    setActing(false);
    setMsg(restored ? "Purchases restored." : "No active purchases found to restore.");
  }

  async function onManage() {
    setMsg(null);
    const opened = await showManageSubscriptions();
    if (!opened) setMsg("No store subscription to manage yet. In production this opens the Play subscriptions screen.");
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

          {!isPro ? (
            <Pressable style={styles.action} onPress={() => void presentProPaywall()}>
              <Text style={styles.actionText}>Upgrade to Pro</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.action} onPress={() => void onManage()}>
              <Text style={styles.actionText}>Manage subscription</Text>
            </Pressable>
          )}
          <Pressable style={styles.action} onPress={() => void onRestore()} disabled={acting}>
            <Text style={styles.actionText}>{acting ? "…" : "Restore purchases"}</Text>
          </Pressable>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
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
  action: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  actionText: { color: p.live, fontSize: 16, fontWeight: "700" },
  signout: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 22 },
  signoutOff: { opacity: 0.5 },
  signoutText: { color: "#ff6b6b", fontSize: 16, fontWeight: "700" },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
  msg: { color: p.textDim, fontSize: 13, marginTop: 10, lineHeight: 18 },
});
