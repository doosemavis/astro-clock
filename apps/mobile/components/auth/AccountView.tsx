import { useMemo, useState, useEffect } from "react";
import { Modal, View, Text, Pressable, StyleSheet, TextInput, Keyboard, Linking, Platform } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { useEntitlement } from "../../hooks/useEntitlement";
import { presentProPaywall, restorePurchases, showManageSubscriptions } from "../../lib/purchases";
import { validatePassword, passwordsMatch } from "../../lib/password";
import { storeUrl } from "../../lib/rateApp";

type Screen = "main" | "password";

// Account/data deletion is handled on the web (a server endpoint with the service role).
// The app links out to that page rather than deleting from the client.
const DELETE_ACCOUNT_URL = "https://movestar-web.vercel.app/delete-account";

export function AccountView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { user, signOut, session, setAccountPassword } = useAuth();
  const { isPro } = useEntitlement(session);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("main");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [kbHeight, setKbHeight] = useState(0);

  // This is a bottom-anchored sheet, so the soft keyboard would cover its inputs. Lift the sheet
  // by the keyboard height while it's open, and reset to exactly 0 on hide so it drops flush again
  // (KeyboardAvoidingView leaves a residual inset inside a Modal on Android — this does not).
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // A signed-in OAuth user has no "email" identity until they set a password.
  const hasPassword = user?.identities?.some((i) => i.provider === "email") ?? false;
  const name = (user?.user_metadata?.name as string | undefined) ?? null;
  const email = user?.email ?? "—";

  function resetPwFields() {
    setNewPw("");
    setConfirmPw("");
  }

  // Leave the sheet in a clean state so the next open always starts on the main screen.
  function close() {
    setScreen("main");
    resetPwFields();
    setMsg(null);
    onClose();
  }

  function openPassword() {
    setMsg(null);
    resetPwFields();
    setScreen("password");
  }

  function backToMain() {
    setMsg(null);
    resetPwFields();
    setScreen("main");
  }

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      close();
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setMsg(null);
    setActing(true);
    const restored = await restorePurchases();
    setActing(false);
    setMsg(restored ? "Purchases restored." : "No active purchases found to restore.");
  }

  async function onManage() {
    setMsg(null);
    const opened = await showManageSubscriptions();
    if (!opened) setMsg("No store subscription to manage yet. In production this opens the Play subscriptions screen.");
  }

  async function onSavePassword() {
    const v = validatePassword(newPw);
    if (!v.ok) { setMsg(`Password needs ${v.problems.join(", ")}.`); return; }
    if (!passwordsMatch(newPw, confirmPw)) { setMsg("Passwords don't match."); return; }
    setMsg(null);
    setActing(true);
    const wasSet = !hasPassword;
    const r = await setAccountPassword(newPw);
    setActing(false);
    if (r.error) { setMsg(r.error); return; }
    // Success: return to the main screen and surface the outcome there.
    resetPwFields();
    setScreen("main");
    setMsg(wasSet ? "Password set — you can now sign in with email + password too." : "Password updated.");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={[styles.sheet, { marginBottom: kbHeight }]}>
          {screen === "main" ? (
            <>
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
                  <Text style={styles.actionText}>Upgrade To Pro</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.action} onPress={() => void onManage()}>
                  <Text style={styles.actionText}>Manage Subscription</Text>
                </Pressable>
              )}
              <Pressable style={styles.action} onPress={() => void onRestore()} disabled={acting}>
                <Text style={styles.actionText}>{acting ? "…" : "Restore Purchases"}</Text>
              </Pressable>
              <Pressable style={styles.action} onPress={openPassword}>
                <Text style={styles.actionText}>Change Password</Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  void Linking.openURL(storeUrl(Platform.OS)).catch(() =>
                    setMsg("Couldn't open the Play Store. Search 'MoveStar' to leave a review."),
                  )
                }
              >
                <Text style={styles.actionText}>Rate MoveStar ⭐</Text>
              </Pressable>
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
              <Pressable style={[styles.signout, busy && styles.signoutOff]} onPress={onSignOut} disabled={busy}>
                <Text style={styles.signoutText}>{busy ? "…" : "Sign Out"}</Text>
              </Pressable>
              <Pressable
                style={styles.manageData}
                onPress={() =>
                  void Linking.openURL(DELETE_ACCOUNT_URL).catch(() =>
                    setMsg("Couldn't open the browser. Visit movestar-web.vercel.app/delete-account."),
                  )
                }
              >
                <Text style={styles.manageDataText}>Delete Account or Data ↗</Text>
              </Pressable>
              <Pressable style={styles.cancel} onPress={close}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Pressable style={styles.backRow} hitSlop={10} onPress={backToMain}>
                  <Text style={styles.backChevron}>‹</Text>
                  <Text style={styles.backText}>Account</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Password</Text>
              </View>
              {!hasPassword ? (
                <Text style={styles.hint}>
                  Add a password so you can sign in with your email too — not just Google.
                </Text>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={p.textDim}
                secureTextEntry
                autoCapitalize="none"
                value={newPw}
                onChangeText={setNewPw}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={p.textDim}
                secureTextEntry
                autoCapitalize="none"
                value={confirmPw}
                onChangeText={setConfirmPw}
              />
              <Pressable style={styles.action} onPress={() => void onSavePassword()} disabled={acting}>
                <Text style={styles.actionText}>{acting ? "…" : "Save Password"}</Text>
              </Pressable>
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
              <Pressable style={styles.cancel} onPress={backToMain}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerTitle: { color: p.text, fontSize: 22, fontWeight: "700" },
  backRow: { flexDirection: "row", alignItems: "center" },
  backChevron: { color: p.live, fontSize: 26, fontWeight: "700", marginRight: 4, marginTop: -2 },
  backText: { color: p.live, fontSize: 16, fontWeight: "600" },
  hint: { color: p.textDim, fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 2 },
  signout: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 22 },
  signoutOff: { opacity: 0.5 },
  signoutText: { color: "#ff6b6b", fontSize: 16, fontWeight: "700" },
  cancel: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: p.textDim, fontSize: 14 },
  manageData: { paddingVertical: 8, alignItems: "center", marginTop: 6 },
  manageDataText: { color: p.textDim, fontSize: 13, textDecorationLine: "underline" },
  msg: { color: p.textDim, fontSize: 13, marginTop: 10, lineHeight: 18 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: p.text, fontSize: 16, marginTop: 10 },
});
