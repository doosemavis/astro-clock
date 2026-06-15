# Improved Play Store Screenshots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 6 art-directed, captioned, 1080×1920 dark-theme Play Store screenshots for MoveStar, with the hero shot approved before the rest are mass-produced.

**Architecture:** An HTML/CSS composition template (`frame.html` + `captions.js`) renders each shot from (a) a raw app screenshot captured off the Pixel_7 emulator via `adb` and (b) caption + art-direction data. **Headless Google Chrome** (`--screenshot`, `--force-device-scale-factor=1`) renders each composed frame to an exact 1080×1920 PNG. No new npm dependency.

**Tech Stack:** HTML/CSS (CSS gradients + SVG for the nebula/starfield/motion arcs, Google Fonts for the serif/sans pairing), **headless Google Chrome** (`--screenshot` CLI) for rendering, `adb` for capture, `sips` (macOS, preinstalled) for dimension verification.

> **Renderer note (env reality):** the Playwright MCP browser needs a bridge extension that isn't installed here, so rendering uses **headless Chrome** — identical artifact, verified to output exact 1080×1920 (no DPR normalization needed).

**Spec:** `docs/superpowers/specs/2026-06-15-mobile-play-store-screenshots-design.md` (read it first).

**This is an asset-production pipeline, not unit-testable logic.** "Tests" here = dimension checks (`sips`) + the art-direction visual gate from the spec. Each task still has a concrete verification step.

---

## File structure

```
docs/store/screenshots/
  .gitignore           # ignores raw/ (large device captures); final/ + template are committed
  frame.html           # the 1080×1920 composition template (reads ?shot=<id> + window.SHOTS)
  captions.js          # window.SHOTS: the 6 shots' caption + art-direction data (synthetic sample dates)
  raw/                 # captured device PNGs (1080×2400) — git-ignored
    01-now.png … 06-wallpaper.png
  final/               # composed 1080×1920 PNGs ready to upload — committed
    01-now.png … 06-wallpaper.png
```

**Why `captions.js` (not `.json`):** loaded via `<script src>`, so it works from a `file://` URL with zero server. A `fetch('captions.json')` would be blocked by `file://` CORS. This supersedes the spec's `captions.json` mention for that reason.

**Shot IDs (fixed, used everywhere):** `01-now`, `02-birth`, `03-date`, `04-range`, `05-compare`, `06-wallpaper`.

---

## Task 1: Scaffold the screenshots workspace

**Files:**
- Create: `docs/store/screenshots/.gitignore`
- Create dirs: `docs/store/screenshots/raw/`, `docs/store/screenshots/final/`

- [ ] **Step 1: Create the directory tree + .gitignore**

```bash
cd /Users/moosedavis/dev/astro-clock
mkdir -p docs/store/screenshots/raw docs/store/screenshots/final
printf 'raw/\n.DS_Store\n' > docs/store/screenshots/.gitignore
```

- [ ] **Step 2: Verify**

```bash
ls -la docs/store/screenshots
cat docs/store/screenshots/.gitignore
```
Expected: `raw/`, `final/`, `.gitignore` present; `.gitignore` contains `raw/`.

- [ ] **Step 3: Commit**

```bash
git add docs/store/screenshots/.gitignore
git commit -m "chore(store): scaffold screenshots workspace"
```

---

## Task 2: Author `captions.js` (the 6 shots' data)

**Files:**
- Create: `docs/store/screenshots/captions.js`

Caption copy + art-direction data per shot. `headline` uses `\n` for the line break. `pan` (0–5) drives the continuous-panorama background offset. `motion` toggles the orbital-arc overlay (shots 3, 4). `cropTop` is px to shift the screenshot up inside its card (tuned later per shot; start at 0).

- [ ] **Step 1: Write `captions.js`**

```js
// Source of truth for caption + art-direction data per shot.
// Loaded via <script src> so it works from file:// (no fetch / no server).
window.SHOTS = {
  "01-now": {
    eyebrow: "REAL-TIME",
    headline: "The live sky,\nright now",
    subline: "Planets moving in real time",
    raw: "raw/01-now.png",
    pan: 0, cropTop: 0, motion: false,
  },
  "02-birth": {
    eyebrow: "YOUR CHART",
    headline: "Your birth chart\nin seconds",
    subline: "Sun, Moon & Rising",
    raw: "raw/02-birth.png",
    pan: 1, cropTop: 0, motion: false,
  },
  "03-date": {
    eyebrow: "TIME TRAVEL",
    headline: "Travel to\nany date",
    subline: "Past or future",
    raw: "raw/03-date.png",
    pan: 2, cropTop: 0, motion: true,
  },
  "04-range": {
    eyebrow: "IN MOTION",
    headline: "Watch the\nplanets move",
    subline: "",
    raw: "raw/04-range.png",
    pan: 3, cropTop: 0, motion: true,
  },
  "05-compare": {
    eyebrow: "COMPARE",
    headline: "Compare any\ntwo charts",
    subline: "",
    raw: "raw/05-compare.png",
    pan: 4, cropTop: 0, motion: false,
  },
  "06-wallpaper": {
    eyebrow: "KEEP IT",
    headline: "Save your chart\nas wallpaper",
    subline: "",
    raw: "raw/06-wallpaper.png",
    pan: 5, cropTop: 0, motion: false,
  },
};
```

- [ ] **Step 2: Verify it parses**

```bash
node -e "globalThis.window={}; require('./docs/store/screenshots/captions.js'); console.log(Object.keys(window.SHOTS).join(','))"
```
Expected: `01-now,02-birth,03-date,04-range,05-compare,06-wallpaper`

- [ ] **Step 3: Commit**

```bash
git add docs/store/screenshots/captions.js
git commit -m "feat(store): screenshot caption + art-direction data"
```

---

## Task 3: Build the composition template `frame.html`

**Files:**
- Create: `docs/store/screenshots/frame.html`

A single self-contained file: art-direction CSS + a small render script that reads `?shot=<id>`, pulls data from `window.SHOTS`, and composes the frame. The `#frame` element is exactly `1080×1920`.

- [ ] **Step 1: Write `frame.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MoveStar — screenshot frame</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="captions.js"></script>
<style>
  :root{ --gold:#E9C46A; --ink:#F5F3FF; --dim:#A9A4C9; --pan-step:120px; }
  *{ margin:0; box-sizing:border-box; }
  html,body{ background:#05040E; }
  #frame{
    position:relative; width:1080px; height:1920px; overflow:hidden;
    background: linear-gradient(180deg,#0B0A1F 0%, #07061A 55%, #05040E 100%);
  }
  /* nebula bloom — parallax slower than stars */
  #nebula{
    position:absolute; width:1500px; height:1500px; left:-140px; top:380px;
    background: radial-gradient(circle at 50% 50%,
      rgba(124,92,255,.34) 0%, rgba(86,67,196,.18) 32%, rgba(124,92,255,0) 62%);
    filter: blur(8px); transform: translateX(calc(var(--pan) * var(--pan-step) * -0.55));
  }
  /* starfield (generated) — wider than the canvas so it can pan */
  #stars{ position:absolute; inset:0 -700px 0 0; transform: translateX(calc(var(--pan) * var(--pan-step) * -1)); }
  .star{ position:absolute; border-radius:50%; background:#fff; }
  .star.halo{ box-shadow:0 0 10px 2px rgba(255,255,255,.55); }
  /* hero glow behind the card */
  #glow{
    position:absolute; left:50%; top:720px; width:1180px; height:1180px;
    transform:translateX(-50%);
    background: radial-gradient(circle, rgba(124,92,255,.30) 0%, rgba(124,92,255,0) 60%);
    filter: blur(24px);
  }
  /* caption zone */
  #cap{ position:absolute; top:118px; left:0; right:0; padding:0 96px; text-align:center; }
  #eyebrow{ font-family:Inter,sans-serif; font-weight:600; font-size:27px; letter-spacing:7px;
    text-transform:uppercase; color:var(--gold); }
  #eyebrow::after{ content:""; display:block; width:46px; height:2px; background:var(--gold);
    margin:18px auto 0; opacity:.85; }
  #headline{ font-family:"Playfair Display",serif; font-weight:700; font-size:86px; line-height:1.04;
    color:var(--ink); margin-top:26px; white-space:pre-line; text-shadow:0 2px 24px rgba(0,0,0,.45); }
  #subline{ font-family:Inter,sans-serif; font-weight:400; font-size:34px; color:var(--dim); margin-top:24px; }
  /* screenshot card */
  #card{ position:absolute; left:50%; top:560px; width:940px; height:1300px;
    transform:translateX(-50%); border-radius:36px; overflow:hidden;
    box-shadow:0 44px 130px rgba(0,0,0,.62), inset 0 0 0 1px rgba(255,255,255,.07); }
  #card img{ width:100%; display:block; }
  /* motion arcs (shots 3,4) */
  #arcs{ position:absolute; inset:0; pointer-events:none; display:none; }
  #arcs.on{ display:block; }
</style>
</head>
<body>
  <div id="frame">
    <div id="nebula"></div>
    <div id="stars"></div>
    <div id="glow"></div>
    <svg id="arcs" width="1080" height="1920" viewBox="0 0 1080 1920">
      <g fill="none" stroke="rgba(233,196,106,.55)" stroke-width="2" stroke-dasharray="2 12" stroke-linecap="round">
        <path d="M120,1180 A 540 540 0 0 1 960 1180" />
        <path d="M210,1320 A 360 360 0 0 1 870 1320" />
      </g>
      <circle cx="960" cy="1180" r="7" fill="#E9C46A"/>
    </svg>
    <div id="cap">
      <div id="eyebrow"></div>
      <div id="headline"></div>
      <div id="subline"></div>
    </div>
    <div id="card"><img id="shot" alt="" /></div>
  </div>
<script>
  // Deterministic starfield (seeded) so every render is identical → the pan is the only variation.
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  (function stars(){
    const rnd=mulberry32(20260615), host=document.getElementById('stars');
    const W=1780, H=1920, N=150;
    for(let i=0;i<N;i++){
      const d=document.createElement('div'); d.className='star';
      const big=rnd()>0.92; const s=big?(2.4+rnd()*1.8):(0.8+rnd()*1.3);
      d.style.width=d.style.height=s.toFixed(2)+'px';
      d.style.left=(rnd()*W).toFixed(1)+'px'; d.style.top=(rnd()*H).toFixed(1)+'px';
      d.style.opacity=(0.25+rnd()*0.6).toFixed(2);
      if(big) d.classList.add('halo');
      host.appendChild(d);
    }
  })();
  // Render the requested shot.
  const id=new URLSearchParams(location.search).get('shot');
  const s=(window.SHOTS||{})[id];
  if(!s){ document.body.innerHTML='<pre style="color:#fff;padding:40px">Unknown shot: '+id+'</pre>'; }
  else{
    document.getElementById('frame').style.setProperty('--pan', s.pan);
    document.getElementById('eyebrow').textContent=s.eyebrow;
    document.getElementById('headline').textContent=s.headline;
    const sub=document.getElementById('subline');
    if(s.subline){ sub.textContent=s.subline; } else { sub.style.display='none'; }
    const img=document.getElementById('shot');
    img.style.marginTop=(-(s.cropTop||0))+'px';
    img.src=s.raw;
    if(s.motion) document.getElementById('arcs').classList.add('on');
  }
</script>
</body>
</html>
```

- [ ] **Step 2: Verify it loads with a placeholder image (no raw captures yet)**

Open `docs/store/screenshots/frame.html?shot=01-now` in a browser (or render via Task 5) once a raw capture exists, and confirm: caption stack (gold eyebrow + serif headline + subline), nebula + stars, glow, and a rounded screenshot card all appear. (If no raw image exists yet, this visual check happens in Task 5 after the hero capture.)

- [ ] **Step 3: Commit**

```bash
git add docs/store/screenshots/frame.html
git commit -m "feat(store): art-directed screenshot composition template"
```

---

## Task 4: Bring up the emulator and capture the HERO raw (Now, anonymous)

**Prereq (per `mobile-android-dev-build` memory):** JDK 21, `ANDROID_HOME` set, Pixel_7 AVD running, Metro running (`pnpm --filter @astro/mobile run android` builds/installs; `expo start --dev-client` + `adb reverse tcp:8081 tcp:8081` for Metro), **`DEV_FORCE_PRO` still on**.

**Files:**
- Create: `docs/store/screenshots/raw/01-now.png`

- [ ] **Step 1: Confirm a device is attached**

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
"$ANDROID_HOME/platform-tools/adb" devices
```
Expected: one `emulator-5554   device` line. If empty, start the AVD from Android Studio and re-run.

- [ ] **Step 2: Put the app in the anonymous Now view**

In the running app: sign out / ensure no saved birth profile (so the wheel shows the live transit sky only — **zero PII**). Select the **Now** view. Let the wheel finish loading. Hide any transient overlays (menus closed).

- [ ] **Step 3: Capture the raw screenshot**

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/01-now.png
sips -g pixelWidth -g pixelHeight docs/store/screenshots/raw/01-now.png
```
Expected: a PNG ~`1080 × 2400`. Re-shoot if a menu/keyboard is visible.

- [ ] **Step 4: No commit** (raw/ is git-ignored).

---

## Task 5: Render the HERO shot #1 and get sign-off (GATE)

**Files:**
- Create: `docs/store/screenshots/final/01-now.png`

Define the renderer once (reused by Task 7):

```bash
cd /Users/moosedavis/dev/astro-clock
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render(){ "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1080,1920 --virtual-time-budget=3000 \
  --screenshot="$PWD/docs/store/screenshots/final/$1.png" \
  "file://$PWD/docs/store/screenshots/frame.html?shot=$1"; }
```

- [ ] **Step 1: Render the hero + verify dimensions**

```bash
render 01-now
sips -g pixelWidth -g pixelHeight docs/store/screenshots/final/01-now.png
```
Expected: `pixelWidth: 1080`, `pixelHeight: 1920` (exact — `--force-device-scale-factor=1`, no normalization needed).

- [ ] **Step 2: Show the user and iterate — THIS IS THE GATE**

Present `final/01-now.png` to the user. Iterate the art direction on this single frame until they sign off: candidate tweaks live in `frame.html` CSS (gold vs. cool-violet accent → `--gold`; headline size/font; nebula intensity/position; glow; card position/crop via `captions.js` `cropTop`). **Do not proceed to Task 6 until the user explicitly approves the hero look.**

- [ ] **Step 3: Commit the approved hero + any template tweaks**

```bash
git add docs/store/screenshots/final/01-now.png docs/store/screenshots/frame.html docs/store/screenshots/captions.js
git commit -m "feat(store): approved hero screenshot (01-now)"
```

---

## Task 6: Capture the remaining 5 raw screenshots (sample data, no PII)

**Files:**
- Create: `docs/store/screenshots/raw/{02-birth,03-date,04-range,05-compare,06-wallpaper}.png`

**Rule:** use only the synthetic sample data below — never the user's real birth data. The anonymous shots carry no saved profile.

For each: drive the app to the described state, then run the capture command. `export ANDROID_HOME="$HOME/Library/Android/sdk"` once per shell.

- [ ] **Step 1: `02-birth` — sample birth chart (2003-11-14 · 08:42 · Auckland, NZ)**

App: open the birth form, enter Birth date `2003-11-14`, Birth time `08:42`, place `Auckland, New Zealand`; view the resulting natal wheel (Sun/Moon/Rising visible). Then:
```bash
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/02-birth.png
```

- [ ] **Step 2: `03-date` — anonymous transit sky, traveled to 2017-03-21 · 14:05**

App: no saved profile; Date mode; set the target instant to `2017-03-21 14:05`; let the wheel settle.
```bash
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/03-date.png
```

- [ ] **Step 3: `04-range` — anonymous, Range 2008-06-01 → 2008-09-01, mid-animation**

App: Range mode; start `2008-06-01`, end `2008-09-01`; press play and capture a frame mid-motion (planets visibly between start/end; play controls visible).
```bash
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/04-range.png
```

- [ ] **Step 4: `05-compare` — two sample charts (A 2001-02-09 · 23:17 · Lisbon · B 2019-08-30 · 06:50 · Tokyo)**

App: Compare mode; Chart A = `2001-02-09 23:17 Lisbon, Portugal`; Chart B = `2019-08-30 06:50 Tokyo, Japan`; both wheels visible.
```bash
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/05-compare.png
```

- [ ] **Step 5: `06-wallpaper` — exported wallpaper of a sample birth (2012-07-04 · 17:33 · Reykjavík, IS)**

App: set birth `2012-07-04 17:33 Reykjavík, Iceland`; use Save-to-Photos / export so the composed wallpaper image (with the updated `MOVESTAR` wordmark + `Live Birth Chart` tagline) is on screen; capture that.
```bash
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > docs/store/screenshots/raw/06-wallpaper.png
```

- [ ] **Step 6: Verify all five exist and are ~1080×2400**

```bash
cd /Users/moosedavis/dev/astro-clock
for f in 02-birth 03-date 04-range 05-compare 06-wallpaper; do
  echo "$f:"; sips -g pixelWidth -g pixelHeight "docs/store/screenshots/raw/$f.png"; done
```
Expected: each prints `pixelWidth: 1080`, `pixelHeight: 2400` (±, depending on device). No commit (raw/ ignored).

---

## Task 7: Render the remaining 5 final PNGs

**Files:**
- Create: `docs/store/screenshots/final/{02-birth,03-date,04-range,05-compare,06-wallpaper}.png`

For each shot id, via the `render` shell function from Task 5:

- [ ] **Step 1: Render each shot**

```bash
cd /Users/moosedavis/dev/astro-clock
for id in 02-birth 03-date 04-range 05-compare 06-wallpaper; do render "$id"; done
```

- [ ] **Step 2: Tune per-shot crop if the hero element is clipped**

If a wheel/control is cut off or the screenshot sits too low, set that shot's `cropTop` in `captions.js` (px to shift up) and re-render that one shot. (Shot 1 is unaffected unless you touch `01-now`.)

- [ ] **Step 3: Verify all six dimensions + file size < 8 MB**

```bash
cd /Users/moosedavis/dev/astro-clock
for f in docs/store/screenshots/final/*.png; do
  echo "$f"; sips -g pixelWidth -g pixelHeight "$f"; ls -lh "$f" | awk '{print $5}'; done
```
Expected: all six `1080 × 1920`, each well under 8 MB. Normalize any 2× ones with `sips -z 1920 1080 <file>`.

- [ ] **Step 4: Commit the full set**

```bash
git add docs/store/screenshots/final docs/store/screenshots/captions.js
git commit -m "feat(store): render full Play Store screenshot set (6 shots)"
```

---

## Task 8: Verify against the art-direction quality gate

**Files:** none (review only).

- [ ] **Step 1: Walk the spec's quality gate**

Open all six `final/*.png` side by side and check every box from the spec's *Verification → Art-direction quality gate*:
- [ ] Hero #1 was approved before the rest (Task 5 gate).
- [ ] Layered nebula backdrop that **pans continuously** across the 6 (not flat fills).
- [ ] Eyebrow→headline→subline stack in serif/sans; gold accent appears **exactly once** per shot.
- [ ] Wheel reads as a luminous, floating card (glow + shadow + depth).
- [ ] Shots `03-date` + `04-range` carry the motion arcs.
- [ ] Cohesive gallery (shared backdrop, identical caption zone + card placement + margins).
- [ ] Accuracy: no live-wallpaper / readings / social-share claims; `06-wallpaper` shows the new watermark; **no real PII** (sample data only).

- [ ] **Step 2: Fix any failures** by editing `captions.js`/`frame.html` and re-rendering the affected shot(s) (repeat Task 7 Step 1 for those ids), then re-commit.

---

## Task 9: Revert `DEV_FORCE_PRO` (closes task #30)

**Files:**
- Modify: `apps/mobile/hooks/useEntitlement.ts`

Capture is done, so Pro no longer needs forcing. Restore real entitlement.

- [ ] **Step 1: Inspect the current override**

```bash
cd /Users/moosedavis/dev/astro-clock
grep -n "DEV_FORCE_PRO" apps/mobile/hooks/useEntitlement.ts
```
Expected: a `const DEV_FORCE_PRO = true;` line and an `if (DEV_FORCE_PRO) { setIsPro(true); return; }` block.

- [ ] **Step 2: Remove both the constant and the early-return block** so entitlement comes from RevenueCat again. Edit `apps/mobile/hooks/useEntitlement.ts` to delete the `DEV_FORCE_PRO` constant declaration and the `if (DEV_FORCE_PRO) { … }` block.

- [ ] **Step 3: Verify the override is gone**

```bash
grep -n "DEV_FORCE_PRO" apps/mobile/hooks/useEntitlement.ts || echo "DEV_FORCE_PRO removed"
```
Expected: `DEV_FORCE_PRO removed`.

- [ ] **Step 4: Run the mobile unit tests**

```bash
pnpm --filter @astro/mobile test
```
Expected: all suites pass (90/90 as of this branch).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useEntitlement.ts
git commit -m "chore(mobile): revert DEV_FORCE_PRO entitlement override"
```

- [ ] **Step 6: Close task #30** (mark the tracked task complete).

---

## Task 10: Finish the branch

- [ ] **Step 1:** Use **superpowers:finishing-a-development-branch** to verify tests, then present merge/PR options. The branch `feat/mobile-theme-header` now also carries: the watermark change (`ExportCard.tsx`), the ASO doc, this spec + plan, and the screenshot set. (PR bundles round-2 theme/header work + ASO + screenshots.)

---

## Self-review notes (against the spec)

- **Style/theme/set/order/captions** → Tasks 2–7 (captions.js + frame.html + render).
- **Art direction** (nebula pan, glow, floating card, serif/sans + gold eyebrow, motion arcs) → frame.html CSS/SVG; quality gate in Task 8.
- **Approve pixels first** → Task 5 is an explicit hard gate before Task 6/7.
- **Capture via adb + sample data, no PII** → Tasks 4 & 6 (anonymous shots + synthetic profiles; real profile cleared).
- **1080×1920, <8MB** → `sips` checks in Tasks 5 & 7.
- **Revert DEV_FORCE_PRO** → Task 9 (closes #30).
- **Out of scope** (feature graphic, tablet shots, video, live-wallpaper claim) → not in any task, by design.
