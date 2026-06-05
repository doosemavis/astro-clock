# Save Chart to Photos — Design Spec

**Date:** 2026-06-05
**Project:** MoveStar (astro-clock) — Android mobile app (`apps/mobile`)
**Status:** Approved (brainstorm) — pending implementation plan
**Target branch:** ships in the `goog_` production build (feature + real billing in one AAB)

## 1. Goal

Let users save their chart as an image to their device **Photos**. This is both a
**growth hook** (shared charts market the app) and a **Pro perk**. Free/anonymous users
get a **branded share card**; Pro users get a **clean, watermark-free full-screen export**
plus a native **Share** action.

## 2. Tiers & gating

| View | anonymous | free | pro |
|---|---|---|---|
| Now (live sky) | Save (branded) | Save (branded) | Save (clean) + **Share** |
| Birth | — (no chart) | Save (branded) | Save (clean) + **Share** |
| Date / Range / Compare | — | — | Save (clean) + **Share** |

- **Save to Photos:** all tiers, for any view they can access.
- **Share (system share sheet): Pro only.**
- **Framing:** branded card for anonymous + free; clean for pro.
- Date/Range/Compare are already Pro-only views (`proMode.PRO_MODES`), so saving them is
  inherently Pro — no extra gate needed beyond the existing mode access.

## 3. Composition

A dedicated, **off-screen `ExportCard`** renders the image at a fixed resolution. Rendering
a purpose-built card (rather than screenshotting the live screen) means the output is
identical on every phone and excludes live UI chrome by construction.

```
   FREE / ANON — Branded Share Card        PRO — Clean full-screen
┌──────────────────────────┐          ┌──────────────────────────┐
│       M O V E S T A R     │          │ ·   *      ·      *   ·   │
│        .-"""""-.          │          │       .-"""""-.          │
│       / (S) (M) \         │          │      / (S) (M) \         │
│      |    asc    |        │          │     |    asc    |        │  no avatar,
│       '-.....-'           │          │      '-.....-'           │  no sheet,
│  (S) Leo (M) Aries ^ Lib  │          │  (S) Leo (M) Aries ^ Lib  │  no HUD,
│  Born Jul 29, 1992        │          │  Jul 29, 1992            │  no watermark
│  Jonesboro, AR            │          │ ·      *      ·     *  ·  │
│       movestar.app        │          └──────────────────────────┘
└──────────────────────────┘
```

- **Branded card (free/anon):** cosmic/themed background, chart centered, **MoveStar
  wordmark** (top), Sun/Moon/Rising caption, date/time, place label, `movestar.app` footer.
  Branding is **non-removable** on this tier.
- **Clean (pro):** full-bleed themed background, chart, **no** avatar / bottom sheet / HUD /
  watermark. Overlay elements still obey the user's toggles.
- Both mirror the planets/aspects currently visible on the live wheel (Compare view exports
  both charts).

## 4. "Saved image" settings

A new **Saved image** section (in the bottom-sheet `ChartControls`) with four switches,
persisted to AsyncStorage under `movestar.exportSettings.v1`:

| Toggle | Default |
|---|---|
| Sun/Moon/Rising caption | on |
| Date & time | on |
| Place / chart label | on |
| Cosmic background (vs. solid theme color) | on |

These control overlay presence in the export for **both** tiers. (Place label is a toggle
specifically so users can omit their birth location when sharing publicly.)

## 5. Architecture (small, isolated units)

- `components/export/ExportCard.tsx` — **pure presentational** render of the composed image
  (props: chart positions, tier, toggles, theme, captions). Wrapped in a capture ref.
- `lib/exportPolicy.ts` — **pure**: `framingFor(tier)` → `"branded" | "clean"`,
  `canSave(tier, mode)`, `canShare(tier)`. Unit-tested like `proMode.ts`.
- `lib/exportSettings.ts` — toggle-state shape + AsyncStorage load/save. Unit-tested
  round-trip; key `movestar.exportSettings.v1`.
- `lib/saveChart.ts` — orchestration: `captureRef(ExportCard)` (react-native-view-shot) →
  request + check `expo-media-library` permission → `saveToLibraryAsync`. Returns a result
  union (`{ ok: true } | { ok: false; reason }`). Pro Share: `expo-sharing.shareAsync(uri)`.
- **UI wiring:** `HeaderMenu` gains "Save to Photos" (all tiers) and "Share…" (pro only);
  `ChartControls` gains the "Saved image" toggle section; `App.tsx` hosts the off-screen
  `ExportCard` and the save/share handlers.

## 6. Data flow

1. Tap **Save** → resolve `tier` + toggle settings → mount `ExportCard` off-screen with the
   current chart data + framing → `captureRef` → `expo-media-library` save → toast
   **"Saved to Photos ✓"**.
2. Tap **Share** (pro) → capture → `expo-sharing.shareAsync(uri)` (native sheet).

## 7. Dependencies (to add)

- `react-native-view-shot` — view → image capture.
- `expo-media-library` — save to Photos.
- `expo-sharing` — Pro Share.

All are Expo config-plugin compatible and require a dev/EAS build (already the workflow —
not Expo Go).

## 8. Permissions & Data safety

Android gains a **media-write** permission (the `expo-media-library` config plugin manages
the manifest entry and the runtime request; Android 13+ generally does not prompt for
app-created media). **The Google Play Data safety declaration does NOT change** — saving a
user's own generated image to their own Photos is neither collection nor sharing of user
data. No new data type to declare. (This is consistent with the form locked on 2026-06-05.)

## 9. Error handling

- **Permission denied** → non-blocking message: "Allow photo access in Settings to save
  charts," with a deep-link to system settings. Never crash.
- **Capture / save failure** → error toast; the app stays usable.
- **Share canceled by the user** → silent (not an error).

## 10. Testing (TDD)

Pure units get tests first:

- `exportPolicy` — framing per tier; `canSave`/`canShare` gating across tier × mode.
- `exportSettings` — defaults, toggling, AsyncStorage round-trip.
- `ExportCard` — renders without crashing for each tier × toggle combination (smoke).

Native capture/save/share is verified by an **on-device acceptance pass** (license-tester
device): grant- and deny-permission paths; Birth + Now (free, branded) and
Date/Range/Compare (pro, clean + Share). **Visual layout tuning of the cards is done during
this pass** and iterated — the exact look is judged on-device, per stakeholder.

## 11. Out of scope / future

- **iOS** (Android-first; the same `ExportCard` reused later for iOS save/share).
- Custom backgrounds/stickers, multi-chart collages, in-app social posting.
- Server-side anything — this feature is entirely on-device (no new data leaves the phone),
  so it is independent of the deferred birth-chart sync work.
