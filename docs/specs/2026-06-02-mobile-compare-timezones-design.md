# Mobile Compare — Per-Chart Timezones Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

In Compare, each wheel can pick **its own timezone**, and the date/time entered for that wheel
is the **wall-clock time in that zone**. So "Jul 1, 3:00 PM" set in Tokyo for Chart A and in
New York for Chart B are different absolute instants → genuinely different charts. This lets a
user compare two births (or events) that occurred in different zones.

Builds on Slice 3b (Compare) and the now-persisted `birth.ianaTz` (PR #6).

## 2. Goals

- Each Compare chart is a **`CompareMoment = { date, time, zone }`** (wall-clock + IANA zone).
- The actual instant is derived: `ms = Date.UTC(Y,M,D,h,m) − offsetHoursAt(date,time,zone)·3.6e6`
  (the same DST-aware conversion `birthInstant` uses; `offsetHoursAt` already exists).
- Compare controls: per chart, a **date** picker, a **time** picker, and a **timezone** picker
  (reuse `OffsetSelect`, the DST-aware IANA picker). Changing the zone keeps the wall-clock and
  recomputes the instant.
- Each wheel's caption shows `date · time · <zone abbrev>`.
- Defaults: **Chart A** = the birth's `date`/`time`/`ianaTz`; **Chart B** = now, in the device's
  local zone.
- **No new dependencies.**

## 3. Non-goals

- Changing single-chart modes (Birth/Now/Date/Range) — they stay as-is (local zone).
- A timezone for the ascendant/houses (Compare wheels show planets only; planets are geocentric,
  so only the instant matters — the zone affects *which instant* and the displayed label).
- 3c-iii sky (separate, still queued).

## 4. Approach

### 4.1 `lib/timezone.ts` (+ test)
- `zonedInstant(date, time, zone): number` — `Date.UTC(Y,M-1,D,h,m) − offsetHoursAt(date,time,zone)·3600000`.
- `zoneAbbr(date, time, zone): string` — the zone's short name (e.g. "CDT") via
  `Intl.DateTimeFormat(..., { timeZone, timeZoneName: "short" })`, falling back to
  `formatOffset(offsetHoursAt(...))` (e.g. "UTC−5").

### 4.2 `lib/chartModel.ts`
- `export interface CompareMoment { date: string; time: string; zone: string; }` (engine-free).

### 4.3 `hooks/useChartClock.ts`
- Take `birth: BirthData` (in addition to `birthMs`) for compare defaults.
- Replace the `compareAMs`/`compareBMs` number state with `compareA`/`compareB: CompareMoment`:
  - `compareA` default = `{ date: birth.date, time: birth.time, zone: birth.ianaTz ?? localZone() }`.
  - `compareB` default = now's wall-clock in `localZone()` (`Intl…resolvedOptions().timeZone`).
  - **Derived** `compareAMs = useMemo(() => zonedInstant(compareA.…), [compareA])`, likewise B.
  - `compareA` re-seeds from birth when `birth.date`/`time`/`ianaTz` change (replaces the old
    `setCompareA(birthMs)` effect).
- Expose `compareA`, `setCompareA(m)`, `compareB`, `setCompareB(m)` (plus the derived `compareAMs`,
  `compareBMs` for positions), and the unchanged `compareView`.

### 4.4 `components/chart/ZonedMomentField.tsx` (new)
One chart's controls — themed (`useTheme`/`makeStyles`):
- Props `{ label; moment: CompareMoment; onChange: (m: CompareMoment) => void; timeFormat }`.
- A **Date** pressable + native `DateTimePicker` (mode date) → updates `moment.date`.
- A **Time** pressable + native picker (mode time) → updates `moment.time` (displayed per `timeFormat`, `padHour`'d).
- An `<OffsetSelect valueZone={moment.zone} date={moment.date} time={moment.time} onChange={(zone) => onChange({ …moment, zone })} />`.
- Reuses the date/time-string helpers (pad / `YYYY-MM-DD` / `HH:MM`) like `BirthForm`.

### 4.5 `components/chart/ChartControls.tsx`
- Compare section renders two `ZonedMomentField`s (Chart A, Chart B) bound to
  `compareA`/`compareB` + `setCompareA`/`setCompareB`, instead of the old ms-based `DateField`s.

### 4.6 `lib/readout.ts`
- Replace `cmpCaption(ms, birth, timeFormat)` with `cmpCaption(moment: CompareMoment, timeFormat)`
  → `${fmtCalendar(moment.date)} · ${fmtClock(moment.time, timeFormat)} · ${zoneAbbr(...)}`.
  (Helpers format the stored wall-clock directly — no instant round-trip.)

### 4.7 `App.tsx`
- `useChartClock(birthMs, birth)`.
- `compareAPos = useMemo(() => positions(new Date(clock.compareAMs)), [clock.compareAMs])` (unchanged shape).
- Captions from `cmpCaption(clock.compareA, timeFormat)` / `compareB`.
- `CompareView` unchanged (still gets `posA/posB`, captions, `vis.live`).

## 5. Files

| File | Action | Notes |
|---|---|---|
| `lib/timezone.ts` (+ test) | edit | `zonedInstant`, `zoneAbbr` (+ unit tests) |
| `lib/chartModel.ts` | edit | `CompareMoment` type |
| `hooks/useChartClock.ts` | edit | compare state → `{date,time,zone}`; derive ms; take `birth` |
| `components/chart/ZonedMomentField.tsx` | new | date + time + zone picker for one chart |
| `components/chart/ChartControls.tsx` | edit | Compare section → two `ZonedMomentField`s |
| `lib/readout.ts` | edit | `cmpCaption(moment, timeFormat)` |
| `App.tsx` | edit | pass `birth`; captions from moments |

## 6. Verification

1. **Unit test** (`node --test`): `zonedInstant("2026-07-01","15:00","America/New_York")` vs
   `"Asia/Tokyo"` differ by the expected hours; a known case matches `birthInstant`-style math.
2. typecheck; mobile + engine suites green.
3. `expo export --platform android` bundles.
4. Web `/browse`: Compare → set Chart A and Chart B to the **same wall-clock** in **different
   zones** → the two wheels differ (planets shifted); each caption shows its zone. Change a
   zone → that wheel's instant/planets shift while its wall-clock stays.

**On device:** the three pickers per chart are usable; zones persist within the session.

## 7. Risks + fallbacks

- **State-model change is coupled** (`useChartClock` ↔ `ChartControls` ↔ `App`). Mitigation:
  one keystone commit for those three; helpers/types/component land green first.
- **`Intl` zone abbrev variance** across engines. Mitigation: `zoneAbbr` falls back to the
  numeric `UTC±N` offset label.
- **DST edge instants** (spring-forward gaps). `offsetHoursAt` already resolves a concrete offset
  for any wall-clock; acceptable (matches birth handling).

## 8. Out of scope

3c-iii day/night sky. Per-chart location (ascendant) in Compare. Auth / cloud sync.
