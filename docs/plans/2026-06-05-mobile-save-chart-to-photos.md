# Save Chart to Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let MoveStar users save their chart to Photos — a branded share card for free/anonymous users, a clean watermark-free export plus a Pro-only Share sheet for Pro users.

**Architecture:** A dedicated off-screen `ExportCard` renders the chart + optional overlays at a fixed resolution; `react-native-view-shot` captures it; `expo-media-library` saves it; `expo-sharing` shares it (Pro). Pure policy/settings modules are unit-tested with `node:test`; native capture/save is verified on-device. Mirrors the existing `proMode.ts` (pure, tested) and `birthStore.ts` (AsyncStorage IO, untested) split.

**Tech Stack:** Expo / React Native, `react-native-svg` (chart), `react-native-view-shot`, `expo-media-library`, `expo-sharing`, `@react-native-async-storage/async-storage`, `node:test`.

Spec: `docs/specs/2026-06-05-mobile-save-chart-to-photos-design.md`.

All paths are relative to `apps/mobile/`. Run commands from `apps/mobile/`. Tests run via `npm test` (`node --test --experimental-strip-types "lib/*.test.ts"`); typecheck via `npm run typecheck` (`tsc --noEmit`).

---

## Task 0: Add native dependencies + config plugin

**Files:**
- Modify: `apps/mobile/package.json` (via installer)
- Modify: `apps/mobile/app.json:29-34` (plugins array)

- [ ] **Step 1: Install the three libraries (version-matched to Expo SDK 54)**

Run:
```bash
npx expo install react-native-view-shot expo-media-library expo-sharing
```
Expected: `package.json` gains the three deps at Expo-compatible versions.

- [ ] **Step 2: Register the expo-media-library config plugin**

In `app.json`, change the `plugins` array (currently lines 29-34) to add the media-library plugin with a save-only Android intent and an iOS usage string (iOS is future, but the plugin requires the string):

```json
    "plugins": [
      "expo-font",
      "@react-native-community/datetimepicker",
      "expo-web-browser",
      "expo-apple-authentication",
      [
        "expo-media-library",
        {
          "photosPermission": "MoveStar saves your chart images to your photo library.",
          "savePhotosPermission": "MoveStar saves your chart images to your photo library.",
          "isAccessMediaLocationEnabled": false
        }
      ]
    ],
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: PASS (no usages yet; just deps + config).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/package-lock.json
git commit -m "chore(mobile): add view-shot, media-library, sharing deps + media plugin"
```

> NOTE: These are native modules — they require a new dev/EAS build to run (not Expo Go). The on-device acceptance pass (Task 11) runs on that rebuild, which is also the `goog_` billing build.

---

## Task 1: `exportPolicy` — pure tier policy (TDD)

**Files:**
- Create: `apps/mobile/lib/exportPolicy.ts`
- Test: `apps/mobile/lib/exportPolicy.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/exportPolicy.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { framingFor, canShare } from "./exportPolicy.ts";

test("framingFor: pro is clean; free and anon are branded", () => {
  assert.equal(framingFor("pro"), "clean");
  assert.equal(framingFor("free"), "branded");
  assert.equal(framingFor("anonymous"), "branded");
});

test("canShare: only pro can use the system share sheet", () => {
  assert.equal(canShare("pro"), true);
  assert.equal(canShare("free"), false);
  assert.equal(canShare("anonymous"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./exportPolicy.ts`.

- [ ] **Step 3: Write minimal implementation**

`lib/exportPolicy.ts`:
```ts
import type { Tier } from "./entitlement.ts";

export type Framing = "branded" | "clean";

/** Pro exports are clean (no watermark/chrome); free and anonymous get the branded share card. */
export function framingFor(tier: Tier): Framing {
  return tier === "pro" ? "clean" : "branded";
}

/** The native Share sheet is Pro-only; free/anon get Save-to-Photos only. */
export function canShare(tier: Tier): boolean {
  return tier === "pro";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exportPolicy.ts lib/exportPolicy.test.ts
git commit -m "feat(mobile): exportPolicy — tier framing + Pro-only share"
```

---

## Task 2: `exportSettings` — pure toggle model (TDD)

**Files:**
- Create: `apps/mobile/lib/exportSettings.ts`
- Test: `apps/mobile/lib/exportSettings.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/exportSettings.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting, parseExportSettings } from "./exportSettings.ts";

test("defaults: all four overlays on", () => {
  assert.deepEqual(DEFAULT_EXPORT_SETTINGS, {
    caption: true, dateTime: true, placeLabel: true, cosmicBackground: true,
  });
});

test("toggleSetting flips one key immutably", () => {
  const next = toggleSetting(DEFAULT_EXPORT_SETTINGS, "placeLabel");
  assert.equal(next.placeLabel, false);
  assert.equal(DEFAULT_EXPORT_SETTINGS.placeLabel, true); // original untouched
  assert.equal(next.caption, true);
});

test("parseExportSettings falls back to defaults for missing/invalid fields", () => {
  assert.deepEqual(parseExportSettings(null), DEFAULT_EXPORT_SETTINGS);
  assert.deepEqual(parseExportSettings("nope"), DEFAULT_EXPORT_SETTINGS);
  const partial = parseExportSettings({ caption: false, placeLabel: "x" });
  assert.equal(partial.caption, false);      // valid boolean kept
  assert.equal(partial.placeLabel, true);    // invalid -> default
  assert.equal(partial.dateTime, true);      // missing -> default
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./exportSettings.ts`.

- [ ] **Step 3: Write minimal implementation**

`lib/exportSettings.ts`:
```ts
/** Which optional overlays appear in the saved chart image. */
export interface ExportSettings {
  caption: boolean;          // Sun/Moon/Rising line
  dateTime: boolean;         // moment / birth date-time line
  placeLabel: boolean;       // birth place / chart label
  cosmicBackground: boolean; // starfield vs solid theme color
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  caption: true,
  dateTime: true,
  placeLabel: true,
  cosmicBackground: true,
};

export type ExportToggleKey = keyof ExportSettings;

/** Immutable flip of a single switch. */
export function toggleSetting(s: ExportSettings, key: ExportToggleKey): ExportSettings {
  return { ...s, [key]: !s[key] };
}

/** Parse persisted JSON into ExportSettings; any missing/invalid field falls back to default. */
export function parseExportSettings(raw: unknown): ExportSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EXPORT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const bool = (k: ExportToggleKey): boolean =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_EXPORT_SETTINGS[k];
  return {
    caption: bool("caption"),
    dateTime: bool("dateTime"),
    placeLabel: bool("placeLabel"),
    cosmicBackground: bool("cosmicBackground"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exportSettings.ts lib/exportSettings.test.ts
git commit -m "feat(mobile): exportSettings — toggle model + parse"
```

---

## Task 3: `exportSettingsStore` — AsyncStorage persistence

**Files:**
- Create: `apps/mobile/lib/exportSettingsStore.ts`

(No `node:test`: this imports `AsyncStorage`, a native module unavailable under `node --test` — same reason `birthStore.ts` has no test. The pure logic it relies on is already covered by Task 2.)

- [ ] **Step 1: Write the implementation**

`lib/exportSettingsStore.ts`:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_EXPORT_SETTINGS, parseExportSettings } from "./exportSettings";
import type { ExportSettings } from "./exportSettings";

const KEY = "movestar.exportSettings.v1";

/** Load saved export toggles, or defaults if absent/corrupt. */
export async function loadExportSettings(): Promise<ExportSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? parseExportSettings(JSON.parse(raw)) : { ...DEFAULT_EXPORT_SETTINGS };
  } catch {
    return { ...DEFAULT_EXPORT_SETTINGS };
  }
}

/** Persist export toggles (local cache only; ignore write errors). */
export async function saveExportSettings(s: ExportSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* local cache only */
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/exportSettingsStore.ts
git commit -m "feat(mobile): persist export settings to AsyncStorage"
```

---

## Task 4: `ChartWheel` — optional fixed `size` prop

**Files:**
- Modify: `apps/mobile/components/chart/ChartWheel.tsx`

The wheel currently sizes itself from `useWindowDimensions()`. The ExportCard needs a fixed export size. Add an optional `size` prop; when present, use it instead of the window-derived value (fully backward compatible — existing call sites pass no `size`).

- [ ] **Step 1: Add the prop and use it**

In `ChartWheel.tsx`, change the `Props` interface (after line 19, `showNatal?: boolean;`) to add:
```ts
  /** Fixed export size in px; when omitted the wheel fills the screen (live use). */
  size?: number;
```

Then change the component body (lines 24-26) from:
```ts
function ChartWheelBase({ natalPositions, livePositions, curvedLabels = true, showMajor = true, showMinor = true, vis, showNatal = true }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
```
to:
```ts
function ChartWheelBase({ natalPositions, livePositions, curvedLabels = true, showMajor = true, showMinor = true, vis, showNatal = true, size }: Props) {
  const { width, height } = useWindowDimensions();
  const resolved = size ?? Math.max(0, Math.min(width, height) - CHART.wheelPadding);
```
And replace the two remaining `size` references (lines 28-29) with `resolved`:
```ts
    <View style={{ width: resolved, height: resolved }}>
      <Svg width={resolved} height={resolved} viewBox="0 0 1000 1000">
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/chart/ChartWheel.tsx
git commit -m "feat(mobile): ChartWheel accepts optional fixed size (for export)"
```

---

## Task 5: `ExportCard` — the composed image (branded + clean, single wheel)

**Files:**
- Create: `apps/mobile/components/export/ExportCard.tsx`

(No unit test — it's a React component rendering native views; verified on-device in Task 11. Typecheck-gated.)

- [ ] **Step 1: Write the component**

`components/export/ExportCard.tsx`:
```tsx
import { StyleSheet, Text, View } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import type { Vis } from "../../lib/chartModel";
import type { Framing } from "../../lib/exportPolicy";
import type { ExportSettings } from "../../lib/exportSettings";
import { ThemeProvider } from "../../lib/theme";
import { ChartWheel } from "../chart/ChartWheel";
import { Sky } from "../chart/Sky";

/** Square export resolution (px). 1080 = clean for social. */
export const EXPORT_SIZE = 1080;

export interface ExportCardProps {
  framing: Framing;
  toggles: ExportSettings;
  palette: Palette;
  themeT: number;
  natalPositions: Positions;
  livePositions: Positions;
  showNatal: boolean;
  showMajor: boolean;
  showMinor: boolean;
  vis: Vis;
  /** Pre-built strings from App (e.g. "☉ Leo  ☽ Aries  ↑ Libra"). */
  caption: string;
  /** e.g. "Birth · Jul 29, 1992 · 2:28pm". */
  dateText: string;
  /** e.g. "Jonesboro, AR". */
  placeLabel?: string;
}

/** A fixed-size composed chart image. `branded` adds the MoveStar wordmark + footer;
 *  `clean` (Pro) omits all branding. Overlay text obeys `toggles`. */
export function ExportCard({
  framing, toggles, palette: p, themeT,
  natalPositions, livePositions, showNatal, showMajor, showMinor, vis,
  caption, dateText, placeLabel,
}: ExportCardProps) {
  const branded = framing === "branded";
  const wheel = EXPORT_SIZE - 260; // leave room for wordmark/caption/labels/footer
  return (
    <ThemeProvider value={{ t: themeT, palette: p }}>
      <View style={[styles.card, { width: EXPORT_SIZE, height: EXPORT_SIZE, backgroundColor: p.bg }]}>
        {toggles.cosmicBackground ? <Sky themeT={themeT} /> : null}
        {branded ? <Text style={[styles.wordmark, { color: p.text }]}>MOVESTAR</Text> : null}
        <View style={styles.stage}>
          {toggles.caption ? <Text style={[styles.caption, { color: p.textDim }]}>{caption}</Text> : null}
          <View style={{ width: wheel, height: wheel }}>
            <ChartWheel
              size={wheel}
              natalPositions={natalPositions}
              livePositions={livePositions}
              showNatal={showNatal}
              showMajor={showMajor}
              showMinor={showMinor}
              vis={vis}
            />
          </View>
          {toggles.dateTime ? <Text style={[styles.date, { color: p.text }]}>{dateText}</Text> : null}
          {toggles.placeLabel && placeLabel ? (
            <Text style={[styles.place, { color: p.textDim }]}>{placeLabel}</Text>
          ) : null}
        </View>
        {branded ? <Text style={[styles.footer, { color: p.textDim }]}>movestar.app</Text> : null}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", alignItems: "center", justifyContent: "space-between", paddingVertical: 48 },
  wordmark: { fontSize: 40, letterSpacing: 10, fontWeight: "700" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: { fontSize: 30, letterSpacing: 1.5, marginBottom: 18, textAlign: "center" },
  date: { fontSize: 28, letterSpacing: 0.5, marginTop: 18, textAlign: "center" },
  place: { fontSize: 24, marginTop: 6, textAlign: "center" },
  footer: { fontSize: 22, letterSpacing: 2, opacity: 0.8 },
});
```

> Layout values (font sizes, padding, `wheel` size) are first-pass — they get tuned during the on-device pass (Task 11), per the spec. `Sky` already absolute-fills its parent, so it sits behind the stage.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/export/ExportCard.tsx
git commit -m "feat(mobile): ExportCard composed chart image (branded + clean)"
```

---

## Task 6: `saveChart` — capture + save + share

**Files:**
- Create: `apps/mobile/lib/saveChart.ts`

(No unit test — wraps native modules; verified on-device. Typecheck-gated.)

- [ ] **Step 1: Write the implementation**

`lib/saveChart.ts`:
```ts
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "permission" | "error" };

async function capture(ref: RefObject<View | null>): Promise<string> {
  return captureRef(ref, { format: "png", quality: 1 });
}

/** Capture the referenced view and write it to the device photo library. */
export async function saveChartImage(ref: RefObject<View | null>): Promise<SaveResult> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(); // write+read; save needs write
    if (!perm.granted) return { ok: false, reason: "permission" };
    const uri = await capture(ref);
    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Capture the referenced view and open the native share sheet (Pro only — caller gates). */
export async function shareChartImage(ref: RefObject<View | null>): Promise<SaveResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: "error" };
    const uri = await capture(ref);
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/saveChart.ts
git commit -m "feat(mobile): saveChart — view-shot capture + media save + share"
```

---

## Task 7: "Saved image" toggles in ChartControls

**Files:**
- Modify: `apps/mobile/components/chart/ChartControls.tsx`

Add a new `Section` with four toggle buttons (reusing the existing `btn`/`btnOn` style already used by the Aspects toggles, lines 161-170). The settings + handler are passed from App.

- [ ] **Step 1: Extend Props and import the type**

In `ChartControls.tsx`, add to the imports near line 9:
```ts
import type { ExportSettings, ExportToggleKey } from "../../lib/exportSettings";
```
Add to the `Props` interface (after `onToggleVis`, line 30):
```ts
  exportSettings: ExportSettings;
  onToggleExport: (key: ExportToggleKey) => void;
```
Add the two new props to the destructure (lines 70-71):
```ts
  themeMode, onTheme, vis, onToggleVis, exportSettings, onToggleExport,
```

- [ ] **Step 2: Add the section before the closing `</View>` (after the Aspects Section, line 170)**

```tsx
      <Section label="Saved image">
        <View style={styles.rowTight}>
          <Pressable style={[styles.btn, exportSettings.caption && styles.btnOn]} onPress={() => onToggleExport("caption")}>
            <Text style={[styles.btnText, exportSettings.caption && styles.btnTextOn]}>Caption</Text>
          </Pressable>
          <Pressable style={[styles.btn, exportSettings.dateTime && styles.btnOn]} onPress={() => onToggleExport("dateTime")}>
            <Text style={[styles.btnText, exportSettings.dateTime && styles.btnTextOn]}>Date</Text>
          </Pressable>
        </View>
        <View style={[styles.rowTight, { marginTop: 8 }]}>
          <Pressable style={[styles.btn, exportSettings.placeLabel && styles.btnOn]} onPress={() => onToggleExport("placeLabel")}>
            <Text style={[styles.btnText, exportSettings.placeLabel && styles.btnTextOn]}>Place</Text>
          </Pressable>
          <Pressable style={[styles.btn, exportSettings.cosmicBackground && styles.btnOn]} onPress={() => onToggleExport("cosmicBackground")}>
            <Text style={[styles.btnText, exportSettings.cosmicBackground && styles.btnTextOn]}>Stars</Text>
          </Pressable>
        </View>
      </Section>
```

- [ ] **Step 3: Verify typecheck (will fail at the App call site — expected, fixed in Task 9)**

Run: `npm run typecheck`
Expected: FAIL at `App.tsx` (ChartControls now requires `exportSettings`/`onToggleExport`). The ChartControls file itself is correct. Do NOT commit until typecheck is green after Task 9 — Tasks 7-9 commit together.

---

## Task 8: Save / Share items in HeaderMenu

**Files:**
- Modify: `apps/mobile/components/HeaderMenu.tsx`

- [ ] **Step 1: Extend Props**

In `HeaderMenu.tsx`, change the `Props` interface (lines 6-12) to add save/share:
```ts
interface Props {
  visible: boolean;
  signedIn: boolean;
  canShare: boolean;            // Pro-only: show the Share item
  onClose: () => void;
  onAuth: () => void;
  onEditBirth: () => void;
  onSave: () => void;           // Save chart to Photos
  onShare: () => void;          // Share chart (Pro)
}
```
Update the destructure (line 16):
```ts
export function HeaderMenu({ visible, signedIn, canShare, onClose, onAuth, onEditBirth, onSave, onShare }: Props) {
```

- [ ] **Step 2: Add the menu items (inside the card, after the existing items — before line 34 `</View>`)**

```tsx
        <View style={styles.divider} />
        <Pressable style={styles.item} onPress={onSave}>
          <Text style={styles.itemText}>Save to Photos</Text>
        </Pressable>
        {canShare ? (
          <Pressable style={styles.item} onPress={onShare}>
            <Text style={styles.itemText}>Share…</Text>
          </Pressable>
        ) : null}
```

- [ ] **Step 3: Verify typecheck (will fail at App call site — expected, fixed in Task 9)**

Run: `npm run typecheck`
Expected: FAIL at `App.tsx` (HeaderMenu now requires the new props). HeaderMenu itself is correct. Commit with Task 9.

---

## Task 9: Wire export into App — state, off-screen host, handlers

**Files:**
- Modify: `apps/mobile/App.tsx`

Adds export settings state, the off-screen `ExportCard` host with capture timing, the save/share handlers (Android toast + permission alert), and passes the new props to `HeaderMenu`/`ChartControls`. After this task, typecheck is green again — commit Tasks 7-9 together.

- [ ] **Step 1: Add imports (top of App.tsx)**

Merge into existing imports / add:
```ts
import { useRef } from "react"; // add to the existing "react" import
import { Alert, Platform, ToastAndroid } from "react-native"; // add to the existing RN import
import { ExportCard, EXPORT_SIZE } from "./components/export/ExportCard";
import { framingFor, canShare as canShareFor } from "./lib/exportPolicy";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting } from "./lib/exportSettings";
import type { ExportSettings, ExportToggleKey } from "./lib/exportSettings";
import { loadExportSettings, saveExportSettings } from "./lib/exportSettingsStore";
import { saveChartImage, shareChartImage } from "./lib/saveChart";
```
(`Pressable`, `View`, `Text`, `StyleSheet`, `useWindowDimensions` already imported; add `Alert`, `Platform`, `ToastAndroid`. `useEffect`/`useMemo`/`useState` already imported; add `useRef`.)

- [ ] **Step 2: Add export state inside `AppInner` (after the existing `vis` state, ~line 56)**

```ts
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [exportReq, setExportReq] = useState<null | "save" | "share">(null);
  const exportRef = useRef<View>(null);

  // Load persisted export toggles on launch.
  useEffect(() => {
    let active = true;
    loadExportSettings().then((s) => { if (active) setExportSettings(s); });
    return () => { active = false; };
  }, []);

  const onToggleExport = (key: ExportToggleKey) => {
    setExportSettings((s) => {
      const next = toggleSetting(s, key);
      saveExportSettings(next).catch(() => { /* cache only */ });
      return next;
    });
  };
```

- [ ] **Step 3: Add the capture effect (after the export state)**

```ts
  // When an export is requested, the off-screen ExportCard renders; wait two frames for
  // layout, capture it, then save or share. Clear the request when done.
  useEffect(() => {
    if (!exportReq) return;
    let cancelled = false;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (cancelled) return;
        const result = exportReq === "save"
          ? await saveChartImage(exportRef)
          : await shareChartImage(exportRef);
        if (cancelled) return;
        if (result.ok && exportReq === "save") {
          if (Platform.OS === "android") ToastAndroid.show("Saved to Photos", ToastAndroid.SHORT);
        } else if (!result.ok && result.reason === "permission") {
          Alert.alert("Photo access needed", "Allow photo access in Settings to save charts.");
        } else if (!result.ok) {
          Alert.alert("Couldn’t save", "Something went wrong. Please try again.");
        }
        setExportReq(null);
      }),
    );
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [exportReq]);
```

- [ ] **Step 4: Pass the new props to HeaderMenu (replace the existing `<HeaderMenu .../>` block, ~lines 184-190)**

```tsx
      <HeaderMenu
        visible={menuOpen}
        signedIn={!!session}
        canShare={canShareFor(tier)}
        onClose={() => setMenuOpen(false)}
        onAuth={() => { setMenuOpen(false); setAuthView(session ? "account" : "login"); }}
        onEditBirth={() => { setMenuOpen(false); setEditing(true); }}
        onSave={() => { setMenuOpen(false); setExportReq("save"); }}
        onShare={() => { setMenuOpen(false); setExportReq("share"); }}
      />
```

- [ ] **Step 5: Pass the new props to ChartControls (inside the `<BottomSheet>` block, after `onToggleVis={onToggleVis}`, ~line 178)**

```tsx
            exportSettings={exportSettings}
            onToggleExport={onToggleExport}
```

- [ ] **Step 6: Render the off-screen ExportCard host (just before `<StatusBar .../>`, ~line 193)**

```tsx
      {exportReq ? (
        <View ref={exportRef} collapsable={false} style={styles.exportHost}>
          <ExportCard
            framing={framingFor(tier)}
            toggles={exportSettings}
            palette={palette}
            themeT={themeT}
            natalPositions={natalPos}
            livePositions={livePos}
            showNatal={!anonymous}
            showMajor={showMajor}
            showMinor={showMinor}
            vis={vis}
            caption={bigThree}
            dateText={moment}
            placeLabel={birth.placeLabel}
          />
        </View>
      ) : null}
```
(`natalPos`, `livePos`, `vis`, `showMajor`, `showMinor`, `bigThree`, `moment`, `birth`, `anonymous`, `palette`, `themeT`, `tier` are all already in scope in `AppInner`.)

> NOTE: This single-wheel host renders the natal/live wheel. Compare export is added in Task 10; until then, Save in Compare mode captures the single-wheel snapshot.

- [ ] **Step 7: Add the off-screen style to `makeStyles` (the `StyleSheet.create({...})`, ~line 207)**

```ts
  exportHost: { position: "absolute", left: -100000, top: 0, width: EXPORT_SIZE, height: EXPORT_SIZE },
```

- [ ] **Step 8: Verify typecheck is now green**

Run: `npm run typecheck`
Expected: PASS (Tasks 7, 8, 9 call sites now consistent).

- [ ] **Step 9: Commit Tasks 7-9 together**

```bash
git add App.tsx components/HeaderMenu.tsx components/chart/ChartControls.tsx
git commit -m "feat(mobile): wire Save/Share to Photos + Saved-image toggles"
```

---

## Task 10: Compare-mode export

**Files:**
- Modify: `apps/mobile/components/export/ExportCard.tsx`
- Modify: `apps/mobile/App.tsx`
- Possibly modify: `apps/mobile/components/chart/CompareWheel.tsx`

In Compare mode the live screen shows two charts (`CompareView`). Make the export render both.

- [ ] **Step 1: Read the compare components to learn their props**

Run: `sed -n '1,80p' components/chart/CompareView.tsx; echo "----"; sed -n '1,80p' components/chart/CompareWheel.tsx`
Expected: note the prop shapes (`a`/`b` caption+positions, `view`, `showMajor`, `showMinor`, `vis`); `CompareView` is already used in `App.tsx` lines 138-145. Confirm whether `CompareWheel` already accepts a fixed `size`; if not, apply the same `size ?? window` pattern from Task 4.

- [ ] **Step 2: Add a `compare` branch to ExportCard**

Add an optional discriminator to `ExportCardProps`:
```ts
  /** When set, render the Compare pair instead of the single natal/live wheel. */
  compare?: {
    aPos: Positions;
    bPos: Positions;
    aSub: string;
    bSub: string;
  };
```
In the component body, when `compare` is provided, render two fixed-size compare wheels (each ≈ `(EXPORT_SIZE - 320) / 2`, stacked, mirroring `CompareView`'s `both` layout) with their captions, instead of the single `<ChartWheel>`. Reuse the existing `CompareWheel` (add a `size` prop per Step 1 if needed). Keep the branded/clean framing and overlay toggles identical to the single-wheel path.

- [ ] **Step 3: Pass `compare` from App when in compare mode**

In the App export host (Task 9 Step 6), add — using values already computed in `AppInner` (`compareAPos`, `compareBPos`, `cmpA`, `cmpB`):
```tsx
            compare={clock.mode === "compare"
              ? { aPos: compareAPos, bPos: compareBPos, aSub: cmpA, bSub: cmpB }
              : undefined}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/export/ExportCard.tsx components/chart/CompareWheel.tsx App.tsx
git commit -m "feat(mobile): export Compare view (both charts) for Pro"
```

---

## Task 11: On-device acceptance pass (manual)

**Prerequisite:** a dev or EAS build that includes the Task 0 native modules (this is the same `goog_` billing build). Install on a physical Android device.

- [ ] **Save — free/anon (branded card):** As a signed-in free user in **Birth** view, header menu → "Save to Photos." Grant the permission. Verify the image has the **MoveStar wordmark + footer** and the caption/date/place per toggles. Repeat signed-out in **Now** view (branded, no Ascendant in caption).
- [ ] **Save — Pro (clean):** As a Pro user (license tester), save in **Birth**, **Date**, **Range**. Verify the image is **clean** (no wordmark/avatar/sheet/HUD/watermark), full themed background, overlays per toggles.
- [ ] **Share — Pro only:** Confirm "Share…" is **absent** for free/anon, **present** for Pro; tapping opens the native share sheet with the PNG.
- [ ] **Toggles:** Turn each of Caption / Date / Place / Stars off; confirm the next saved image omits that element; confirm choices **persist** after an app restart.
- [ ] **Permission denied:** Deny the photo permission; confirm the friendly "Allow photo access in Settings" alert appears and the app does not crash.
- [ ] **Compare:** As Pro in **Compare** view, save and verify **both** charts appear.
- [ ] **Visual tuning:** Adjust `ExportCard` layout constants (font sizes, padding, wheel size) and re-capture until the cards look right. Commit any tuning:
```bash
git add components/export/ExportCard.tsx
git commit -m "polish(mobile): tune ExportCard layout from on-device review"
```

---

## Self-review notes (author)

- **Spec coverage:** tiers/gating → Task 1 + Task 9 (canShare wiring); branded vs clean → Task 5; 4 toggles + persistence → Tasks 2/3/7; ExportCard/exportPolicy/exportSettings/saveChart units → Tasks 5/1/2+3/6; entry points → Tasks 7/8/9; deps + permissions + data-safety(no-op) → Task 0; Compare → Task 10; testing (TDD pure + on-device) → Tasks 1/2 + 11. Every spec section maps to a task.
- **Type consistency:** `Framing`, `ExportSettings`, `ExportToggleKey`, `SaveResult`, `ExportCardProps`, `EXPORT_SIZE`, `framingFor`, `canShare` are used identically across tasks.
- **No placeholders:** every code step contains complete code; the only deliberately-deferred specifics are `CompareWheel` prop names (Task 10 Step 1 reads them first) and visual constants (tuned in Task 11), both explicitly flagged.
