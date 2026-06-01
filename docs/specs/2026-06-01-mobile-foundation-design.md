# Mobile App — Slice 0: Foundation (Design)

**Date:** 2026-06-01
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Part of:** the MoveStar Android app build (slice 0 of 6). Later slices: chart UI, auth,
living views, subscriptions (RevenueCat + Google Play Billing), store launch.

---

## 1. Goal

Stand up an **Expo (React Native)** app at `apps/mobile/` inside the existing pnpm monorepo
that **runs on Android** and **reuses `@astro/engine`**, while leaving `apps/web` untouched.
No chart UI yet — this slice only proves the toolchain (Expo + monorepo resolution + engine
math running natively).

## 2. Decisions (locked)

- **Framework:** Expo (managed), TypeScript. EAS for cloud builds later (not this slice).
- **Platform focus:** Android first ($25 one-time Play vs $99/yr Apple).
- **Monorepo resolution:** root **`.npmrc` → `node-linker=hoisted`** + a monorepo-aware
  `metro.config.js`. (Chosen over Metro-symlink-only config for reliability. The web app's
  code/behavior are unchanged; its dependency install re-orgs on the next `pnpm install`.)
- **Engine consumption:** as **TypeScript source** (its `exports` already point to
  `./src/index.ts`); `babel-preset-expo` transpiles it. Fallback if Metro can't handle the
  engine's explicit `.ts`-extension imports: add a `tsup` build → `dist` + a `"react-native"`
  export condition in `@astro/engine`. (Engine change would be additive; web stays on `default`.)
- **Scope:** one screen, no navigation library yet (YAGNI until multiple screens).

## 3. File structure (all new; `apps/web` untouched)

```
astro-clock/
  .npmrc                  NEW (root): node-linker=hoisted
  packages/engine/        reused as-is
  apps/web/               UNTOUCHED
  apps/mobile/            NEW Expo app (package name @astro/mobile)
    package.json          expo, react, react-native, react-dom, react-native-web,
                          @astro/engine: "workspace:*", expo dev/build tooling
    app.json              expo config: name "MoveStar", slug "movestar",
                          android.package "com.movestar.app", dark splash/icon
    metro.config.js       getDefaultConfig + watchFolders=[repoRoot],
                          resolver.nodeModulesPaths=[app, repoRoot]/node_modules
    babel.config.js       presets: ["babel-preset-expo"]
    tsconfig.json         extends "expo/tsconfig.base"; strict
    index.ts             registerRootComponent(App)
    App.tsx              the one screen (below)
    assets/              icon.png + splash (Expo defaults to start)
```

## 4. The screen (`App.tsx`)

A single dark screen that imports from `@astro/engine` and renders real engine output:

```
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf } from "@astro/engine";
// date = birthInstant(DEFAULT_BIRTH); np = positions(date); asc = ascendant(date, lat, lon)
// render:  "MoveStar"   and   "☉ {signOf(np.sun)} · ☽ {signOf(np.moon)} · ↑ {signOf(asc)}"
```

Components: `View` (dark background `#0a0b22`) + `Text` (serif-ish, `#e9eaf6`). Expected
output: **MoveStar** / **☉ Leo · ☽ Leo · ↑ Scorpio**. This proves the engine math executes
under React Native and the monorepo import resolves.

## 5. Verification

**What I can verify here (no device needed):**
1. `pnpm install` (hoisted) completes; **the web app still builds** (`pnpm --filter @astro/web build` or a dev compile) — guards the "don't break web" constraint after the linker change.
2. `apps/mobile` **typechecks** (`tsc --noEmit`).
3. **`npx expo export --platform android`** bundles cleanly — this produces the Android JS
   bundle, proving Metro resolves `@astro/engine` and the app compiles for Android.
4. Optional: `expo start --web` + headless browser to *see* the screen render (react-native-web).

**What the user verifies on-device (walkthrough — the user is new to mobile):**
1. Install **Expo Go** from the Play Store (Android) or App Store (iPhone) on your phone.
2. On the dev machine: from `apps/mobile/`, run `pnpm start` (alias for `expo start`). A **QR
   code** appears in the terminal.
3. **Android:** open Expo Go → "Scan QR code" → scan it. **iPhone:** open the Camera app →
   point at the QR → tap the banner (opens in Expo Go).
4. The app loads over your Wi-Fi (phone + computer on the **same network**). You should see
   **MoveStar** + the big-three line. That confirms it runs on a real device.
- Troubleshooting notes to include in the plan: same-Wi-Fi requirement; `--tunnel` flag if
  the QR won't connect (corporate/locked-down networks); shake device to open the dev menu.

## 6. Risks + fallbacks

- **Hoisted re-install affects the whole monorepo.** Mitigation: run the web build after
  install to confirm nothing regressed; pnpm-lock changes are expected and fine.
- **Engine `.ts`-extension imports under Metro.** Fallback: `tsup` build + `"react-native"`
  export condition (§2). Decided at the first `expo export`.
- **No on-device run from this environment.** Accepted: device verification is the user's
  step (§5), guided.

## 7. Out of scope (later slices)

Chart UI (`react-native-svg`), Supabase auth in RN, birth form + living views, RevenueCat +
Google Play Billing + paywall, `eas.json` + the `.aab` Play build + store listing.
