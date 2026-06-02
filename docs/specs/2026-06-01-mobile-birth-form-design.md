# Mobile App — Slice 2: Birth Form (Design)

**Date:** 2026-06-01
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Part of:** the MoveStar Android app build. Builds on Slice 1 (chart wheel). Turns the app
from a fixed sample chart into *your* chart. No auth (local-only, like the web logged-out).

---

## 1. Goal

Let the user enter their own birth — name, date, time, and **place** — so the chart wheel
renders *their* natal chart instead of the sample `DEFAULT_BIRTH`. The birth is persisted on
the device and reloaded on launch. Location uses **online geocoding** so anyone worldwide can
find their birthplace, and the **timezone is derived automatically** (no manual UTC-offset/DST
entry — a UX win over the web form). The free chart still works with no account.

## 2. Decisions (locked)

- **Geocoding:** **Open-Meteo Geocoding API** (`https://geocoding-api.open-meteo.com/v1/search`)
  — free, **no API key**, CORS-friendly, returns `{name, country, admin1, latitude, longitude,
  timezone}` (IANA tz). Queried with built-in `fetch`. No key/secret to manage.
- **Timezone:** derived from the geocoded **IANA timezone** + the birth date via `Intl`
  (handles historical DST). Stored into the engine's `BirthData` as `tzOffset =` the **total
  offset hours at the birth instant**, `isDst = false` (the engine only needs the total offset:
  `birthInstant` computes `tzOffset + (isDst?1:0)`). **Risk:** Hermes `Intl` timezone support
  — verified on-device; fallback is the manual-offset control in the form's advanced section.
- **Date/time entry:** native pickers via `@react-native-community/datetimepicker`.
- **Persistence:** `@react-native-async-storage/async-storage` — local only, no account.
- **Form surface:** a `Modal` over the wheel, opened by an **"✎ Edit birth"** control near the
  brand/name. (No navigation library yet — YAGNI until multiple screens.)
- **No auth / no cloud sync** in this slice (that's a later slice). One birth chart only.

## 3. Architecture

### 3.1 Data flow

```
launch ─> birthStore.load() ─> birth state (or DEFAULT_BIRTH)
                                   │
   ✎ Edit ─> BirthForm modal (prefilled from birth)
       │  type place ─> geocode.search(q) ─> pick result ─> {lat, lon, ianaTz, placeLabel}
       │  pick date + time (native pickers)
       └─ Save ─> tzOffset = timezone.offsetHoursAt(date, time, ianaTz)
                  birth' = {name, date, time, tzOffset, isDst:false, lat, lon, placeLabel}
                  birthStore.save(birth') ; setBirth(birth') ; close modal
                                   │
   birth state ─> natalPos = positions(birthInstant(birth)) ─> ChartWheel outer ring updates
```

The inner "now" ring (`livePos`) is unchanged. Only the natal (outer) ring + the brand name
reflect the entered birth.

### 3.2 Files (new, `apps/mobile/`)

- **`lib/geocode.ts`** — `searchPlaces(query: string): Promise<PlaceResult[]>`. Hits Open-Meteo,
  maps results to `PlaceResult { label, lat, lon, timezone }` where `label` = "City, Admin1,
  Country". Returns `[]` on no match; throws a typed error on network failure (caller shows it).
- **`lib/timezone.ts`** — `offsetHoursAt(date: string, time: string, ianaTz: string): number`.
  Uses `Intl.DateTimeFormat(..., { timeZone, ... }).formatToParts` to compute the total UTC
  offset (in hours, fractional ok for +5.5 etc.) at the birth instant. Pure, no network.
- **`lib/birthStore.ts`** — `loadBirth(): Promise<BirthData | null>` and
  `saveBirth(b: BirthData): Promise<void>` over AsyncStorage (one key, JSON). Validates the
  parsed shape; returns `null` on missing/corrupt so the app falls back to `DEFAULT_BIRTH`.
- **`lib/birthValidation.ts`** — `validateBirth(draft): { ok: true, birth } | { ok:false, error }`.
  Required date/time, lat ∈ [-90,90], lon ∈ [-180,180]; builds the final `BirthData`.
- **`components/BirthForm.tsx`** — the modal form: name, date+time pickers, place search +
  results list + resolved-location line, an "Advanced" disclosure (manual lat/lon + offset
  stepper for offline/unlisted), Save/Cancel. Owns local draft state; calls `onSave(birth)`.
- **`App.tsx`** (modify) — holds `birth` state, loads on mount, renders the "✎ Edit birth"
  control + `<BirthForm>` modal, passes `natalPos` (from `birth`) to `<ChartWheel>`.

### 3.3 The form (`BirthForm.tsx`)

Fields, top to bottom: **Name** (optional) · **Birth date** (native picker) · **Birth time**
(native picker) · **Place** (search input → tappable results → confirmation line showing the
resolved place + timezone) · **Advanced ▸** (manual latitude, longitude, and a UTC-offset
stepper — only needed offline or for unlisted places). Footer: **Cancel** / **Save**. Save is
disabled until date, time, and a valid location are present. Place search debounces input
(~400 ms) and shows a spinner / "no results" / "couldn't reach geocoder — enter coordinates
manually" states.

## 4. Dependencies added

- `@react-native-community/datetimepicker` — `npx expo install` (SDK-54 aligned).
- `@react-native-async-storage/async-storage` — `npx expo install`.
- Geocoding: built-in `fetch` (no dependency).

## 5. Verification

**What I verify here (no device):**
1. `apps/mobile` typechecks.
2. `lib/timezone.ts` and `lib/birthValidation.ts` get **unit tests** (pure functions — e.g.
   `offsetHoursAt("1992-07-29","14:28","America/Chicago")` ≈ `-5` (CDT); a winter date ≈ `-6`;
   `"Asia/Kolkata"` ≈ `+5.5`; validation rejects out-of-range coords). Run under the existing
   node test runner.
3. `npx expo export --platform android` bundles (Metro resolves the new native modules).
4. Web-target render of the form + a live geocode search (Open-Meteo works from `fetch`); a
   `/browse` screenshot confirms the form + results list.

**What the user verifies on-device:** open "✎ Edit birth", search their birthplace, pick date
+ time, Save → the outer ring redraws to their chart; relaunch → it persists. Confirm the
derived timezone looks right (Hermes `Intl` check) — if the offset is wrong, use the Advanced
manual offset.

## 6. Risks + fallbacks

- **Hermes `Intl` timezone support** for `offsetHoursAt`. Mitigation: unit-test the logic;
  verify a known birth on-device; the Advanced manual-offset control is the fallback if `Intl`
  returns wrong/zero offsets on Android.
- **Geocoder network failure / rate limits.** Mitigation: typed errors + retry + the manual
  lat/lon + offset fallback; debounce to stay light on the free endpoint.
- **Native datetimepicker platform quirks** (Android opens a dialog; iOS inline). Mitigation:
  use the community module's documented per-platform pattern; verify on-device.
- **Unknown birth time.** Out of scope this slice; the field is required (sun/moon signs are
  robust; ascendant/houses need the time). Noted for a later "unknown time" enhancement.

## 7. Out of scope (later slices)

Cloud sync of the birth (auth slice), multiple saved people/charts, "unknown birth time"
handling, the live ring animation + the Now/Date/Range/Compare views + settings, subscriptions,
the store build.
