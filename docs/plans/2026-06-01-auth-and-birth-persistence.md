# Auth + Birth-Data Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase email/password + Google auth (email-verified, validated passwords) and persist each user's birth chart, while keeping the free natal chart usable logged-out.

**Architecture:** Supabase Auth via `@supabase/ssr` (PKCE). A root `middleware.ts` refreshes the session and protects `/account`. `/login` hosts a sign-in/sign-up toggle + Google. Birth data loads server-side from `birth_charts` for logged-in users and saves via the browser client (RLS-scoped); anonymous users keep using `localStorage`.

**Tech Stack:** Next.js 14 (App Router), `@supabase/ssr` + `supabase-js`, React 18, TypeScript, `node:test` (strip-types) for unit tests.

**Spec:** `docs/specs/2026-06-01-auth-and-birth-persistence-design.md`

**Run tests from `apps/web/`:** `node --test --experimental-strip-types lib/<name>.test.ts` (Node 23). The `@/*` alias maps to the `apps/web` root.

---

## File structure

**Create:**
- `apps/web/lib/password.ts` — pure password policy + its test
- `apps/web/lib/birthCharts.ts` — `BirthData ↔ row` mappers + fetch/upsert + its test
- `apps/web/lib/supabase/middleware.ts` — session refresh + route guard
- `apps/web/middleware.ts` — Next middleware entry
- `apps/web/app/auth/callback/route.ts` — code→session exchange
- `apps/web/app/auth/signout/route.ts` — sign out
- `apps/web/app/login/page.tsx` + `apps/web/app/login/LoginForm.tsx` + `apps/web/app/login/auth.css`
- `apps/web/app/account/page.tsx`
- `supabase/migrations/20260601000001_birth_charts_one_primary.sql`

**Modify:**
- `apps/web/app/chart/page.tsx` — load session + primary chart, pass to `<Chart>`
- `apps/web/components/Chart/Chart.tsx` — `userId`/`userEmail`/`initialBirth` props; load/save/migrate
- `apps/web/components/Chart/Panel.tsx` — auth affordance in the identity block
- `apps/web/package.json` — add a `test` script

---

## Task 1: Password policy util (TDD)

**Files:**
- Create: `apps/web/lib/password.ts`
- Test: `apps/web/lib/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/password.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./password.ts";

test("rejects < 8 chars", () => assert.equal(validatePassword("Ab1").ok, false));
test("rejects letter-only", () => assert.equal(validatePassword("abcdefgh").ok, false));
test("rejects number-only", () => assert.equal(validatePassword("12345678").ok, false));
test("accepts 8+ with letter and number", () => {
  const r = validatePassword("abcd1234");
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});
test("boundary: exactly 8 with letter+number passes", () =>
  assert.equal(validatePassword("abcdefg1").ok, true));
test("7 chars fails even with letter+number", () =>
  assert.equal(validatePassword("abcdef1").ok, false));
```

- [ ] **Step 2: Run it — expect FAIL**

Run (from `apps/web/`): `node --test --experimental-strip-types lib/password.test.ts`
Expected: FAIL — cannot find `./password.ts`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/password.ts
export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

/** Policy: >= 8 chars, >= 1 letter, >= 1 number. Mirror this in the Supabase dashboard. */
export function validatePassword(pw: string): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) problems.push("a letter");
  if (!/[0-9]/.test(pw)) problems.push("a number");
  return { ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run it — expect PASS** (`node --test --experimental-strip-types lib/password.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/password.ts apps/web/lib/password.test.ts
git commit -m "feat(auth): password policy validator"
```

---

## Task 2: Birth-chart mappers + data access (TDD for mappers)

**Files:**
- Create: `apps/web/lib/birthCharts.ts`
- Test: `apps/web/lib/birthCharts.test.ts`

Note: imports are **type-only** so the file has no runtime deps and the mapper tests run under strip-types. Data-access fns take the supabase client as a parameter.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/birthCharts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowToBirth, birthToRow } from "./birthCharts.ts";

const REF_ROW = {
  user_id: "u1", name: "Ref", birth_date: "1992-07-29", birth_time: "14:28:00",
  tz_offset: -6, is_dst: true, lat: 35.84, lon: -90.70, place_label: "Jonesboro, AR",
  is_primary: true,
};

test("rowToBirth maps fields + trims time to HH:MM", () => {
  const b = rowToBirth(REF_ROW);
  assert.equal(b.date, "1992-07-29");
  assert.equal(b.time, "14:28");
  assert.equal(b.tzOffset, -6);
  assert.equal(b.isDst, true);
  assert.equal(b.placeLabel, "Jonesboro, AR");
});

test("birthToRow round-trips + forces is_primary", () => {
  const row = birthToRow(rowToBirth(REF_ROW), "u1");
  assert.equal(row.birth_date, "1992-07-29");
  assert.equal(row.birth_time, "14:28");
  assert.equal(row.is_primary, true);
  assert.equal(row.place_label, "Jonesboro, AR");
});

test("null name/place become undefined", () => {
  const b = rowToBirth({ ...REF_ROW, name: null, place_label: null });
  assert.equal(b.name, undefined);
  assert.equal(b.placeLabel, undefined);
});
```

- [ ] **Step 2: Run it — expect FAIL** (`node --test --experimental-strip-types lib/birthCharts.test.ts`)

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/birthCharts.ts
import type { BirthData } from "@astro/engine";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BirthChartRow {
  id?: string;
  user_id: string;
  name: string | null;
  birth_date: string;   // "1992-07-29"
  birth_time: string;   // "14:28" or "14:28:00"
  tz_offset: number;
  is_dst: boolean;
  lat: number;
  lon: number;
  place_label: string | null;
  is_primary: boolean;
}

/** Postgres `time` returns "HH:MM:SS"; the engine wants "HH:MM". */
const hhmm = (t: string) => t.slice(0, 5);

export function rowToBirth(row: BirthChartRow): BirthData {
  return {
    name: row.name ?? undefined,
    date: row.birth_date,
    time: hhmm(row.birth_time),
    tzOffset: Number(row.tz_offset),
    isDst: row.is_dst,
    lat: Number(row.lat),
    lon: Number(row.lon),
    placeLabel: row.place_label ?? undefined,
  };
}

export function birthToRow(birth: BirthData, userId: string): BirthChartRow {
  return {
    user_id: userId,
    name: birth.name ?? null,
    birth_date: birth.date,
    birth_time: birth.time,
    tz_offset: birth.tzOffset,
    is_dst: birth.isDst,
    lat: birth.lat,
    lon: birth.lon,
    place_label: birth.placeLabel ?? null,
    is_primary: true,
  };
}

/** The caller's primary chart (RLS scopes to the signed-in user), or null. */
export async function getPrimaryBirthChart(
  supabase: SupabaseClient,
): Promise<BirthData | null> {
  const { data, error } = await supabase
    .from("birth_charts")
    .select("*")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToBirth(data as BirthChartRow);
}

/** App-logic upsert: update the existing primary row, else insert. */
export async function upsertPrimaryBirthChart(
  supabase: SupabaseClient,
  birth: BirthData,
  userId: string,
): Promise<void> {
  const row = birthToRow(birth, userId);
  const { data: existing } = await supabase
    .from("birth_charts")
    .select("id")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("birth_charts").update(row).eq("id", existing.id);
  } else {
    await supabase.from("birth_charts").insert(row);
  }
}
```

- [ ] **Step 4: Run it — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/birthCharts.ts apps/web/lib/birthCharts.test.ts
git commit -m "feat(auth): birth_charts mappers + primary fetch/upsert"
```

---

## Task 3: DB migration — one primary chart per user

**Files:**
- Create: `supabase/migrations/20260601000001_birth_charts_one_primary.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260601000001_birth_charts_one_primary.sql
-- Data-integrity backstop: at most one primary birth chart per user.
create unique index if not exists birth_charts_one_primary
  on public.birth_charts (user_id)
  where is_primary;
```

- [ ] **Step 2: Commit** (applied later by the GitHub→Supabase integration)

```bash
git add supabase/migrations/20260601000001_birth_charts_one_primary.sql
git commit -m "feat(db): unique primary birth chart per user (migration)"
```

---

## Task 4: Session middleware + route guard

**Files:**
- Create: `apps/web/lib/supabase/middleware.ts`, `apps/web/middleware.ts`

- [ ] **Step 1: Implement the session helper**

```ts
// apps/web/lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/account"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates with Supabase — required; do NOT use getSession() for auth checks.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 2: Implement the middleware entry**

```ts
// apps/web/middleware.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Verify compile** — `pnpm dev` compiles with no error referencing these files. (Without env vars set, requests may 500 inside `getUser()`; that's expected until the Supabase project is wired — see Task 11.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/supabase/middleware.ts apps/web/middleware.ts
git commit -m "feat(auth): session refresh middleware + /account guard"
```

---

## Task 5: Auth callback + signout routes

**Files:**
- Create: `apps/web/app/auth/callback/route.ts`, `apps/web/app/auth/signout/route.ts`

- [ ] **Step 1: Callback route**

```ts
// apps/web/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chart";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing auth code")}`);
}
```

- [ ] **Step 2: Signout route**

```ts
// apps/web/app/auth/signout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/auth/callback/route.ts apps/web/app/auth/signout/route.ts
git commit -m "feat(auth): callback (code exchange) + signout routes"
```

---

## Task 6: Auth styles

**Files:**
- Create: `apps/web/app/login/auth.css`

Self-contained dark serif palette (the chart's theme vars are only set inside `.ac-root`, so the auth pages use literals matching the Celestial-Midnight theme).

- [ ] **Step 1: Implement**

```css
/* apps/web/app/login/auth.css */
.auth-root {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 24px; color: #e9eaf6; font-family: Georgia, "Times New Roman", serif;
  background: radial-gradient(circle at 50% 34%, #0a0b22, #05060f);
}
.auth-card {
  width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 14px;
  background: rgba(10, 11, 34, 0.92); border: 1px solid #2a2c52; border-radius: 16px;
  padding: 28px 26px; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.auth-title { font-size: 24px; letter-spacing: .02em; margin: 0 0 4px; }
.auth-field { display: flex; flex-direction: column; gap: 5px; }
.auth-field > span { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #9aa0c8; }
.auth-field input {
  background: #0a0b22; border: 1px solid #2a2c52; color: #e9eaf6; border-radius: 8px;
  padding: 9px 11px; font-family: inherit; font-size: 14px;
}
.auth-field input:focus { outline: 2px solid #8f7bff; outline-offset: 1px; border-color: #8f7bff; }
.auth-static { font-size: 14px; color: #c7cbe6; padding: 2px 0; }
.auth-google, .auth-submit, .auth-toggle {
  font-family: inherit; cursor: pointer; border-radius: 8px; padding: 10px 12px; font-size: 13px;
}
.auth-google { background: #e9eaf6; color: #0a0b22; border: none; font-weight: 600; letter-spacing: .02em; }
.auth-google:hover { opacity: .92; }
.auth-submit { background: #8f7bff; color: #0a0b22; border: none; font-weight: 600; letter-spacing: .04em; }
.auth-submit:disabled { opacity: .5; cursor: not-allowed; }
.auth-toggle { background: transparent; border: none; color: #9aa0c8; text-align: center; text-decoration: none; }
.auth-toggle:hover { color: #e9eaf6; }
.auth-divider { display: flex; align-items: center; gap: 10px; color: #6a6f99; font-size: 11px; }
.auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: #2a2c52; }
.auth-hint { font-size: 11.5px; color: #9aa0c8; }
.auth-msg { font-size: 12.5px; border-radius: 8px; padding: 8px 10px; }
.auth-msg.err { color: #ff9b9b; background: rgba(255, 80, 80, 0.08); }
.auth-msg.ok { color: #8fe0ad; background: rgba(80, 220, 140, 0.08); }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/login/auth.css
git commit -m "feat(auth): auth page styles"
```

---

## Task 7: Login page + form

**Files:**
- Create: `apps/web/app/login/page.tsx`, `apps/web/app/login/LoginForm.tsx`

- [ ] **Step 1: Page (Suspense wrapper — `useSearchParams` needs it in Next 14)**

```tsx
// apps/web/app/login/page.tsx
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import "./auth.css";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Form**

```tsx
// apps/web/app/login/LoginForm.tsx
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
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: redirectTo, data: { name } },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
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
```

- [ ] **Step 3: Verify (browse)** — `$B goto /login`: form renders; type a weak password in signup mode → the hint shows + submit disabled; switch toggle works. (No Supabase calls exercised yet.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/login/page.tsx apps/web/app/login/LoginForm.tsx
git commit -m "feat(auth): /login sign-in/sign-up form + Google"
```

---

## Task 8: Account page

**Files:**
- Create: `apps/web/app/account/page.tsx`

- [ ] **Step 1: Implement (protected; reuses auth.css)**

```tsx
// apps/web/app/account/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "../login/auth.css";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h1 className="auth-title">Account</h1>
        <div className="auth-field"><span>Email</span><div className="auth-static">{user.email}</div></div>
        {profile?.display_name && (
          <div className="auth-field"><span>Name</span><div className="auth-static">{profile.display_name}</div></div>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="auth-submit">Sign out</button>
        </form>
        <a className="auth-toggle" href="/chart">← Back to your chart</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/account/page.tsx
git commit -m "feat(auth): protected /account page with sign out"
```

---

## Task 9: Birth persistence — chart page + Chart.tsx

**Files:**
- Modify: `apps/web/app/chart/page.tsx`, `apps/web/components/Chart/Chart.tsx`

- [ ] **Step 1: Server-load the primary chart in the page**

Replace the body of `apps/web/app/chart/page.tsx` with:

```tsx
import "./chart.css";
import "./aria-picker.css";
import Chart from "@/components/Chart/Chart";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryBirthChart } from "@/lib/birthCharts";

export default async function ChartPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialBirth = user ? await getPrimaryBirthChart(supabase) : null;
  return (
    <Chart
      userId={user?.id ?? null}
      userEmail={user?.email ?? null}
      initialBirth={initialBirth}
    />
  );
}
```

- [ ] **Step 2: Add props + imports to `Chart.tsx`**

At the top of `Chart.tsx`, add imports:

```ts
import { createClient } from "@/lib/supabase/client";
import { upsertPrimaryBirthChart } from "@/lib/birthCharts";
```

Change the component signature from `export default function Chart() {` to:

```tsx
interface ChartProps {
  userId?: string | null;
  userEmail?: string | null;
  initialBirth?: import("@astro/engine").BirthData | null;
}

export default function Chart({ userId = null, userEmail = null, initialBirth = null }: ChartProps) {
```

- [ ] **Step 3: Seed birth from the server value**

Change `const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);` to:

```tsx
  const [birth, setBirth] = useState<BirthData>(initialBirth ?? DEFAULT_BIRTH);
```

(Server-provided `initialBirth` is identical on server and client → no hydration mismatch.)

- [ ] **Step 4: Replace the mount effect's birth-loading block**

Find the mount effect that currently reads `STORAGE_KEY`. Replace its birth-loading `try { … }` (the block that does `localStorage.getItem(STORAGE_KEY)` → `setBirth`) so the whole effect reads:

```tsx
  useEffect(() => {
    const now = Date.now();
    setRangeEndMs(now);
    setMomentMs(now);
    setCompareBMs(now);
    try {
      const tf = localStorage.getItem(TIME_FORMAT_KEY);
      if (tf === "12h" || tf === "24h") setTimeFormat(tf);
    } catch { /* ignore */ }

    if (userId) {
      // Logged in: if the account has no saved chart yet, migrate the local one once.
      if (!initialBirth) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const b = JSON.parse(raw) as BirthData;
            setBirth(b);
            void upsertPrimaryBirthChart(createClient(), b, userId);
          }
        } catch { /* ignore */ }
      }
      return;
    }
    // Anonymous: birth comes from localStorage (free chart still works logged out).
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBirth(JSON.parse(raw) as BirthData);
    } catch { /* ignore */ }
  }, [userId, initialBirth]);
```

- [ ] **Step 5: Save to Supabase in `applyBirth`**

Change the `applyBirth` callback to also persist for logged-in users:

```tsx
  const applyBirth = useCallback((b: BirthData) => {
    setBirth(b);
    setRangeStartMs(birthInstant(b).getTime());
    setCompareAMs(birthInstant(b).getTime());
    setEditing(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    if (userId) void upsertPrimaryBirthChart(createClient(), b, userId);
  }, [userId]);
```

- [ ] **Step 6: Pass `userEmail` to `<Panel>`**

In the `<Panel … />` JSX add the prop: `userEmail={userEmail}`.

- [ ] **Step 7: Verify (browse, logged out)** — `$B goto /chart`: the wheel still renders; editing birth still writes localStorage and persists across reload (anonymous path unchanged). No console errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/chart/page.tsx apps/web/components/Chart/Chart.tsx
git commit -m "feat(auth): persist birth chart per user (server load + save + migrate)"
```

---

## Task 10: Panel auth affordance

**Files:**
- Modify: `apps/web/components/Chart/Panel.tsx`, `apps/web/app/chart/chart.css`

- [ ] **Step 1: Add the prop**

In the `Props` interface add `userEmail?: string | null;`. Add `userEmail` to the destructured `props` in `Panel(...)`.

- [ ] **Step 2: Replace the hardcoded handle**

Change the identity block's handle line from `<div className="handle">@doosemavis</div>` to:

```tsx
        <div className="handle">
          {userEmail ? (
            <>{userEmail} · <a className="auth-link" href="/account">Account</a></>
          ) : (
            <a className="auth-link" href="/login">Sign in</a>
          )}
        </div>
```

- [ ] **Step 3: Style the link** — append to `apps/web/app/chart/chart.css`:

```css
.ac-panel .handle .auth-link { color: var(--text-dim); text-decoration: underline; }
.ac-panel .handle .auth-link:hover { color: var(--text); }
```

- [ ] **Step 4: Verify (browse)** — logged out, the identity block shows "Sign in" linking to `/login`. No console errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/Chart/Panel.tsx apps/web/app/chart/chart.css
git commit -m "feat(auth): sign-in / account affordance in the panel"
```

---

## Task 11: Test script + final verification

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add a test script**

In `apps/web/package.json` `scripts`, add:

```json
"test": "node --test --experimental-strip-types lib/*.test.ts"
```

- [ ] **Step 2: Run the unit tests** — from `apps/web/`: `pnpm test` → password + birthCharts suites all PASS.

- [ ] **Step 3: Logged-out smoke (browse)**
  - `/login` renders; signup weak-password hint + disabled submit; toggle works.
  - `/chart` renders the free wheel; identity shows "Sign in"; birth edit persists via localStorage.
  - `/account` → redirects to `/login?next=/account` (needs env vars set — Step 5).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json
git commit -m "chore(auth): add web unit-test script"
```

- [ ] **Step 5: STOP — hand off to the user for Supabase wiring**

The live round-trip (signup → confirm email → login, Google, account redirect, DB persistence) needs the user's Supabase project. Provide the §7 external-setup checklist from the spec and request:
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Baseline `schema.sql` applied + the Task 3 migration.
- Auth settings (email confirm ON, Site URL + redirect allowlist, password policy).
- Google provider configured.
Then resume live verification.

---

## Self-Review

- **Spec coverage:** auth flow (T4–T7); session+gating (T4); password validation (T1, T7); birth persistence + mapper + migration + first-login migration (T2, T3, T9); account + nav affordance (T8, T10); migrations/GitHub (T3); external-setup handoff (T11 Step 5); testing (T1, T2, T11); security — `getUser()` not `getSession()` (T4), service role server-only (unchanged), RLS (existing schema).
- **Placeholders:** none — every code step has full content; the only "later" items are the explicitly out-of-scope billing/paywall slices.
- **Type consistency:** `validatePassword` → `{ ok, problems }` used identically in T1 and T7. `BirthData` fields (`date/time/tzOffset/isDst/placeLabel`) consistent across T2/T9. `upsertPrimaryBirthChart(supabase, birth, userId)` signature identical in T2 (def), T9 (calls). `BirthChartRow` columns match `schema.sql` and the mapper. `createClient` from `@/lib/supabase/client` in client code (T7, T9) and `@/lib/supabase/server` in server/route code (T5, T8, T9-page).
