import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Result shape for the auth actions: `error` set on failure; `needsConfirm` set when
 *  signUp created an unconfirmed account (email confirmation is ON on the project). */
export interface AuthResult {
  error?: string;
  needsConfirm?: boolean;
  cancelled?: boolean;
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) return { error: error.message };
    // With email confirmation ON, signUp returns no session until the link is clicked.
    return { needsConfirm: !data.session };
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

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signOut }}
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
