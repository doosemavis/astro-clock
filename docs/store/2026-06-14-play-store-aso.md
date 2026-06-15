# Play Store Listing — ASO Draft (MoveStar)

**Date:** 2026-06-14 · **Purpose:** Keyword-optimized Google Play listing (tester-report #1). Paste into Play Console → Store listing. Content deliverable, not code.

**Accuracy guardrails (true to THIS release):**
- ❌ No "daily horoscope readings / interpretations" — Readings tab hidden. (Using "horoscope" only in the *chart/wheel* sense — a birth chart **is** a horoscope — is accurate.)
- ❌ No "share to social media" — in-app Share disabled. ("Save to Photos" is fine.)
- ✅ Sell: real-time sky, birth chart, time-travel (Date/Range), Compare, save-as-image, themes, astronomy-accurate.

---

## ASO insights from research (what's working)

- **Title = Brand + keyword phrase.** Every top app does it: *Co–Star Personalized Astrology*, *AstroMatrix Birth Horoscopes*, *The Pattern: Astrology*, *TimePassages Astrology*, *Sanctuary Astrology: Horoscope & Psychic Reading*. Brand-only leaves ranking on the table.
- **Google Play indexes the FULL description** (unlike iOS). It's an on-page-SEO field: front-load the first ~250 chars (the pre-"Read more" zone has the highest weight), keep the **primary keyword at ~2–3% density (≈3–5 mentions)**, secondaries 1–2×, and **don't keyword-stuff** — Google's NLP penalizes unnatural text and understands synonyms.
- **Reviews/ratings feed rankings** → the in-app "Rate MoveStar" button we shipped indirectly helps ASO.
- **Highest-traffic terms (monthly searches):** horoscope ~5M · astrology ~3.35M · zodiac signs ~2.74M · daily horoscope ~823K · birth chart ~673K · astrology chart ~301K · natal chart ~246K · rising sign / moon sign / astrology by date of birth ~74K each · sun moon and rising ~27K.
- **Winnable, accurate, high-intent terms:** **birth chart** and **natal chart** — Co–Star (the category leader) ranks #1 for both, and they describe exactly what MoveStar does. These are our core targets (we don't need the "daily horoscope readings" crowd).
- Sources: Google Play "Best practices for your store listing"; AppDrift / Appalize / Sonar / ASOtxt ASO guides; ASOTools keyword reports; KeySearch astrology volumes.

---

## 1. App title  (limit: 30 chars) — more options

| Option | Chars | Keywords captured | Note |
|---|---|---|---|
| `MoveStar: Live Birth Chart` | 26 | birth chart + the differentiator | ✅ **CHOSEN** — leads with "live" (our edge) + captures "birth chart" |
| `MoveStar: Birth Chart` | 21 | birth chart | Tighter alt — highest-intent accurate term |
| `MoveStar: Astrology Chart` | 25 | astrology, chart | Broadest umbrella term |
| `MoveStar: Natal Chart & Sky` | 27 | natal chart | "natal chart" is a strong sibling term |
| `MoveStar: Astrology & Charts` | 28 | astrology, charts | Two umbrella terms |
| `MoveStar: Zodiac & Astrology` | 28 | zodiac, astrology | Highest combined traffic, less specific |
| `MoveStar: Horoscope & Charts` | 28 | horoscope (chart sense), charts | ⚠️ "horoscope" is huge traffic but may set a "readings" expectation |
| `MoveStar Birth Chart Astrology` | 30 | birth chart + astrology | Both top terms, but reads keyword-y (no separator) |

**CHOSEN (2026-06-15):** `MoveStar: Live Birth Chart` — leads with our differentiator ("live") while still ranking on "birth chart"; the umbrella terms (astrology / natal / real-time) ride in the short description.

> **In-app watermark ≠ store title.** The export/wallpaper watermark shows the **`MOVESTAR` wordmark only**, with `Live Birth Chart` as a smaller tagline beneath it when there's vertical room (there always is in the portrait export). The combined "MoveStar: Live Birth Chart" lockup is the **store title**, not the on-image watermark.

## 2. Short description  (limit: 80 chars)

- `Real-time astrology: your living natal chart — planets, transits & time-travel.` (78) ← ✅ **CHOSEN** (pairs with title: uses "natal chart", so it doesn't repeat the title's "birth chart")
- `Your real-time birth chart — natal signs, zodiac, transits & time-travel.` (72)
- `Watch the real sky move — cast your birth chart, read transits, time-travel.` (75)

(Don't repeat the title's exact keyword; pair it with the complementary terms.)

## 3. Full description  (limit: 4,000 — this draft ≈ 2,000 chars)

```
MoveStar is a living astrology app — a real-time birth chart that moves with the actual sky. Cast your natal chart in seconds, watch the planets shift right now, and travel through time to see the zodiac on any date, past or future.

Most astrology and horoscope apps show static text. MoveStar is alive: the chart wheel updates as the real planets move, so you always see the current sky at a glance.

★ WHAT YOU CAN DO
• Real-time sky — a live astrology chart that ticks with the actual planetary positions, right now.
• Your birth chart — your personal horoscope: enter your birth date, time and place to cast your natal chart, with your Sun, Moon and Rising (ascendant) signs.
• Time travel — jump to any date and time, or play a date range and watch the planets and zodiac animate across days, months and years.
• Compare charts — view two charts side by side to compare your birth chart against any moment in time.
• Planet coordinates — a precise table of every planet's zodiac sign and exact degree.
• Save as wallpaper — export your birth chart as a beautiful, full-screen image for your home or lock screen.
• Light, Dark & System themes — a clean cosmic design that fits your phone.

★ ASTRONOMY-ACCURATE
MoveStar computes real planetary positions from true ephemeris data, so your zodiac signs, degrees and ascendant are calculated precisely — not generic. See exactly where the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto sit in the zodiac at any moment.

★ FOR EVERYONE
New to astrology? Discover your sun, moon and rising signs and the sky the day you were born. Seasoned astrologer? Read live transits, compare charts, and scrub through time with a tap.

★ FREE & PRO
Cast your birth chart and watch the live sky for free. Go Pro to unlock time-travel to any date, animated date ranges, and side-by-side chart comparison.

Download MoveStar and turn the night sky into your own living birth chart — real-time astrology, beautifully accurate.
```

Keyword coverage (natural, within density limits): **astrology** ×5, **birth chart** ×4, **natal chart** ×2, **zodiac** ×5, horoscope ×2 (chart sense), plus all ten planets named, transits, Sun/Moon/Rising, ascendant, real-time, time travel, ephemeris, wallpaper. Primary terms are front-loaded in sentence 1 and repeated in the closing CTA (per the indexing-weight guidance).

## 4. Play Console field map
- **App name** → §1 (≤30) · **Short description** → §2 (≤80) · **Full description** → §3 (≤4000).

## Decisions
1. ~~**Title**~~ → **RESOLVED:** `MoveStar: Live Birth Chart`.
2. ~~**"Horoscope" in title?**~~ → **RESOLVED:** no — kept out to avoid a "daily readings" expectation while Readings is hidden.
3. **(open)** Paste the **current** Play description if you want me to preserve any existing voice/claims.
