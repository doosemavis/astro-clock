# Improved Play Store Screenshots — Design Spec (MoveStar)

**Date:** 2026-06-15 · **Branch:** feat/mobile-theme-header · **Status:** approved — sample data (no PII) added; proceeding to implementation plan

**Goal:** Produce a fresh set of 6 captioned, dark-theme phone screenshots for the MoveStar Google Play listing that maximize install conversion by front-loading the app's unique differentiators (real-time sky, time-travel, compare).

**Why this matters (ASO framing):** Play Store screenshots are **not** keyword-indexed, so they don't directly affect search ranking. They drive **conversion rate** (views → installs), which *is* a ranking signal. Every choice below optimizes persuasion, not keywords. The text fields (title/short/full description) carry the keyword load — see `docs/store/2026-06-14-play-store-aso.md`.

---

## Locked decisions

| Dimension | Choice | Rationale |
|---|---|---|
| **Style** | Captioned, **frameless** (no phone mockup) | Benefit headlines out-convert raw screens; first 2–3 thumbnails decide it. No frame = the chart wheel (the product) renders as large as possible. |
| **Theme** | **Dark** throughout | Category convention (Co–Star, TimePassages); the starfield + glowing wheel pop on dark; matches the night-sky subject. |
| **Set** | **Core 6** | Lands all differentiators (live + time-travel + compare) that separate us from static-horoscope competitors. Full 8 has weak hooks; Lean 4 drops differentiation. |
| **Output** | 6 × `1080 × 1920` PNG (9:16) | Within Play phone spec; we control exact size regardless of the device's native 20:9 ratio. |

### Screenshot set — order, source screen, caption

Order is the biggest conversion lever; #1 does the most work, so it leads with the unique hook.

| # | Source screen | Headline (≤ ~5 words) | Optional subline |
|---|---|---|---|
| 1 | **Now** (real-time sky) | The live sky, right now | Planets moving in real time |
| 2 | **Birth chart** (natal wheel) | Your birth chart in seconds | Sun, Moon & Rising |
| 3 | **Date** (time-travel) | Travel to any date | Past or future |
| 4 | **Range** (mid-animation) | Watch the planets move | — |
| 5 | **Compare** (two wheels) | Compare any two charts | — |
| 6 | **Save-as-wallpaper** (export image) | Save your chart as wallpaper | — |

**Accuracy guardrails (must hold — same as the ASO doc):**
- Shot 6 says **"Save your chart as wallpaper"** (a static saved image). Do **not** say "live/animated wallpaper" — that's a deferred feature (`live-wallpaper-pro-feature`).
- No caption claims daily "readings/horoscope interpretations" (Readings tab hidden this release) or "share to social" (Share disabled).
- Shots 3–5 are Pro features; advertising them is fine and standard. No accuracy issue.

---

## Sample data (no PII)

Every shot uses a **randomly chosen sample** date/time inside **[2000-01-01 … 2026-06-15]** (plus a neutral world city for any birth chart) — **never the user's real birth data**. Before capturing, **clear/replace any saved birth profile** on the device so nothing personal can leak. The three sky-motion shots are **anonymous** (no birth profile at all); birth charts with sample data appear only where they're the selling point.

| # | Shot | Birth profile shown? | Sample date · time · place |
|---|---|---|---|
| 1 | Now (live sky) | No — anonymous live sky | viewing instant = live "now" (today's date; not PII) |
| 2 | Birth chart | Yes | **2003-11-14 · 08:42 · Auckland, NZ** |
| 3 | Date (time-travel) | No — anonymous transit sky | target = **2017-03-21 · 14:05** |
| 4 | Range (animation) | No — anonymous transit sky | range = **2008-06-01 → 2008-09-01** |
| 5 | Compare (A vs B) | Yes ×2 | A **2001-02-09 · 23:17 · Lisbon, PT** · B **2019-08-30 · 06:50 · Tokyo, JP** |
| 6 | Wallpaper export | Yes | **2012-07-04 · 17:33 · Reykjavík, IS** |

All dates fall inside the allowed window; times and places are arbitrary stand-ins, trivially swapped (they're just app inputs).

---

## Canvas & layout (per screenshot)

A single fixed composition, parameterized only by background screenshot + caption text:

```
1080 × 1920 canvas (9:16), 24-bit PNG, dark cosmic gradient fill
┌──────────────────────────────┐  ▲
│                              │  │  caption band  (top ~420px)
│      THE LIVE SKY,           │  │  • headline: bold, ~64px, light (#F5F3FF)
│      RIGHT NOW               │  │  • subline:  ~32px, dimmed (#A9A4C9), optional
│   Planets moving in real time│  │  • centered, generous margins
│                              │  ▼
│   ╭────────────────────╮     │  ▲
│   │                    │     │  │  screenshot card (lower ~1500px)
│   │   [ app screen ]   │     │  │  • the raw capture, scaled to card width
│   │      chart wheel   │     │  │    (~940px) with side margins showing bg
│   │                    │     │  │  • rounded corners (~36px), soft shadow
│   │                    │     │  │  • top-aligned; overflow clipped at the
│   ╰────────────────────╯     │  │    canvas bottom (chrome/controls may crop)
└──────────────────────────────┘  ▼
```

- **Background:** vertical gradient from deep indigo (`#0B0A1F`) to near-black (`#05040E`), matching the app's dark palette, with a faint static starfield (low-opacity dots). Consistent across all 6 for a cohesive gallery.
- **Caption band:** top ~22% of the canvas. Each shot stacks a small tracked-uppercase **eyebrow** → **headline** → optional **subline** (see *Art direction*). Headline + eyebrow always present; subline only where the table specifies one.
- **Screenshot card:** the captured app screen, scaled to ~940px wide (centered), top-aligned in the lower region, rounded corners + subtle shadow, bottom cropped by the canvas edge. Per-shot vertical crop is tuned so the hero element (wheel / picker / controls) stays visible — e.g. shot 4 keeps the Range play controls; shot 3 keeps the date picker.
- **Typography:** editorial pairing — elegant display **serif** for headlines + clean sans for sublines/eyebrow, loaded at render time (see *Art direction*).

---

## Art direction (the bar: beautiful + artistically informed)

The set must feel like a premium, designed gallery — not flat screenshots with text laid over them. A browser should feel pulled in to learn more. Non-negotiable principles:

1. **One continuous cosmic backdrop across all 6.** Not six separate gradients — a single layered nebula scene that drifts shot-to-shot, so the gallery reads as one connected story when scanned as a row. Layers: deep-indigo→black base gradient (`#0B0A1F`→`#05040E`) + an off-center violet/blue nebula bloom (repositioned per shot to create the pan) + a fine multi-size starfield with a few haloed "hero" stars.
2. **The wheel is a luminous hero.** A soft radial glow sits behind the screenshot so the chart feels lit from within. The screenshot is a **floating** rounded card (radius ~36px, soft drop shadow, faint 1px inner border) with real depth — never pasted flat.
3. **Editorial typography.** Display **serif** for headlines (celestial/luxury — Playfair Display / Cormorant family, via Google Fonts at render time) + clean geometric sans for sublines. A small tracked-uppercase **eyebrow** above each headline (`REAL-TIME`, `YOUR CHART`, `TIME TRAVEL`, `IN MOTION`, `COMPARE`, `KEEP IT`). Tight kerning, rule-of-thirds placement, generous negative space.
4. **One warm accent — champagne gold** (`#E9C46A`), used sparingly (eyebrow, a short underline rule, or a single glyph) against the cool indigo — the classic celestial-luxury contrast. Never more than one accent moment per shot. (Easiest single thing to flip to cool-violet after the hero shot.)
5. **Motion cues on the animation shots (3, 4).** Faint dotted orbital arcs / a soft comet trail drawn into the composition so "Travel to any date" and "Watch the planets move" feel kinetic even as stills.
6. **Strict rhythm & cohesion.** Identical caption zone, card placement, and margins on every shot; consistent color temperature; the eyebrow→headline→subline stack repeats. The set scans as one art-directed system.

**Approve pixels, not prose:** render **shot #1 (the hero) first**, iterate the art direction on that single frame until it's genuinely beautiful and the user signs off, *then* batch-produce the remaining 5 against the locked look. This is the gate that guarantees "looks nice."

---

## Production architecture

Three stages: **capture → author → render**. Source of truth lives in `docs/store/screenshots/`; final PNGs are reproducible from it.

```
docs/store/screenshots/
  captions.json        # the 6 shots: id, raw filename, headline, subline?, cropTop?
  frame.html           # the 1080×1920 captioned template (reads captions.json)
  starfield.css        # (optional) extracted background styling
  raw/                 # captured device PNGs (1080×2400) — git-ignored or committed small
    01-now.png …
  final/               # composed 1080×1920 PNGs ready to upload
    01-now.png …
```

**Stage 1 — Capture (emulator + adb).**
- Prereq: Pixel_7 dev build running with Metro, **Pro force-enabled** (`DEV_FORCE_PRO`), per `mobile-android-dev-build`. `adb` at `$ANDROID_HOME/platform-tools/adb`.
- Drive the app to each state (Now → Birth → Date → Range mid-play → Compare → exported wallpaper), capturing each with:
  `"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/0N-<id>.png`
- Use the **sample profiles** in *Sample data (no PII)* — never the user's saved birth data. **Clear/replace any real profile on the device before capturing**; the anonymous shots (1, 3, 4) show no saved birth at all.

**Stage 2 — Author captions.** `captions.json` holds the 6 entries (headline + optional subline + crop hint) from the table above. Editing copy = edit JSON, never the template.

**Stage 3 — Render.** `frame.html` composes one captioned canvas from a shot id, applying the full *Art direction* (layered nebula background via CSS gradients/SVG, glow + floating card, serif/sans + gold via Google Fonts). **Render the hero shot (#1) first and get sign-off** before producing the rest. Render each to PNG via the **Playwright MCP browser** at a `1080 × 1920` viewport (devicePixelRatio 1), screenshotting the viewport to `final/0N-<id>.png`. No new npm dependency — the MCP browser already exists and has the network access to pull the fonts; the HTML+JSON are the reproducible source so the set can be re-rendered anytime.

---

## Verification (this is an asset deliverable — no unit logic)

For each of the 6 final PNGs:
- [ ] Exactly `1080 × 1920`, 24-bit PNG, < 8 MB (Play limit).
- [ ] Headline legible at thumbnail scale (~160px wide preview).
- [ ] Hero element (wheel/picker/controls) visible, not cropped away.
- [ ] No real PII — birth shot shows sample data only.
- [ ] Caption matches the accuracy guardrails (no live-wallpaper / readings / social-share claims).
- [ ] Shot 6 reflects the updated watermark (`MOVESTAR` wordmark + `Live Birth Chart` tagline).

**Art-direction quality gate:**
- [ ] **Hero shot #1 rendered first and signed off** before the other 5 are produced.
- [ ] Background is the layered nebula (gradient + bloom + starfield), and **pans continuously** across the 6 — not six flat fills.
- [ ] Each shot shows the eyebrow→headline→subline stack in the serif/sans pairing; gold accent appears **exactly once**.
- [ ] Wheel reads as a luminous, floating card (glow + shadow + depth), not pasted flat.
- [ ] Animation shots (3, 4) carry the motion-cue arcs/trail.
- [ ] Gallery reads cohesively as one art-directed system (shared backdrop, identical caption zone + card placement + margins).

---

## Out of scope (this spec)
- Feature graphic (1024×500 banner), tablet/7"/10" screenshots, promo video — separate deliverables.
- Localized captions (English only for now).
- True animated **live** wallpaper (deferred Pro feature).
- Uploading to Play Console (manual step the user performs with the final PNGs).

## Dependencies & sequencing
- Requires the emulator running with **Pro force-enabled** — this is why `DEV_FORCE_PRO` is intentionally still on.
- **After** screenshots are captured, **revert `DEV_FORCE_PRO`** in `apps/mobile/hooks/useEntitlement.ts` before any commit/PR (tracked as task #30).
- Watermark change (`ExportCard.tsx`, this branch) feeds shot 6.
