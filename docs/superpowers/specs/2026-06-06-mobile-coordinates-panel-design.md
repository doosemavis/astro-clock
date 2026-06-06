# Mobile Live Coordinates Panel — Design Spec (v1)

- **Date:** 2026-06-06
- **Branch:** `feat/mobile-coordinates-panel`
- **Platform:** mobile (Expo/RN, `apps/mobile`) only — v1
- **Status:** design approved; ready for implementation plan

## 1. Summary

A **Pro**, live-updating panel that slides out from the **left** of the chart screen, opened by a **round button** (mirroring the avatar button on the right). It shows two columns:

- **Fixed** = the **natal/birth layer** (the birth glyphs that have on/off toggles in settings).
- **Moveable** = the **live/transit layer** (the glyphs that move with the active View — Now ticks; Date/Range/Compare per their inputs).

Each column lists **all chart glyphs** with **sign + degree, Decan, Cusp, and Anaretic** status. The panel **reads the same positions the round wheel draws**, so the readouts always match the chart and update in real time.

The triangular **aspectarian ("Staircase")** + **modality × element table** are a planned **v2** — a disabled view-switch stub is included now so they drop in later. Not built in v1.

## 2. Goals / Non-goals

**Goals (v1)**
- Per-body coordinate readout split into **Fixed** (natal) vs **Moveable** (live), updating live.
- **Decan, Cusp, Anaretic** indicators per body.
- Consistent with the wheel (same positions); **Pro-gated**.

**Non-goals (deferred to v2+)**
- The Staircase aspectarian and the modality × element distribution table.
- Web parity (mobile only for now).
- New ephemeris bodies (Lilith, Chiron, Part of Fortune, Vertex, MC) — v1 uses the app's **existing glyph set only**.

## 3. Engine additions — `@astro/engine` (pure, unit-tested)

Pure functions of an ecliptic longitude (0–360°), so they're trivially testable and reusable by web later. They derive from the **same longitudes** the wheel renders → readouts match the wheel by construction.

- **`decanOf(lon): { decan: 1 | 2 | 3; ruler: PlanetKey }`**
  - `decan` = which 10° third of the sign (0–9.99° → 1, 10–19.99° → 2, 20–29.99° → 3).
  - `ruler` = the Hellenistic **face / Chaldean decan** ruler. The sequence cycles `[Mars, Sun, Venus, Mercury, Moon, Saturn, Jupiter]` continuously across all 36 decans, beginning at **Aries 1st decan = Mars** (e.g., Aries = Mars/Sun/Venus, Taurus = Mercury/Moon/Saturn, …). The full 36-entry table is encoded in the engine and pinned by a unit test.
- **`cuspOf(lon, orbDeg = 1): { onCusp: boolean; from: Sign; to: Sign } | null`**
  - `onCusp` is true when the body is within `orbDeg` (default **1°**) of a sign boundary; `from`/`to` are the two adjacent signs it straddles.
- **`isAnaretic(lon): boolean`**
  - true when `degInSign(lon)` ∈ [29, 30) — the final (anaretic) degree.

Reuses existing `signOf`, `degInSign`, `formatDMS`, `PLANET_KEYS`, and the sign/planet glyphs.

## 4. Data flow

- **Source:** the app's existing **Natal layer** (Fixed) and **Live layer** (Moveable) positions from the chart model — the same reactive state the wheel consumes. **No chart recompute.**
- The panel subscribes to that state, so it re-renders on the live tick (Now) and on View input changes (Date/Range/Compare).
- Per glyph: `{ key, lon }` → `signOf` / `degInSign` / `formatDMS` / `decanOf` / `cuspOf` / `isAnaretic` → one row.

## 5. UI (`apps/mobile`)

Small, focused components:
- **`CoordinatesButton`** — a round button on the **left** edge, mirroring the `Avatar` button. Pro-gated.
- **`CoordinatesPanel`** — a **left slide-out** (Modal + animated `translateX` + dimmed backdrop), same family as the existing menu/sheet. Header: title + a **view-switch stub** (Coordinates / Staircase — Staircase **disabled** in v1). Body: the two columns.
- **`CoordinateColumn`** / **`CoordinateRow`** — column header (Fixed / Moveable) + a vertical list; each row = glyph · `sign°deg` · decan (e.g., "2nd · ☿") · Cusp / Anaretic badges.
- Styling reuses the theme palette + glyph font.

## 6. Gating & empty states

- **Pro-gated (D3):** the round button is **always visible**; tapping it when not-Pro calls the existing `presentProPaywall` (same pattern as locked modes).
- **No birth set:** the **Fixed** column shows a "Set your birth details" placeholder; the **Moveable** column always has live data.

## 7. Testing

- **Unit (engine):** `decanOf` / `cuspOf` / `isAnaretic` against known longitudes including boundary cases (0°, 9.99°, 10°, 19.99°, 20°, 29°, 29.99°) and a spot-check of the 36-decan ruler table. Target 80%+.
- **UI:** verified via render on the emulator (the app's convention for view code).

## 8. Accuracy note

The engine is Schlyter's low-precision ephemeris (~arc-minute Sun/Moon, ~0.01–0.05° planets, 1900–2100). Signs (30° wide) and decans (10°) are never at risk. **Cusp and Anaretic are boundary-sensitive** — a body parked at exactly 29°59'/0°00' could rarely flip due to the ~0.05° planet error. Acceptable for v1; the documented `astronomy-engine` upgrade path tightens it if ever needed. (Pluto is the least precise body.)

## 9. Deferred (v2+)

- **Staircase** view: the triangular aspectarian (reusing `findAspects`) + the **modality × element** tally table — wired into the view-switch stub. (Approach ① "hybrid fit-to-width grid" is the intended rendering.)
- Web parity.
- Extra ephemeris bodies.

## Decisions (locked)

- **D1 — Decan:** show decan number **and** ruler, via the Hellenistic-faces / Chaldean decan table above.
- **D2 — Cusp orb:** within **1°** of a sign boundary counts as "on the cusp."
- **D3 — Gating:** round button always visible; **paywall-on-tap** for non-Pro.
