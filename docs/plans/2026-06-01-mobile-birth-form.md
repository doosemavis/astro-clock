# Mobile Birth Form (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user enter their own birth (name, date, time, geocoded place) so the chart wheel renders *their* natal chart, persisted locally and reloaded on launch — no auth.

**Architecture:** A `Modal` birth form over the wheel. Place lookup hits the free Open-Meteo geocoding API (`fetch`, no key) and returns lat/lon + IANA timezone; the birth-moment UTC offset is derived from that timezone via `Intl` (no manual offset/DST). Pure helpers (`timezone`, `birthValidation`) are unit-tested under Node; the form, geocode, and AsyncStorage store are verified by typecheck + Android bundle + a web-target render + the device run. `App.tsx` holds `birth` state, loads/saves it, and recomputes `natalPos` on change.

**Tech Stack:** Expo SDK 54, React Native, `@react-native-community/datetimepicker`, `@react-native-async-storage/async-storage`, built-in `fetch`, `@astro/engine`, TypeScript, `node --test`.

**Spec:** `docs/specs/2026-06-01-mobile-birth-form-design.md`

> Network note: `expo install` + the geocode calls need network. The geocode endpoint is `https://geocoding-api.open-meteo.com/v1/search`.

---

## Engine API reference (already implemented)

- `BirthData = { name?, date:"YYYY-MM-DD", time:"HH:MM", tzOffset:number, isDst:boolean, lat:number, lon:number, placeLabel?:string }`.
- `birthInstant(b)` computes the UTC instant as `Date.UTC(date,time) - (tzOffset + (isDst?1:0))*3600000`. **So the engine only needs the total offset**: we set `tzOffset =` total offset hours, `isDst = false`.
- `positions(date)`, `DEFAULT_BIRTH`, `NIGHT`. Tests run via `node --test --experimental-strip-types`.

---

## File structure

**Create (under `apps/mobile/`):**
- `lib/timezone.ts` + `lib/timezone.test.ts` — derive total UTC offset from an IANA tz at a birth date.
- `lib/birthValidation.ts` + `lib/birthValidation.test.ts` — validate a draft → `BirthData`.
- `lib/geocode.ts` — Open-Meteo place search.
- `lib/birthStore.ts` — AsyncStorage load/save.
- `components/BirthForm.tsx` — the modal form.

**Modify:**
- `apps/mobile/package.json` — add the two native deps (via `expo install`) + a `test` script.
- `apps/mobile/App.tsx` — birth state, load/save, edit button + modal.

**Untouched:** `apps/web`, `packages/engine`.

---

## Task 1: Install deps + add the test script

**Files:** Modify `apps/mobile/package.json`, root `pnpm-lock.yaml`

- [ ] **Step 1: Install the native modules (SDK-aligned)**

Run (repo root):
```bash
cd apps/mobile && npx expo install @react-native-community/datetimepicker @react-native-async-storage/async-storage && cd ../..
```
Expected: both added to `apps/mobile/package.json` `dependencies` at Expo-selected versions.

- [ ] **Step 2: Relink the workspace**

Run (repo root): `pnpm install`
Expected: completes; both modules in the hoisted `node_modules`.

- [ ] **Step 3: Add a `test` script to `apps/mobile/package.json`**

In `apps/mobile/package.json`, add to `scripts` (mirrors the engine's runner):
```json
    "test": "node --test --experimental-strip-types \"lib/*.test.ts\""
```

- [ ] **Step 4: Typecheck still green**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors (nothing uses the new deps yet).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add datetimepicker + async-storage; mobile test script"
```

---

## Task 2: `lib/timezone.ts` (TDD)

**Files:** Create `apps/mobile/lib/timezone.test.ts`, `apps/mobile/lib/timezone.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/timezone.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { offsetHoursAt } from "./timezone.ts";

test("Chicago summer date is CDT (-5)", () => {
  assert.equal(offsetHoursAt("1992-07-29", "14:28", "America/Chicago"), -5);
});

test("Chicago winter date is CST (-6)", () => {
  assert.equal(offsetHoursAt("1992-01-15", "09:00", "America/Chicago"), -6);
});

test("India is +5.5 (no DST)", () => {
  assert.equal(offsetHoursAt("2000-06-01", "12:00", "Asia/Kolkata"), 5.5);
});

test("UTC is 0", () => {
  assert.equal(offsetHoursAt("2000-06-01", "12:00", "UTC"), 0);
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL (`Cannot find module './timezone.ts'` / `offsetHoursAt is not a function`).

- [ ] **Step 3: Implement `lib/timezone.ts`**

```ts
/**
 * Total UTC offset (hours) that `ianaTz` had at the given local birth date/time.
 * Reads the zone's wall-clock for the provisional instant (the local components treated
 * as UTC) via Intl; the gap between that wall-clock and the provisional instant is the
 * offset. Handles historical DST. Fractional zones (+5.5, +5.75) are preserved.
 */
export function offsetHoursAt(date: string, time: string, ianaTz: string): number {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const provisionalMs = Date.UTC(Y, M - 1, D, h, m);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(provisionalMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  const zoneWallMs = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (zoneWallMs - provisionalMs) / 3600000;
}
```

- [ ] **Step 4: Run it — must PASS**

Run: `pnpm --filter @astro/mobile test`
Expected: 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/timezone.ts apps/mobile/lib/timezone.test.ts
git commit -m "feat(mobile): offsetHoursAt — derive birth-moment UTC offset from IANA tz"
```

---

## Task 3: `lib/birthValidation.ts` (TDD)

**Files:** Create `apps/mobile/lib/birthValidation.test.ts`, `apps/mobile/lib/birthValidation.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/birthValidation.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBirth } from "./birthValidation.ts";

test("valid draft builds BirthData with isDst false", () => {
  const r = validateBirth({ name: "Ada", date: "1992-07-29", time: "14:28", lat: 35.84, lon: -90.7, tzOffset: -5, placeLabel: "Jonesboro, AR" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.birth.isDst, false);
    assert.equal(r.birth.tzOffset, -5);
    assert.equal(r.birth.name, "Ada");
  }
});

test("blank name becomes undefined", () => {
  const r = validateBirth({ name: "  ", date: "1992-07-29", time: "14:28", lat: 0, lon: 0, tzOffset: 0 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.birth.name, undefined);
});

test("missing place fails", () => {
  const r = validateBirth({ date: "1992-07-29", time: "14:28", lat: null, lon: null, tzOffset: null });
  assert.equal(r.ok, false);
});

test("out-of-range latitude fails", () => {
  const r = validateBirth({ date: "1992-07-29", time: "14:28", lat: 200, lon: 0, tzOffset: 0 });
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL (`Cannot find module './birthValidation.ts'`).

- [ ] **Step 3: Implement `lib/birthValidation.ts`**

```ts
import type { BirthData } from "@astro/engine";

export interface BirthDraft {
  name?: string;
  date: string;            // "YYYY-MM-DD"
  time: string;            // "HH:MM"
  lat: number | null;
  lon: number | null;
  tzOffset: number | null; // total offset hours
  placeLabel?: string;
}

export type ValidationResult =
  | { ok: true; birth: BirthData }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function validateBirth(d: BirthDraft): ValidationResult {
  if (!DATE_RE.test(d.date)) return { ok: false, error: "Pick a birth date." };
  if (!TIME_RE.test(d.time)) return { ok: false, error: "Pick a birth time." };
  if (d.lat === null || d.lon === null || Number.isNaN(d.lat) || Number.isNaN(d.lon)) {
    return { ok: false, error: "Choose a birth place (or enter coordinates in Advanced)." };
  }
  if (d.lat < -90 || d.lat > 90) return { ok: false, error: "Latitude must be between -90 and 90." };
  if (d.lon < -180 || d.lon > 180) return { ok: false, error: "Longitude must be between -180 and 180." };
  if (d.tzOffset === null || Number.isNaN(d.tzOffset) || d.tzOffset < -14 || d.tzOffset > 14) {
    return { ok: false, error: "Time zone offset is invalid." };
  }
  return {
    ok: true,
    birth: {
      name: d.name?.trim() ? d.name.trim() : undefined,
      date: d.date,
      time: d.time,
      tzOffset: d.tzOffset,
      isDst: false,
      lat: d.lat,
      lon: d.lon,
      placeLabel: d.placeLabel,
    },
  };
}
```
(`import type` is erased at runtime, so this test runs under Node with no `@astro/engine` load.)

- [ ] **Step 4: Run it — must PASS**

Run: `pnpm --filter @astro/mobile test`
Expected: all timezone + validation tests pass (7 total).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/birthValidation.ts apps/mobile/lib/birthValidation.test.ts
git commit -m "feat(mobile): validateBirth — draft -> BirthData with bounds checks"
```

---

## Task 4: `lib/geocode.ts`

**Files:** Create `apps/mobile/lib/geocode.ts`

- [ ] **Step 1: Implement `lib/geocode.ts`**

```ts
export interface PlaceResult {
  label: string;     // "City, Admin1, Country"
  lat: number;
  lon: number;
  timezone: string;  // IANA, e.g. "America/Chicago"
}

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone: string;
}

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

/** Search places by name. Returns [] for no match; throws Error("network") on failure. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ENDPOINT}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("network");
  }
  if (!res.ok) throw new Error("network");
  const data = (await res.json()) as { results?: OpenMeteoResult[] };
  if (!data.results) return [];
  return data.results.map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/geocode.ts
git commit -m "feat(mobile): geocode — Open-Meteo place search (no key)"
```

---

## Task 5: `lib/birthStore.ts`

**Files:** Create `apps/mobile/lib/birthStore.ts`

- [ ] **Step 1: Implement `lib/birthStore.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BirthData } from "@astro/engine";

const KEY = "movestar.birth.v1";

/** Returns the saved birth, or null if absent/corrupt (caller falls back to DEFAULT_BIRTH). */
export async function loadBirth(): Promise<BirthData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as BirthData;
    const valid =
      typeof b?.date === "string" &&
      typeof b?.time === "string" &&
      typeof b?.lat === "number" &&
      typeof b?.lon === "number" &&
      typeof b?.tzOffset === "number" &&
      typeof b?.isDst === "boolean";
    return valid ? b : null;
  } catch {
    return null;
  }
}

export async function saveBirth(b: BirthData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(b));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/birthStore.ts
git commit -m "feat(mobile): birthStore — AsyncStorage load/save"
```

---

## Task 6: `components/BirthForm.tsx`

**Files:** Create `apps/mobile/components/BirthForm.tsx`

- [ ] **Step 1: Implement `components/BirthForm.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, StyleSheet, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { searchPlaces } from "../lib/geocode";
import type { PlaceResult } from "../lib/geocode";
import { offsetHoursAt } from "../lib/timezone";
import { validateBirth } from "../lib/birthValidation";

interface Props {
  visible: boolean;
  initial: BirthData;
  onSave: (b: BirthData) => void;
  onCancel: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateToStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeToStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const strToDate = (date: string, time: string) => {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Y || 2000, (M || 1) - 1, D || 1, h || 0, m || 0);
};

export function BirthForm({ visible, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial.name ?? "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [lat, setLat] = useState<number | null>(initial.lat);
  const [lon, setLon] = useState<number | null>(initial.lon);
  const [tzOffset, setTzOffset] = useState<number | null>(initial.tzOffset);
  const [ianaTz, setIanaTz] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState(initial.placeLabel ?? "");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the draft each time the modal (re)opens.
  useEffect(() => {
    if (!visible) return;
    setName(initial.name ?? "");
    setDate(initial.date);
    setTime(initial.time);
    setLat(initial.lat);
    setLon(initial.lon);
    setTzOffset(initial.tzOffset);
    setIanaTz(null);
    setPlaceLabel(initial.placeLabel ?? "");
    setQuery("");
    setResults([]);
    setSearchError(null);
    setError(null);
  }, [visible, initial]);

  // Debounced place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const r = await searchPlaces(q);
        setResults(r);
        setSearchError(r.length === 0 ? "No matches — try a larger nearby city, or use Advanced." : null);
      } catch {
        setResults([]);
        setSearchError("Couldn't reach place search. Check your connection or use Advanced.");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query]);

  // Re-derive the offset if the date/time changes after a place was picked (DST varies by date).
  useEffect(() => {
    if (ianaTz) setTzOffset(offsetHoursAt(date, time, ianaTz));
  }, [date, time, ianaTz]);

  function pickPlace(p: PlaceResult) {
    setLat(p.lat);
    setLon(p.lon);
    setIanaTz(p.timezone);
    setPlaceLabel(p.label);
    setTzOffset(offsetHoursAt(date, time, p.timezone));
    setResults([]);
    setQuery("");
  }

  function onSavePress() {
    const res = validateBirth({ name, date, time, lat, lon, tzOffset, placeLabel });
    if (!res.ok) { setError(res.error); return; }
    onSave(res.birth);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Your birth</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="You" placeholderTextColor={NIGHT.textDim} />

            <Text style={styles.label}>Birth date</Text>
            <Pressable style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={styles.inputText}>{date}</Text>
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={strToDate(date, time)} mode="date" display="default"
                onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowDate(Platform.OS === "ios"); if (d) setDate(dateToStr(d)); }}
              />
            )}

            <Text style={styles.label}>Birth time</Text>
            <Pressable style={styles.input} onPress={() => setShowTime(true)}>
              <Text style={styles.inputText}>{time}</Text>
            </Pressable>
            {showTime && (
              <DateTimePicker
                value={strToDate(date, time)} mode="time" display="default"
                onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowTime(Platform.OS === "ios"); if (d) setTime(timeToStr(d)); }}
              />
            )}

            <Text style={styles.label}>Place</Text>
            {placeLabel ? (
              <Text style={styles.resolved}>📍 {placeLabel}{ianaTz ? `  ·  ${ianaTz}` : ""}</Text>
            ) : null}
            <TextInput style={styles.input} value={query} onChangeText={setQuery}
              placeholder="Search a city…" placeholderTextColor={NIGHT.textDim} autoCorrect={false} />
            {searching ? <ActivityIndicator color={NIGHT.live} style={styles.spinner} /> : null}
            {searchError ? <Text style={styles.hint}>{searchError}</Text> : null}
            {results.map((r, i) => (
              <Pressable key={`${r.lat},${r.lon},${i}`} style={styles.result} onPress={() => pickPlace(r)}>
                <Text style={styles.resultText}>{r.label}</Text>
              </Pressable>
            ))}

            <Pressable onPress={() => setAdvanced((a) => !a)} style={styles.advancedToggle}>
              <Text style={styles.advancedText}>{advanced ? "▾" : "▸"} Advanced (manual coordinates)</Text>
            </Pressable>
            {advanced ? (
              <View>
                <Text style={styles.label}>Latitude</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={lat === null ? "" : String(lat)}
                  onChangeText={(t) => setLat(t === "" || t === "-" ? null : Number(t))}
                  placeholder="-90 to 90" placeholderTextColor={NIGHT.textDim} />
                <Text style={styles.label}>Longitude</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={lon === null ? "" : String(lon)}
                  onChangeText={(t) => setLon(t === "" || t === "-" ? null : Number(t))}
                  placeholder="-180 to 180" placeholderTextColor={NIGHT.textDim} />
                <Text style={styles.label}>UTC offset (hours)</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={tzOffset === null ? "" : String(tzOffset)}
                  onChangeText={(t) => setTzOffset(t === "" || t === "-" ? null : Number(t))}
                  placeholder="e.g. -6 or 5.5" placeholderTextColor={NIGHT.textDim} />
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.save]} onPress={onSavePress}>
              <Text style={styles.btnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NIGHT.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, maxHeight: "88%" },
  scroll: { marginBottom: 12 },
  title: { color: NIGHT.text, fontSize: 20, fontWeight: "600", marginBottom: 10 },
  label: { color: NIGHT.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: NIGHT.text, fontSize: 16, justifyContent: "center" },
  inputText: { color: NIGHT.text, fontSize: 16 },
  resolved: { color: NIGHT.live, fontSize: 13, marginBottom: 6 },
  spinner: { marginVertical: 6 },
  hint: { color: NIGHT.textDim, fontSize: 13, marginTop: 6 },
  result: { paddingVertical: 10, paddingHorizontal: 8, borderBottomColor: NIGHT.border, borderBottomWidth: 1 },
  resultText: { color: NIGHT.text, fontSize: 15 },
  advancedToggle: { marginTop: 16, paddingVertical: 6 },
  advancedText: { color: NIGHT.textDim, fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  footer: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1 },
  save: { backgroundColor: NIGHT.border },
  btnText: { color: NIGHT.text, fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors. If `keyboardType="numbers-and-punctuation"` errors on a type, change those three to `keyboardType="default"` and re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/BirthForm.tsx
git commit -m "feat(mobile): BirthForm — modal with date/time pickers + geocoded place"
```

---

## Task 7: Wire `App.tsx`

**Files:** Modify `apps/mobile/App.tsx`

- [ ] **Step 1: Overwrite `App.tsx`**

```tsx
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { GLYPH_FONT } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { BirthForm } from "./components/BirthForm";
import { loadBirth, saveBirth } from "./lib/birthStore";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);

  // Load the saved birth on launch (falls back to DEFAULT_BIRTH).
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => { if (active && b) setBirth(b); });
    return () => { active = false; };
  }, []);

  const natalPos = useMemo(() => positions(birthInstant(birth)), [birth]);
  const [launchedAt] = useState(() => new Date());
  const livePos = useMemo(() => positions(launchedAt), [launchedAt]);

  const displayName = birth.name && birth.name !== "You" ? birth.name : "Your chart";

  function onSave(b: BirthData) {
    setBirth(b);
    saveBirth(b).catch(() => { /* local cache only; ignore write errors */ });
    setEditing(false);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
        <Text style={styles.editText}>{displayName}  ✎</Text>
      </Pressable>
      {fontsLoaded
        ? <ChartWheel natalPositions={natalPos} livePositions={livePos} />
        : <Text style={styles.note}>loading…</Text>}
      <BirthForm visible={editing} initial={birth} onSave={onSave} onCancel={() => setEditing(false)} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  editBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  editText: { color: NIGHT.live, fontSize: 15, letterSpacing: 1 },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire birth state + edit modal + local persistence"
```

---

## Task 8: Verify — tests + Android bundle + web render

**Files:** none (verification)

- [ ] **Step 1: Full mobile test + typecheck**

Run: `pnpm --filter @astro/mobile test && pnpm --filter @astro/mobile typecheck`
Expected: 7 tests pass; typecheck clean.

- [ ] **Step 2: Android bundle**

Run (in `apps/mobile/`): `npx expo export --platform android --output-dir /tmp/movestar-birthform-bundle`
Expected: bundles; no "Unable to resolve" for `@react-native-community/datetimepicker` or `@react-native-async-storage/async-storage`.

- [ ] **Step 3: Web-target render + geocode smoke test**

Run (in `apps/mobile/`, background): `npx expo start --web --port 8082`
Open `http://localhost:8082` with `/browse`. Tap **"Your chart ✎"** → the modal opens. Type a city (e.g. "London") → results list appears (proves Open-Meteo `fetch` works) → tap one → the 📍 confirmation line shows the place + timezone. Screenshot it. Stop the server.
(Note: native date/time pickers don't render on web — that's expected; verify the date/time *fields* show and the place search + save flow work. The pickers are verified on-device.)

- [ ] **Step 4: No commit (verification only).** Record results in the completion report.

---

## Task 9: Device hand-off

**Files:** none

- [ ] **Step 1: Present to the user**

> **Try it on your phone:** `cd ~/dev/astro-clock/apps/mobile && pnpm start`, scan the QR in Expo Go. Tap **"Your chart ✎"**, set your **birth date + time** (native pickers), search your **birthplace** and tap it, then **Save**. The outer ring should redraw to your chart. **Force-close and reopen** Expo Go → it should remember your birth. Tell me: did the date/time pickers work, did your city show up, and does the **derived timezone** look right (shown as 📍 place · Zone)? If the chart looks shifted by hours, open **Advanced** and set the UTC offset manually — that tells me Hermes' `Intl` needs the fallback.

- [ ] **Step 2: Stop and wait for the user to confirm on device.**
  - Timezone wrong on device → Hermes `Intl` issue: switch `offsetHoursAt` to a bundled-tz approach (add `@date-fns/tz` or equivalent) or default to the Advanced manual offset; commit.
  - Picker/geocode issues reported → address, commit, ask to reload.

---

## Self-Review

- **Spec coverage:** §1 goal (your own chart, persisted, geocoded, auto-tz) → Tasks 2–7. §2 Open-Meteo geocode → Task 4; tz via Intl → Task 2; native pickers → Task 6; AsyncStorage → Task 5; modal surface → Task 6/7; no auth → nothing added. §3.2 files (`timezone`, `birthValidation`, `geocode`, `birthStore`, `BirthForm`, `App`) → Tasks 2–7. §3.3 form fields → Task 6. §4 deps → Task 1. §5 verification (typecheck, unit tests, android export, web render) → Tasks 2/3/8; device → Task 9. §6 risks (Hermes Intl → Task 2 test + Task 9 fallback; geocode failure → Task 4 typed error + Task 6 states + Advanced; picker quirks → Task 6 Platform pattern). §7 out-of-scope items appear in no task. ✓
- **Placeholder scan:** none — every step has complete code/commands. Conditional fixes (Task 6 Step 2 keyboardType, Task 9 Step 2) are concrete, keyed to concrete observations.
- **Type/name consistency:** `BirthDraft`/`validateBirth`/`ValidationResult` defined Task 3, consumed in `BirthForm` (Task 6). `offsetHoursAt(date,time,iana)` defined Task 2, used in Task 6. `PlaceResult`/`searchPlaces` defined Task 4, used in Task 6. `loadBirth`/`saveBirth` defined Task 5, used in Task 7. `BirthForm` props `{visible, initial, onSave, onCancel}` (Task 6) match `App.tsx` usage (Task 7). `ChartWheel` props `natalPositions`/`livePositions` match Slice-1's component. `tzOffset` stored as total offset with `isDst:false` consistent across `validateBirth`, `birthInstant`, and the spec. `NIGHT` palette fields used in styles (`panel`, `bg`, `border`, `text`, `textDim`, `seclabel`, `live`) all exist on the engine's `Palette`.
