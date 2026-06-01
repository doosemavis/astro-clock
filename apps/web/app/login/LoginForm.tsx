"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/password";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/chart";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pw = validatePassword(password);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const supabase = createClient();

    if (mode === "signup") {
      if (!pw.ok) { setError(`Password needs ${pw.problems.join(", ")}.`); return; }
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: redirectTo, data: { name } },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      // When email confirmation is off, signUp returns an active session — go straight in.
      if (data.session) { router.push(next); router.refresh(); return; }
      setInfo("Check your email to confirm your account, then sign in.");
      setMode("signin");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError("Invalid email or password."); return; }
    router.push(next);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="auth-root">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="auth-title">{mode === "signin" ? "Sign in" : "Create account"}</h1>

        <button type="button" className="auth-google" onClick={onGoogle}>Continue with Google</button>
        <div className="auth-divider"><span>or</span></div>

        {mode === "signup" && (
          <label className="auth-field"><span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="auth-field"><span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="auth-field"><span>Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        </label>

        {mode === "signup" && password.length > 0 && !pw.ok && (
          <div className="auth-hint">Needs {pw.problems.join(", ")}.</div>
        )}
        {error && <div className="auth-msg err">{error}</div>}
        {info && <div className="auth-msg ok">{info}</div>}

        <button type="submit" className="auth-submit" disabled={busy || (mode === "signup" && !pw.ok)}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="auth-toggle"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}>
          {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
