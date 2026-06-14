# Design Spec — Theme options, header swap & Now-header fix

**Date:** 2026-06-14
**Status:** Approved
**Branch:** `feat/mobile-theme-header` (stacked on `feat/mobile-signin-quick-wins` / PR #11) → one combined PR
**Package:** `@astro/mobile` (`apps/mobile`)

## Context

Round-2 polish: tester suggestion **#3 (theme options)** plus a UX cleanup and the **#4 Now-header sign bug** the user flagged. Delivered together in one PR.

## Parts

### A. Header buttons — make the icons intuitive (icon↔role swap)

Today (`apps/mobile/App.tsx` header, ~lines 237–242):
- Top button = `<Avatar glyph={sunGlyph}/>` → opens the **menu** (`setMenuOpen`)
- Bottom button = `<CoordinatesButton/>` (circle + 3 lines, ☰) → opens **Coordinates**

Target:
- **Top = ☰ hamburger → opens the settings/account menu**
- **Bottom = sun-sign glyph → opens the Coordinates chart**

Implementation: the ☰ icon component is generic, so **rename `components/CoordinatesButton.tsx` → `components/MenuButton.tsx`** (component `MenuButton`, same circle + 3-line rendering) and wire it to `setMenuOpen`. The bottom button becomes `<Pressable onPress={coordsHandler}><Avatar glyph={sunGlyph}/></Pressable>`, preserving the existing anonymous→sign-in gate (`if (anonymous) setAuthView("login"); else setCoordsOpen(v=>!v)`). Positions stay; icons + roles swap.

### B. Theme control moves into the ☰ menu

- Add a **"Theme" row** to `components/HeaderMenu.tsx` with a **Light / Dark / System** segmented control, reusing the existing `Segmented` component (from `ChartControls`). Place it after the auth/edit-birth items, before the Save-to-Photos block.
- Plumb `themeMode` + `onTheme` props from `App.tsx` into `HeaderMenu`.
- **Remove** the Theme `<Section>` from the bottom sheet (`ChartControls`) and its now-unused `themeMode`/`onTheme` props + `THEMES` const.
- Available to **all** users (not gated) — it's an app setting.

### C. `"auto"` → `"system"` (follows the OS)

- Change `ThemeMode` in `lib/chartModel.ts` from `"light" | "dark" | "auto"` to `"light" | "dark" | "system"`.
- New pure helper (testable) — `lib/themeMode.ts`:
  ```ts
  import type { ThemeMode } from "./chartModel.ts";
  /** Base day/night value for a mode: dark=0, light=1, system follows the OS scheme. */
  export function themeTForMode(mode: ThemeMode, systemPrefersDark: boolean): number {
    if (mode === "light") return 1;
    if (mode === "dark") return 0;
    return systemPrefersDark ? 0 : 1; // system
  }
  ```
- In `App.tsx`, replace the solar-blend `themeT` (current lines ~192–198) with `themeTForMode(themeMode, useColorScheme() === "dark")`. **Removes the old solar day/night blend** (the previous "auto"). `useColorScheme()` updates live when the OS flips, re-rendering the palette.

### D. Persist the theme

- New `lib/themeStorage.ts` mirroring `lib/exportSettings.ts`'s AsyncStorage pattern: `loadThemeMode(): Promise<ThemeMode>` and `saveThemeMode(mode): Promise<void>`, with a pure `parseThemeMode(raw: string | null): ThemeMode` (defaults to `"system"`, validates against the 3 valid values).
- `App.tsx`: initialize `themeMode` from `loadThemeMode()` on mount (like `loadExportSettings`); call `saveThemeMode` whenever it changes.

### E. Now-header fix (#4) — displayed-moment + no placeholder leak

Current `bigThree` (`App.tsx` ~203–211): anonymous → `livePos` (2-part); signed-in → `natalPos` (3-part) — which shows the **birth** chart's signs (and the default 1992 "Leo" chart before real birth loads).

Target: the header reflects the **currently displayed chart's moment**.
- Sun/Moon from `positions(clock.displayInstant)` (= `livePos`) for all modes — Now → live sky, Birth → natal (displayInstant = birth), Date → that date.
- Ascendant computed at `clock.displayInstant` + chart location (`birth.lat/lon`).
- **Placeholder guard:** add a `birthLoaded` flag (false until `loadBirth()` resolves for signed-in users). Show the ascendant/natal-derived parts only when `birthLoaded`; before that, show live Sun/Moon only (no ascendant) so the default 1992 chart never appears.
- Extract a pure formatter (testable) — `lib/bigThree.ts`:
  ```ts
  /** Header label. Ascendant shown only when an ascendant sign is provided. */
  export function bigThreeLabel(sun: string, moon: string, asc: string | null): string {
    const base = `☉ ${sun}   ☽ ${moon}`;
    return asc ? `${base}   ↑ ${asc}` : base;
  }
  ```
  `App.tsx` passes `asc = (!anonymous && birthLoaded) ? signOf(ascendant(clock.displayInstant, birth.lat, birth.lon)) : null`.

## Testing

Repo convention: pure logic in `lib/*.test.ts` via `node --test`; UI verified manually on the emulator (dev loop running).

**Automated (new):**
- `lib/themeMode.test.ts` — `themeTForMode`: light→1, dark→0, system+dark→0, system+light→1.
- `lib/themeStorage.test.ts` — `parseThemeMode`: valid values pass; null/garbage → default `"system"`.
- `lib/bigThree.test.ts` — `bigThreeLabel`: with/without ascendant.

**Manual (emulator):**
- Header: ☰ (top) opens the menu; sun glyph (bottom) opens Coordinates; anonymous glyph still routes to sign-in.
- Theme: Light/Dark/System in the menu changes the palette immediately; System follows the OS toggle; choice persists across a full relaunch; theme segment gone from the bottom sheet.
- Now-header: shows live signs on Now (Gemini today), natal on Birth; never shows the default 1992 (Leo) chart before birth loads.

## Out of scope
- Moving the per-chart display controls (aspects, glyphs, time format) out of the bottom sheet — they stay.
- Keeping the old solar day/night "auto" blend — intentionally removed.
