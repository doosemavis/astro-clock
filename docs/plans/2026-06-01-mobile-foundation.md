# Mobile Foundation (Slice 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Expo (React Native) app at `apps/mobile/` in the pnpm monorepo that runs on Android and reuses `@astro/engine`, without touching `apps/web`.

**Architecture:** Scaffold a blank-TypeScript Expo app, switch the monorepo to `node-linker=hoisted`, point Metro at the workspace root (so it resolves `@astro/engine` as TS source), and render one screen that calls the engine. Verify by web build + typecheck + Android bundle here; the user runs it on a real device via Expo Go.

**Tech Stack:** Expo (managed), React Native, TypeScript, Metro, pnpm workspaces, `@astro/engine`.

**Spec:** `docs/specs/2026-06-01-mobile-foundation-design.md`

> Network note: scaffolding + `pnpm install` + `expo export` download large RN/Expo packages — expect minutes, not seconds.

---

## File structure

**Create:**
- `.npmrc` (repo root) — `node-linker=hoisted`
- `apps/mobile/` — scaffolded Expo app, then adjusted:
  - `package.json` — renamed `@astro/mobile`, `@astro/engine: "workspace:*"`, web-target deps
  - `metro.config.js` — monorepo-aware resolver
  - `App.tsx` — the engine screen
  - (`app.json`, `babel.config.js`, `tsconfig.json`, `index.ts`, `assets/` — from the scaffold)

**Modify:** none in `apps/web` or `packages/engine`.

---

## Task 1: Switch the monorepo to a hoisted node-linker

**Files:** Create `.npmrc` (repo root)

- [ ] **Step 1: Create `.npmrc`**

```
node-linker=hoisted
```

- [ ] **Step 2: Reinstall the workspace with the new linker**

Run (repo root): `pnpm install`
Expected: completes; `pnpm-lock.yaml` may change; a flat `node_modules` layout appears.

- [ ] **Step 3: Verify the web app is unaffected (the "don't break web" guard)**

Run: `pnpm --filter @astro/web build`
Expected: `✓ Compiled successfully` / a successful Next build (no module-resolution errors).
If the web build was already known-green, a dev compile (`curl` the running dev server) is an acceptable lighter check.

- [ ] **Step 4: Commit**

```bash
git add .npmrc pnpm-lock.yaml
git commit -m "chore: node-linker=hoisted (Expo/Metro monorepo support)"
```

---

## Task 2: Scaffold the Expo app and wire it into the monorepo

**Files:** Create `apps/mobile/*`

- [ ] **Step 1: Scaffold a blank-TypeScript Expo app (no install yet)**

Run (repo root):
```bash
pnpm create expo-app apps/mobile --template blank-typescript --no-install
```
If a nested git repo was created, remove it: `rm -rf apps/mobile/.git`
Expected: `apps/mobile/` contains `package.json`, `app.json`, `App.tsx`, `tsconfig.json`, `babel.config.js`, `index.ts` (or `index.js`), `assets/`.

- [ ] **Step 2: Rename the package + add the engine and web-target deps**

Edit `apps/mobile/package.json`:
- set `"name": "@astro/mobile"`
- add to `dependencies`: `"@astro/engine": "workspace:*"`
- ensure `scripts` includes: `"start": "expo start"`, `"android": "expo start --android"`, `"web": "expo start --web"`, `"typecheck": "tsc --noEmit"`

Then add the web-target packages with SDK-aligned versions (run in `apps/mobile/`):
```bash
cd apps/mobile && npx expo install react-dom react-native-web && cd ../..
```
Expected: `react-dom` and `react-native-web` added at versions matching the scaffolded Expo SDK.

- [ ] **Step 3: Add the monorepo Metro config**

Create `apps/mobile/metro.config.js`:
```js
// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/engine are picked up.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Use the package "exports" field so @astro/engine resolves to its TS source
//    (its exports."." points at ./src/index.ts; there is no built ./dist).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
```

- [ ] **Step 4: Install the workspace**

Run (repo root): `pnpm install`
Expected: completes; `@astro/mobile` is linked and `@astro/engine` is resolved as a workspace dep.

- [ ] **Step 5: Commit (scaffold + wiring; the screen comes next)**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app + monorepo Metro config"
```

---

## Task 3: Render the engine screen

**Files:** Modify `apps/mobile/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with the engine-driven screen**

```tsx
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf } from "@astro/engine";

export default function App() {
  const date = birthInstant(DEFAULT_BIRTH);
  const np = positions(date);
  const asc = ascendant(date, DEFAULT_BIRTH.lat, DEFAULT_BIRTH.lon);
  const bigThree = `☉ ${signOf(np.sun)}  ·  ☽ ${signOf(np.moon)}  ·  ↑ ${signOf(asc)}`;

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      <Text style={styles.signs}>{bigThree}</Text>
      <Text style={styles.note}>engine running on React Native</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0b22", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  brand: { color: "#e9eaf6", fontSize: 34, letterSpacing: 6, fontWeight: "600" },
  signs: { color: "#c7cbe6", fontSize: 18, letterSpacing: 1 },
  note: { color: "#6a6f99", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: 8 },
});
```

- [ ] **Step 2: Typecheck the mobile app**

Run (in `apps/mobile/`): `pnpm typecheck`
Expected: no errors (the `@astro/engine` imports type-check against its `.ts` source).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): screen renders the big-three from @astro/engine"
```

---

## Task 4: Verify the Android bundle (the toolchain proof)

**Files:** none (verification)

- [ ] **Step 1: Bundle for Android**

Run (in `apps/mobile/`):
```bash
npx expo export --platform android --output-dir /tmp/movestar-android-bundle
```
Expected: completes with an Android bundle written to `/tmp/movestar-android-bundle` and **no "Unable to resolve module @astro/engine"** error. This proves Metro resolves the engine and the app compiles for Android.

- [ ] **Step 2 (fallback only — if Step 1 fails on the engine's `.ts` imports):** build the engine to `dist` and add a React Native export condition.
  - In `packages/engine`: `pnpm add -D tsup`, add script `"build:rn": "tsup src/index.ts --format esm --dts --out-dir dist"`, run it.
  - In `packages/engine/package.json` `exports["."]`, add before `default`: `"react-native": "./dist/index.js"`.
  - Re-run Step 1. (This change is additive — web still resolves via `default` → `./src/index.ts`.)
  - Commit: `git add packages/engine && git commit -m "build(engine): tsup dist + react-native export condition (Metro)"`

- [ ] **Step 3 (optional — see it render): web target**

Run (in `apps/mobile/`, background): `pnpm web` (serves the app via react-native-web).
Then load `http://localhost:8081` (or the port Expo prints) in a browser and confirm **MoveStar** + the big-three line render. Stop the server after.

- [ ] **Step 4: No commit (verification only).** Record the result in the completion report.

---

## Task 5: Device-run walkthrough (hand-off to the user)

**Files:** none

- [ ] **Step 1: Present these exact steps to the user (they are new to mobile):**

> **Run MoveStar on your phone (Expo Go):**
> 1. Install **Expo Go** — Play Store (Android) or App Store (iPhone).
> 2. Make sure your **phone and computer are on the same Wi-Fi**.
> 3. In a terminal: `cd ~/dev/astro-clock/apps/mobile && pnpm start`. A **QR code** appears.
> 4. **Android:** open **Expo Go** → "Scan QR code" → scan the terminal QR.
>    **iPhone:** open the **Camera** app → point at the QR → tap the banner.
> 5. The app downloads to your phone and opens — you should see **MoveStar** and **☉ Leo · ☽ Leo · ↑ Scorpio**.
> 6. **If the QR won't connect** (locked-down/corporate Wi-Fi): stop it, run `pnpm start --tunnel` instead (slower, but routes around the network), and scan the new QR.
> 7. Shake the phone (or press `m` in the terminal) to open the dev menu; press `r` in the terminal to reload.

- [ ] **Step 2: Stop and wait for the user to confirm they see the screen on their device.**

---

## Self-Review

- **Spec coverage:** Expo app at apps/mobile (T2); node-linker=hoisted + metro monorepo config (T1, T2); engine as TS source + fallback (T2 metro, T4 fallback); one screen rendering big-three (T3); verification — web still builds (T1), typecheck (T3), Android export bundle (T4), optional web render (T4); device walkthrough (T5); web untouched (no apps/web edits anywhere). All §-items covered.
- **Placeholders:** none — every config/screen/command is concrete. The fallback (T4 S2) is a real, fully-specified branch, not a "TODO".
- **Type/name consistency:** package `@astro/mobile`; engine imports `DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf` all exist in `@astro/engine`'s index (verified). `metro.config.js` paths (`projectRoot`, `workspaceRoot`) consistent. `pnpm typecheck` script defined in T2 S2, used in T3 S2.
