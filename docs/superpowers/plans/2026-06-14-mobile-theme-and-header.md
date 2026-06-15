# Theme Options + Header Swap + Now-Header Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Light/Dark/System theme options in the ☰ menu (persisted, OS-aware), make the two header buttons intuitive (☰ opens the menu, sun-glyph opens Coordinates), and fix the Now-header to show the displayed moment (no default-chart leak).

**Architecture:** Pure logic (mode→t mapping, theme persistence parse, header label) in `lib/` unit-tested via `node --test`; React wiring in `App.tsx`/`HeaderMenu`/`ChartControls`; UI verified on the emulator.

**Tech Stack:** React Native + Expo (`@astro/mobile`), `react-native-svg`, AsyncStorage, `useColorScheme`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-theme-and-header-design.md`
**Branch:** `feat/mobile-theme-header` (stacked on `feat/mobile-signin-quick-wins`).
**Run mobile tests:** `pnpm --filter @astro/mobile test`

---

## Task 1: `themeTForMode` pure helper (Part C logic)

**Files:** Create `apps/mobile/lib/themeMode.ts`, `apps/mobile/lib/themeMode.test.ts`

- [ ] **Step 1: Failing test** — create `lib/themeMode.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { themeTForMode } from "./themeMode.ts";

test("themeTForMode: light=1, dark=0", () => {
  assert.equal(themeTForMode("light", false), 1);
  assert.equal(themeTForMode("dark", true), 0);
});
test("themeTForMode: system follows the OS scheme", () => {
  assert.equal(themeTForMode("system", true), 0);  // OS dark -> night
  assert.equal(themeTForMode("system", false), 1); // OS light -> day
});
```
- [ ] **Step 2:** Run `pnpm --filter @astro/mobile exec node --test --experimental-strip-types lib/themeMode.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** — create `lib/themeMode.ts`:
```ts
import type { ThemeMode } from "./chartModel.ts";

/** Base day/night value for a theme mode: dark=0, light=1; system follows the OS scheme. */
export function themeTForMode(mode: ThemeMode, systemPrefersDark: boolean): number {
  if (mode === "light") return 1;
  if (mode === "dark") return 0;
  return systemPrefersDark ? 0 : 1; // "system"
}
```
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/themeMode.ts apps/mobile/lib/themeMode.test.ts
git commit -m "feat(mobile): add themeTForMode helper (system follows OS)"
```

---

## Task 2: Theme persistence (Part D logic)

**Files:** Create `apps/mobile/lib/themeStorage.ts`, `apps/mobile/lib/themeStorage.test.ts`

- [ ] **Step 1: Failing test** — create `lib/themeStorage.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThemeMode } from "./themeStorage.ts";

test("parseThemeMode: valid values pass through", () => {
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("dark"), "dark");
  assert.equal(parseThemeMode("system"), "system");
});
test("parseThemeMode: null/garbage -> default system", () => {
  assert.equal(parseThemeMode(null), "system");
  assert.equal(parseThemeMode("auto"), "system");  // legacy/invalid
  assert.equal(parseThemeMode("xyz"), "system");
});
```
- [ ] **Step 2:** Run the file → FAIL.
- [ ] **Step 3: Implement** — create `lib/themeStorage.ts` (mirrors `exportSettingsStore.ts`; pure parse split out for testing):
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "./chartModel.ts";

const KEY = "movestar.themeMode.v1";
const DEFAULT: ThemeMode = "system";

/** Validate a persisted value; anything invalid (incl. legacy "auto") -> default "system". */
export function parseThemeMode(raw: string | null): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT;
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    return parseThemeMode(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT;
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {
    /* local cache only */
  }
}
```
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/themeStorage.ts apps/mobile/lib/themeStorage.test.ts
git commit -m "feat(mobile): persist themeMode (AsyncStorage, default system)"
```

---

## Task 3: `bigThreeLabel` pure helper (Part E logic)

**Files:** Create `apps/mobile/lib/bigThree.ts`, `apps/mobile/lib/bigThree.test.ts`

- [ ] **Step 1: Failing test** — create `lib/bigThree.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bigThreeLabel } from "./bigThree.ts";

test("bigThreeLabel: with ascendant shows all three", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", "Scorpio"), "☉ Gemini   ☽ Gemini   ↑ Scorpio");
});
test("bigThreeLabel: null ascendant -> sun + moon only", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", null), "☉ Gemini   ☽ Gemini");
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — create `lib/bigThree.ts`:
```ts
/** Header signature label. Ascendant ("↑") is shown only when an ascendant sign is given. */
export function bigThreeLabel(sun: string, moon: string, asc: string | null): string {
  const base = `☉ ${sun}   ☽ ${moon}`;
  return asc ? `${base}   ↑ ${asc}` : base;
}
```
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/bigThree.ts apps/mobile/lib/bigThree.test.ts
git commit -m "feat(mobile): add bigThreeLabel header formatter"
```

---

## Task 4: `ThemeMode` auto→system + OS-aware themeT (Part C wiring)

**Files:** Modify `apps/mobile/lib/chartModel.ts`, `apps/mobile/App.tsx`

- [ ] **Step 1: Change the type** — in `lib/chartModel.ts:11`:
```ts
export type ThemeMode = "light" | "dark" | "system";
```
- [ ] **Step 2: App.tsx imports** — add `useColorScheme` to the react-native import; add `import { themeTForMode } from "./lib/themeMode";`. Remove `solarT` from the `@astro/engine` import (line 5) and remove the `quantize` import (both become unused). [Verify `quantize`'s import line during edit and drop it.]
- [ ] **Step 3: Replace `themeT`** — replace the current memo (App.tsx ~192–198):
```tsx
  // Theme: light=1 / dark=0 / auto=Sun altitude at the displayed moment (birth location).
  const themeT = useMemo(() => {
    if (themeMode === "light") return 1;
    if (themeMode === "dark") return 0;
    const inst = clock.mode === "compare" ? new Date(clock.compareAMs) : clock.displayInstant;
    return quantize(solarT(inst, birth.lat, birth.lon));
  }, [themeMode, clock.mode, clock.displayInstant, clock.compareAMs, birth.lat, birth.lon]);
```
with:
```tsx
  // Theme: light=1 / dark=0 / system=follow the OS scheme (live via useColorScheme).
  const osScheme = useColorScheme();
  const themeT = useMemo(
    () => themeTForMode(themeMode, osScheme === "dark"),
    [themeMode, osScheme],
  );
```
- [ ] **Step 4: Verify build** — reload the app; Metro bundles clean (no unused-import or type errors). Toggling will be wired in Task 8; for now `themeMode` is still "dark" by default so the app stays dark.
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/chartModel.ts apps/mobile/App.tsx
git commit -m "feat(mobile): theme 'system' mode follows OS (replaces solar auto)"
```

---

## Task 5: Persist themeMode in App (Part D wiring)

**Files:** Modify `apps/mobile/App.tsx`

- [ ] **Step 1: Import** — add `import { loadThemeMode, saveThemeMode } from "./lib/themeStorage";`.
- [ ] **Step 2: Load on launch + save on change** — after the export-settings load effect (App.tsx ~83–87), add:
```tsx
  // Load persisted theme on launch; persist on change.
  useEffect(() => {
    let active = true;
    loadThemeMode().then((m) => { if (active) setThemeMode(m); });
    return () => { active = false; };
  }, []);
  useEffect(() => { void saveThemeMode(themeMode); }, [themeMode]);
```
(The initial `useState<ThemeMode>("dark")` stays as the pre-load fallback.)
- [ ] **Step 3: Verify build** — reload; no errors. (Full persistence is exercised after Task 8 adds the control.)
- [ ] **Step 4: Commit**
```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): load/save themeMode across launches"
```

---

## Task 6: Now-header fix — displayed moment + no placeholder leak (Part E wiring)

**Files:** Modify `apps/mobile/App.tsx`

- [ ] **Step 1: Import** — add `import { bigThreeLabel } from "./lib/bigThree";`.
- [ ] **Step 2: birthLoaded flag** — add state near the others (~line 74): `const [birthLoaded, setBirthLoaded] = useState(false);`. In the loadBirth effect (App.tsx ~123–127), set it after the attempt resolves:
```tsx
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => {
      if (!active) return;
      if (b) setBirth({ ...b, name: isDefaultName(b.name) ? (accountNameRef.current || b.name) : b.name });
      setBirthLoaded(true);
    });
    return () => { active = false; };
  }, []);
```
- [ ] **Step 3: Rewrite `bigThree`** — replace App.tsx ~202–211:
```tsx
  // The chart's signature for the CURRENTLY DISPLAYED moment: Now -> live sky, Birth -> natal.
  // Ascendant (and natal data) only once the real birth has loaded, so the default chart never shows.
  const bigThree = useMemo(() => {
    const sun = signOf(livePos.sun);
    const moon = signOf(livePos.moon);
    const asc = !anonymous && birthLoaded
      ? signOf(ascendant(clock.displayInstant, birth.lat, birth.lon))
      : null;
    return bigThreeLabel(sun, moon, asc);
  }, [anonymous, birthLoaded, livePos, clock.displayInstant, birth.lat, birth.lon]);
```
- [ ] **Step 4: Guard the avatar glyph** — replace App.tsx ~215 so the avatar never shows the default natal sun pre-load:
```tsx
  const sunGlyph = SIGN_GLYPH[signOf((anonymous || !birthLoaded) ? livePos.sun : natalPos.sun) as Sign];
```
- [ ] **Step 5: Verify on emulator** — Now view shows live signs (Gemini today), not Leo; no default-1992 flash. Switch to Birth (signed in) → natal signs.
- [ ] **Step 6: Commit**
```bash
git add apps/mobile/App.tsx
git commit -m "fix(mobile): Now-header shows the displayed moment, not the natal/default chart"
```

---

## Task 7: Header button swap — ☰ opens menu, glyph opens Coordinates (Part A)

**Files:** Rename `apps/mobile/components/CoordinatesButton.tsx` → `apps/mobile/components/MenuButton.tsx`; modify `apps/mobile/App.tsx`

- [ ] **Step 1: Rename the component** — `git mv apps/mobile/components/CoordinatesButton.tsx apps/mobile/components/MenuButton.tsx`. In the new file, rename the component + its base: `MenuButtonBase` / `export const MenuButton`, and update the doc comment to "Round ☰ button that opens the settings menu." (Rendering — circle + 3 lines — unchanged.)
- [ ] **Step 2: App.tsx import** — change `import { CoordinatesButton } from "./components/CoordinatesButton";` → `import { MenuButton } from "./components/MenuButton";`.
- [ ] **Step 3: Swap the two header buttons** — replace App.tsx ~238–241:
```tsx
            <Pressable onPress={() => setMenuOpen(true)} style={styles.editBtn} hitSlop={8}>
              <Avatar glyph={sunGlyph} />
            </Pressable>
            <CoordinatesButton onPress={() => { if (anonymous) setAuthView("login"); else setCoordsOpen((v) => !v); }} />
```
with (☰ first/top opens menu; glyph second/bottom opens Coordinates):
```tsx
            <MenuButton onPress={() => setMenuOpen(true)} />
            <Pressable onPress={() => { if (anonymous) setAuthView("login"); else setCoordsOpen((v) => !v); }} style={styles.editBtn} hitSlop={8}>
              <Avatar glyph={sunGlyph} />
            </Pressable>
```
- [ ] **Step 4: Verify on emulator** — top button is ☰ and opens the settings menu; bottom button is the sun glyph and opens the Coordinates panel (anonymous → sign-in).
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/components/MenuButton.tsx apps/mobile/components/CoordinatesButton.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): swap header icons — hamburger opens menu, glyph opens Coordinates"
```

---

## Task 8: Theme control into the ☰ menu; remove from bottom sheet (Part B)

**Files:** Modify `apps/mobile/components/HeaderMenu.tsx`, `apps/mobile/App.tsx`, `apps/mobile/components/chart/ChartControls.tsx`

- [ ] **Step 1: HeaderMenu props + control** — in `components/HeaderMenu.tsx`:
  - Add imports: `import { Segmented } from "./Segmented";` and `import type { ThemeMode } from "../lib/chartModel";`.
  - Add to `Props`: `themeMode: ThemeMode;` and `onTheme: (m: ThemeMode) => void;`.
  - Add to the destructured params.
  - Add a module-level const:
    ```tsx
    const THEMES: { key: ThemeMode; label: string }[] = [
      { key: "light", label: "Light" },
      { key: "dark", label: "Dark" },
      { key: "system", label: "System" },
    ];
    ```
  - Insert a theme row after the auth/edit-birth block and before the `{canSave ? ...}` Save block:
    ```tsx
            <View style={styles.divider} />
            <View style={styles.themeRow}>
              <Text style={styles.themeLabel}>Theme</Text>
              <Segmented options={THEMES} value={themeMode} onChange={onTheme} />
            </View>
    ```
  - Add styles to `makeStyles`: `themeRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 }, themeLabel: { color: p.textDim, fontSize: 13, fontWeight: "600" },`.
- [ ] **Step 2: Plumb from App.tsx** — in the `<HeaderMenu ... />` element (App.tsx ~294–308), add: `themeMode={themeMode}` and `onTheme={setThemeMode}`.
- [ ] **Step 3: Remove from ChartControls** — in `components/chart/ChartControls.tsx`:
  - Remove the `THEMES` const (lines ~49–53).
  - Remove the Theme `<Section>` (the `<Section label="Theme"><Segmented options={THEMES} .../></Section>` block, ~147–149).
  - Remove `themeMode` / `onTheme` from `Props` (lines ~27–28) and from the destructured params.
  - Remove the now-unused `ThemeMode` import if nothing else in the file uses it (drop just `ThemeMode` from the `import type { ... } from "../../lib/chartModel"` list if unused).
  - Remove `themeMode={themeMode} onTheme={setThemeMode}` from the `<ChartControls .../>` call site in App.tsx (~281–282).
- [ ] **Step 4: Verify on emulator** — open ☰ menu: a "Theme" row with Light/Dark/System; selecting changes the palette immediately; System matches the OS and flips when the OS theme flips; relaunch keeps the choice; the bottom sheet no longer has a Theme section.
- [ ] **Step 5: Commit**
```bash
git add apps/mobile/components/HeaderMenu.tsx apps/mobile/App.tsx apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): move theme control into the header menu (Light/Dark/System)"
```

---

## Task 9: Final verification

- [ ] **Step 1:** `pnpm --filter @astro/mobile test` → all pass (incl. new themeMode/themeStorage/bigThree tests).
- [ ] **Step 2: Manual pass** — header swap (☰→menu, glyph→Coordinates); theme Light/Dark/System in the menu, live + persisted + OS-following; Now-header shows live signs (no Leo/default leak); Birth shows natal.
- [ ] **Step 3:** `git status` clean; `git log --oneline` shows the task commits on `feat/mobile-theme-header`.

## Self-Review (plan author)
- **Spec coverage:** A→T7; B→T8; C→T1,T4; D→T2,T5; E→T3,T6; testing→T1,T2,T3,T9. All mapped.
- **Placeholders:** none (the one `[Verify ...]` note is a real verification step, not a gap).
- **Type consistency:** `themeTForMode(mode, systemPrefersDark)`, `parseThemeMode(raw)`, `bigThreeLabel(sun, moon, asc)`, `loadThemeMode`/`saveThemeMode`, `MenuButton`, and the new `ThemeMode` (`light|dark|system`) are used identically across tasks and call sites.
