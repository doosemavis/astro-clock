import { useMemo, useState, useEffect, useRef } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, Animated,
  Platform, StatusBar, StyleSheet, useWindowDimensions,
} from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { PasswordInput } from "./PasswordInput";
import { useAuth } from "../../lib/auth";
import { validatePassword, passwordsMatch } from "../../lib/password";
import * as AppleAuthentication from "expo-apple-authentication";

type Mode = "signin" | "signup" | "reset";

export function LoginScreen({ visible, onClose, initialMode = "signin" }: { visible: boolean; onClose: () => void; initialMode?: Mode }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { signIn, signUp, signInWithGoogle, signInWithApple, requestPasswordReset, confirmPasswordReset } = useAuth();
  const { height: screenH } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [showOAuthHint, setShowOAuthHint] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");

  // Slide animation: 0 = off-screen above (closed), 1 = in place (open). `rendered` keeps the
  // Modal mounted through the slide-up exit before unmounting.
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);   // open straight into the requested form (e.g. signup from onboarding)
      setRendered(true);
      Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, initialMode, anim]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => { if (active) setAppleReady(ok); })
      .catch(() => { if (active) setAppleReady(false); });
    return () => { active = false; };
  }, []);

  const pw = validatePassword(password);

  function reset() {
    setName(""); setEmail(""); setPassword(""); setConfirm(""); setCode("");
    setError(null); setInfo(null); setBusy(false); setShowOAuthHint(false);
    setResetStep("email");
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
    setError(null); setInfo(null); setShowOAuthHint(false); setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (r.cancelled) return; // user dismissed the browser — keep the sheet open
    close();
  }

  async function onApple() {
    if (busy) return;
    setError(null); setInfo(null); setShowOAuthHint(false); setBusy(true);
    const r = await signInWithApple();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (r.cancelled) return;
    close();
  }

  async function onSendCode() {
    setError(null); setInfo(null); setBusy(true);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setInfo("We emailed you an 8-digit code. Enter it below with your new password.");
    setResetStep("code");
  }

  async function onConfirmReset() {
    if (!pw.ok) { setError(`Password needs ${pw.problems.join(", ")}.`); return; }
    if (!passwordsMatch(password, confirm)) { setError("Passwords don't match."); return; }
    setError(null); setBusy(true);
    const r = await confirmPasswordReset(email, code, password);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    close();
  }

  const submitDisabled =
    busy || !email.trim() || !password ||
    (mode === "signup" && (!pw.ok || !passwordsMatch(password, confirm)));

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-screenH, 0] });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={rendered} animationType="none" transparent onRequestClose={close} statusBarTranslucent>
      {/* Top sheet: slides down from the top on open, up on close; keyboard (bottom) never covers it. */}
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <Text style={styles.brand}>MoveStar</Text>
          <Text style={styles.title}>{mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {mode === "reset" ? (
              <>
                {resetStep === "email" ? (
                  <>
                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail}
                      placeholder="you@example.com" placeholderTextColor={p.textDim}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Code</Text>
                    <TextInput style={styles.input} value={code} onChangeText={setCode}
                      placeholder="12345678" placeholderTextColor={p.textDim}
                      keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} />
                    <Text style={styles.label}>New password</Text>
                    <PasswordInput style={styles.input} value={password} onChangeText={setPassword} visible={pwVisible} onToggleVisible={() => setPwVisible((v) => !v)}
                      placeholder="••••••••" placeholderTextColor={p.textDim} />
                    <Text style={styles.label}>Confirm new password</Text>
                    <PasswordInput style={styles.input} value={confirm} onChangeText={setConfirm} visible={pwVisible} showToggle={false}
                      placeholder="••••••••" placeholderTextColor={p.textDim} />
                    {confirm.length > 0 && confirm !== password && (
                      <Text style={styles.hint}>Passwords don't match.</Text>
                    )}
                    {password.length > 0 && !pw.ok && (
                      <Text style={styles.hint}>Needs {pw.problems.join(", ")}.</Text>
                    )}
                  </>
                )}
                {error ? <Text style={styles.err}>{error}</Text> : null}
                {info ? <Text style={styles.ok}>{info}</Text> : null}
                <Pressable
                  style={[styles.submit, (busy || !email.trim() || (resetStep === "code" && (!code.trim() || !password || !confirm))) && styles.submitOff]}
                  onPress={resetStep === "email" ? onSendCode : onConfirmReset}
                  disabled={busy || !email.trim() || (resetStep === "code" && (!code.trim() || !password || !confirm))}
                >
                  <Text style={styles.submitText}>{busy ? "…" : resetStep === "email" ? "Send reset code" : "Reset password"}</Text>
                </Pressable>
                <Pressable style={styles.toggle} onPress={() => { setMode("signin"); setResetStep("email"); setCode(""); setError(null); setInfo(null); }}>
                  <Text style={styles.toggleText}>Back to sign in</Text>
                </Pressable>
                <Pressable style={styles.cancel} onPress={close}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                {appleReady && (
                  <Pressable style={[styles.google, styles.apple]} onPress={onApple} disabled={busy}>
                    <Text style={styles.googleText}>Continue with Apple</Text>
                  </Pressable>
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
                <PasswordInput style={styles.input} value={password} onChangeText={setPassword} visible={pwVisible} onToggleVisible={() => setPwVisible((v) => !v)}
                  placeholder="••••••••" placeholderTextColor={p.textDim} />

                {mode === "signup" && (
                  <>
                    <Text style={styles.label}>Confirm password</Text>
                    <PasswordInput style={styles.input} value={confirm} onChangeText={setConfirm} visible={pwVisible} showToggle={false}
                      placeholder="••••••••" placeholderTextColor={p.textDim} />
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

                <Pressable style={[styles.submit, submitDisabled && styles.submitOff]} onPress={onSubmit} disabled={submitDisabled}>
                  <Text style={styles.submitText}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</Text>
                </Pressable>
                {mode === "signin" && (
                  <Pressable style={styles.forgot} onPress={() => { setMode("reset"); setResetStep("email"); setError(null); setInfo(null); }}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                )}
                <Pressable style={styles.toggle} onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); setConfirm(""); setShowOAuthHint(false); }}>
                  <Text style={styles.toggleText}>
                    {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
                  </Text>
                </Pressable>
                <Pressable style={styles.cancel} onPress={close}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-start" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    paddingHorizontal: 18, paddingBottom: 18, maxHeight: "92%", flexShrink: 1,
    // Clear the status bar + camera cutout (this sheet is statusBarTranslucent and slides from the top).
    paddingTop: Platform.select({ ios: 56, default: (StatusBar.currentHeight ?? 24) + 26 }),
  },
  brand: { color: p.text, fontSize: 18, letterSpacing: 3, fontWeight: "600", textAlign: "center" },
  title: { color: p.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 4, marginBottom: 10 },
  scroll: { marginBottom: 0 },
  apple: { marginBottom: 10 },
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
  submit: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  submitOff: { opacity: 0.5 },
  submitText: { color: p.bg, fontSize: 16, fontWeight: "700" },
  toggle: { paddingVertical: 12, alignItems: "center" },
  toggleText: { color: p.live, fontSize: 14 },
  cancel: { paddingVertical: 6, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
  forgot: { paddingVertical: 8, alignItems: "center" },
  forgotText: { color: p.live, fontSize: 14 },
});
