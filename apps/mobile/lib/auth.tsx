import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import * as AppleAuthentication from "expo-apple-authentication";
import { interpretSignUp } from "./authResult";
import { buildAppleIdTokenParams, appleFullNameToString, isAppleCancel } from "./appleAuth";
import { configurePurchases, loginPurchases, logoutPurchases } from "./purchases";

/** Result shape for the auth actions: `error` set on failure; `needsConfirm` set when
 *  signUp created an unconfirmed account (email confirmation is ON on the project). */
export interface AuthResult {
  error?: string;
  needsConfirm?: boolean;
  cancelled?: boolean;
  alreadyExists?: boolean;
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configurePurchases();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) loginPurchases(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) loginPurchases(s.user.id);
      else logoutPurchases();
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) return { error: error.message };
    // Classify the (obfuscated) response: already-registered emails come back with an empty
    // identities[] and no session; a new account has identities + no session (spec §3.3).
    const outcome = interpretSignUp(data);
    if (outcome === "already_exists") return { alreadyExists: true };
    if (outcome === "needs_confirm") return { needsConfirm: true };
    return {};
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: "Invalid email or password." } : {};
  }

  async function signInWithGoogle(): Promise<AuthResult> {
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return { error: error?.message ?? "Could not start Google sign-in." };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return { cancelled: true }; // user dismissed the browser — not an error

    const { queryParams } = Linking.parse(res.url);
    const code = typeof queryParams?.code === "string" ? queryParams.code : undefined;
    if (!code) return { error: "Google sign-in did not return an auth code." };

    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    return exErr ? { error: exErr.message } : {};
  }

  async function signInWithApple(): Promise<AuthResult> {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken(
        buildAppleIdTokenParams(credential.identityToken),
      );
      if (error) return { error: error.message };

      // Apple returns the name ONLY on the first authorization — capture it best-effort into
      // user_metadata.name (what AccountView reads). Must never fail the sign-in.
      const name = appleFullNameToString(credential.fullName);
      if (name) {
        try {
          await supabase.auth.updateUser({ data: { name } });
        } catch (e) {
          console.warn("Apple name capture failed (non-fatal):", e);
        }
      }
      return {};
    } catch (e) {
      if (isAppleCancel(e)) return { cancelled: true }; // user dismissed the sheet — not an error
      return { error: e instanceof Error ? e.message : "Apple sign-in failed." };
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signInWithApple, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}
