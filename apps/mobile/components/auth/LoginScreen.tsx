import { useMemo, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { validatePassword } from "../../lib/password";
import { useEffect } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { passwordsMatch } from "../../lib/password";

type Mode = "signin" | "signup";

export function LoginScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p, t } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showOAuthHint, setShowOAuthHint] = useState(false);
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => { if (active) setAppleReady(ok); })
      .catch(() => { if (active) setAppleReady(false); });
    return () => { active = false; };
  }, []);

  const pw = validatePassword(password);
  const isIos = Platform.OS === "ios";

  function reset() {
    setName(""); setEmail(""); setPassword(""); setConfirm("");
    setError(null); setInfo(null); setBusy(false); setShowOAuthHint(false);
  }
  function close() { reset(); onClose(); }

  async function onSubmit() {
    setError(null); setInfo(null); setShowOAuthHint(false);
    if (mode === "signup") {
      if (!pw.ok) { setError(`Password needs ${pw.problems.join(", ")}.`); return; }
      if (!passwordsMatch(password, confirm)) { setError("Passwords don't match."); return; }
      setBusy(true);
      const r = await signUp(email.trim(), password, name.trim());
      setBusy(false);
      if (r.error) { setError(r.error); return; }
      if (r.alreadyExists) {
        setMode("signin");
        setPassword(""); setConfirm("");
        setError("An account with this email already exists. Sign in below — if you first used Google or Apple, use those buttons above.");
        return;
      }
      if (r.needsConfirm) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setPassword(""); setConfirm("");
        return;
      }
      close();
      return;
    }
    setBusy(true);
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (r.error) { setError(r.error); setShowOAuthHint(true); return; }
    close();
  }

  async function onGoogle() {
    setError(null); setInfo(null); setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (r.cancelled) return; // user dismissed the browser — keep the sheet open
    close();
  }

  async function onApple() {
    setError(null); setInfo(null); setShowOAuthHint(false); setBusy(true);
    const r = await signInWithApple();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (r.cancelled) return;
    close();
  }

  const submitDisabled =
    busy || !email.trim() || !password ||
    (mode === "signup" && (!pw.ok || !passwordsMatch(password, confirm)));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={isIos ? "padding" : undefined}>
        <View style={styles.backdrop} />
        <View style={styles.sheet}>
          <Text style={styles.brand}>MoveStar</Text>
          <Text style={styles.title}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {appleReady && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  t < 0.5
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={10}
                style={styles.apple}
                onPress={onApple}
              />
            )}
            <Pressable style={styles.google} onPress={onGoogle} disabled={busy}>
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>
            <View style={styles.dividerRow}>
              <View style={styles.divider} /><Text style={styles.or}>or</Text><View style={styles.divider} />
            </View>

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName}
                  placeholder="You" placeholderTextColor={p.textDim} autoCapitalize="words" />
              </>
            )}
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={p.textDim}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
                  placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />
                {confirm.length > 0 && confirm !== password && (
                  <Text style={styles.hint}>Passwords don't match.</Text>
                )}
              </>
            )}
            {mode === "signup" && password.length > 0 && !pw.ok && (
              <Text style={styles.hint}>Needs {pw.problems.join(", ")}.</Text>
            )}
            {error ? <Text style={styles.err}>{error}</Text> : null}
            {info ? <Text style={styles.ok}>{info}</Text> : null}
            {mode === "signin" && showOAuthHint && (
              <Text style={styles.hint}>Used Google or Apple before? Use the buttons above.</Text>
            )}
          </ScrollView>

          <Pressable style={[styles.submit, submitDisabled && styles.submitOff]} onPress={onSubmit} disabled={submitDisabled}>
            <Text style={styles.submitText}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</Text>
          </Pressable>
          <Pressable style={styles.toggle} onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}>
            <Text style={styles.toggleText}>
              {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
            </Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={close}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, maxHeight: "92%",
  },
  brand: { color: p.text, fontSize: 18, letterSpacing: 3, fontWeight: "600", textAlign: "center" },
  title: { color: p.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 4, marginBottom: 10 },
  scroll: { marginBottom: 12 },
  apple: { height: 48, marginBottom: 10 },
  google: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  googleText: { color: p.text, fontSize: 16, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: p.border },
  or: { color: p.textDim, fontSize: 13 },
  label: { color: p.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: p.text, fontSize: 16 },
  hint: { color: p.textDim, fontSize: 13, marginTop: 8 },
  err: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  ok: { color: p.live, fontSize: 14, marginTop: 12 },
  submit: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitOff: { opacity: 0.5 },
  submitText: { color: p.bg, fontSize: 16, fontWeight: "700" },
  toggle: { paddingVertical: 12, alignItems: "center" },
  toggleText: { color: p.live, fontSize: 14 },
  cancel: { paddingVertical: 6, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
});
