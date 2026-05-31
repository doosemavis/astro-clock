/*
 * ephemeris.ts — geocentric ecliptic longitudes of the Sun, Moon and planets,
 * plus solar altitude and the Ascendant.
 *
 * EXACT TypeScript port of prototype/ephemeris.js (Paul Schlyter's low-precision method).
 * Accurate to ~arc-minute for Sun/Moon and ~0.01-0.05 deg for planets over 1900-2100 —
 * far finer than a 30-degree zodiac sign needs. Validated 10/10 vs. a known Co-Star chart.
 *
 * PRODUCTION UPGRADE PATH (spec §7): swap the body of `positions()` to call
 * `astronomy-engine` (MIT). The public surface (positions / sunAltitude / ascendant /
 * birthInstant) is the stable contract; that swap is internal and the regression test
 * (ephemeris.test.ts) is the gate that must stay green.
 */
import type { Positions, PlanetKey, BirthData } from "./types.ts";

const DEG = Math.PI / 180;
const rev = (x: number) => ((x % 360) + 360) % 360;
const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);
const tand = (x: number) => Math.tan(x * DEG);
const atan2d = (y: number, x: number) => Math.atan2(y, x) / DEG;
const asind = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;

/** Schlyter day number: 0.0 at 1999-12-31 00:00 UT, plus UT fraction of day. */
export function dayNumber(date: Date): number {
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1;
  const D = date.getUTCDate();
  const ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const d =
    367 * Y -
    Math.floor((7 * (Y + Math.floor((M + 9) / 12))) / 4) +
    Math.floor((275 * M) / 9) +
    D - 730530;
  return d + ut / 24;
}

function eccentricAnomaly(M: number, e: number): number {
  M = rev(M);
  let E = M + (e / DEG) * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 8; k++) {
    const dE = (E - (e / DEG) * sind(E) - M) / (1 - e * cosd(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}

interface SunResult { lon: number; x: number; y: number; M: number; w: number; }

function sun(d: number): SunResult {
  const w = 282.9404 + 4.70935e-5 * d;
  const e = 0.016709 - 1.151e-9 * d;
  const M = rev(356.047 + 0.9856002585 * d);
  const E = eccentricAnomaly(M, e);
  const xv = cosd(E) - e;
  const yv = Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const lon = rev(v + w);
  return { lon, x: r * cosd(lon), y: r * sind(lon), M, w };
}

interface Elements {
  N: (d: number) => number; i: (d: number) => number; w: (d: number) => number;
  a: (d: number) => number; e: (d: number) => number; M: (d: number) => number;
}

function planetHelio(d: number, el: Elements): { x: number; y: number } {
  const N = el.N(d), i = el.i(d), w = el.w(d), a = el.a(d), e = el.e(d), M = rev(el.M(d));
  const E = eccentricAnomaly(M, e);
  const xv = a * (cosd(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  return { x: xh, y: yh };
}

function moon(d: number, s: SunResult): number {
  const N = rev(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * d);
  const a = 60.2666, e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * d);
  const E = eccentricAnomaly(M, e);
  const xv = a * (cosd(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  let lon = atan2d(yh, xh);
  const Ms = s.M, ws = s.w;
  const Ls = rev(Ms + ws);
  const Lm = rev(N + w + M);
  const Dm = rev(Lm - Ls);
  const F = rev(Lm - N);
  lon +=
    -1.274 * sind(M - 2 * Dm) + 0.658 * sind(2 * Dm) - 0.186 * sind(Ms) -
    0.059 * sind(2 * M - 2 * Dm) - 0.057 * sind(M - 2 * Dm + Ms) +
    0.053 * sind(M + 2 * Dm) + 0.046 * sind(2 * Dm - Ms) + 0.041 * sind(M - Ms) -
    0.035 * sind(Dm) - 0.031 * sind(M + Ms) - 0.015 * sind(2 * F - 2 * Dm) +
    0.011 * sind(M - 4 * Dm);
  return rev(lon);
}

function pluto(d: number, s: SunResult): number {
  const S = rev(50.03 + 0.033459652 * d);
  const P = rev(238.95 + 0.003968789 * d);
  const lon =
    238.9508 + 0.00400703 * d -
    19.799 * sind(P) + 19.848 * cosd(P) +
    0.897 * sind(2 * P) - 4.956 * cosd(2 * P) +
    0.61 * sind(3 * P) + 1.211 * cosd(3 * P) -
    0.341 * sind(4 * P) - 0.19 * cosd(4 * P) +
    0.128 * sind(5 * P) - 0.034 * cosd(5 * P) -
    0.038 * sind(6 * P) + 0.031 * cosd(6 * P) +
    0.02 * sind(S - P) - 0.01 * cosd(S - P);
  const lat =
    -3.9082 - 5.453 * sind(P) - 14.975 * cosd(P) +
    3.527 * sind(2 * P) + 1.673 * cosd(2 * P) -
    1.051 * sind(3 * P) + 0.328 * cosd(3 * P) +
    0.179 * sind(4 * P) - 0.292 * cosd(4 * P) +
    0.019 * sind(5 * P) + 0.1 * cosd(5 * P) -
    0.031 * sind(6 * P) - 0.026 * cosd(6 * P) + 0.011 * cosd(S - P);
  const r =
    40.72 + 6.68 * sind(P) + 6.9 * cosd(P) -
    1.18 * sind(2 * P) - 0.03 * cosd(2 * P) +
    0.15 * sind(3 * P) - 0.14 * cosd(3 * P);
  const xh = r * cosd(lon) * cosd(lat);
  const yh = r * sind(lon) * cosd(lat);
  return rev(atan2d(yh + s.y, xh + s.x));
}

const ELEMENTS: Record<Exclude<PlanetKey, "sun" | "moon" | "pluto">, Elements> = {
  mercury: { N: d => 48.3313 + 3.24587e-5 * d, i: d => 7.0047 + 5.0e-8 * d, w: d => 29.1241 + 1.01444e-5 * d, a: () => 0.387098, e: d => 0.205635 + 5.59e-10 * d, M: d => 168.6562 + 4.0923344368 * d },
  venus: { N: d => 76.6799 + 2.4659e-5 * d, i: d => 3.3946 + 2.75e-8 * d, w: d => 54.891 + 1.38374e-5 * d, a: () => 0.72333, e: d => 0.006773 - 1.302e-9 * d, M: d => 48.0052 + 1.6021302244 * d },
  mars: { N: d => 49.5574 + 2.11081e-5 * d, i: d => 1.8497 - 1.78e-8 * d, w: d => 286.5016 + 2.92961e-5 * d, a: () => 1.523688, e: d => 0.093405 + 2.516e-9 * d, M: d => 18.6021 + 0.5240207766 * d },
  jupiter: { N: d => 100.4542 + 2.76854e-5 * d, i: d => 1.303 - 1.557e-7 * d, w: d => 273.8777 + 1.64505e-5 * d, a: () => 5.20256, e: d => 0.048498 + 4.469e-9 * d, M: d => 19.895 + 0.0830853001 * d },
  saturn: { N: d => 113.6634 + 2.3898e-5 * d, i: d => 2.4886 - 1.081e-7 * d, w: d => 339.3939 + 2.97661e-5 * d, a: () => 9.55475, e: d => 0.055546 - 9.499e-9 * d, M: d => 316.967 + 0.0334442282 * d },
  uranus: { N: d => 74.0005 + 1.3978e-5 * d, i: d => 0.7733 + 1.9e-8 * d, w: d => 96.6612 + 3.0565e-5 * d, a: d => 19.18171 - 1.55e-8 * d, e: d => 0.047318 + 7.45e-9 * d, M: d => 142.5905 + 0.011725806 * d },
  neptune: { N: d => 131.7806 + 3.0173e-5 * d, i: d => 1.77 - 2.55e-7 * d, w: d => 272.8461 - 6.027e-6 * d, a: d => 30.05826 + 3.313e-8 * d, e: d => 0.008606 + 2.15e-9 * d, M: d => 260.2471 + 0.005995147 * d },
};

/** Geocentric ecliptic longitude (deg, 0..360) of every body for a JS Date (UTC). */
export function positions(date: Date): Positions {
  const d = dayNumber(date);
  const s = sun(d);
  const out: Partial<Positions> = { sun: rev(s.lon), moon: moon(d, s), pluto: pluto(d, s) };
  (Object.keys(ELEMENTS) as (keyof typeof ELEMENTS)[]).forEach(name => {
    const h = planetHelio(d, ELEMENTS[name]);
    out[name] = rev(atan2d(h.y + s.y, h.x + s.x));
  });
  return out as Positions;
}

function obliquity(d: number) { return 23.4393 - 3.563e-7 * d; }

function localSiderealDeg(date: Date, lonEastDeg: number): number {
  const d = dayNumber(date);
  const s = sun(d);
  const Ls = rev(s.M + s.w);
  const ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gmst = rev(Ls + 180 + ut * 15);
  return rev(gmst + lonEastDeg);
}

/** Solar altitude (deg) above the horizon. Positive = day, negative = night. */
export function sunAltitude(date: Date, latDeg: number, lonEastDeg: number): number {
  const d = dayNumber(date);
  const s = sun(d);
  const ecl = obliquity(d);
  const ra = rev(atan2d(cosd(ecl) * sind(s.lon), cosd(s.lon)));
  const dec = asind(sind(ecl) * sind(s.lon));
  const ha = rev(localSiderealDeg(date, lonEastDeg) - ra);
  return asind(sind(latDeg) * sind(dec) + cosd(latDeg) * cosd(dec) * cosd(ha));
}

/** Ascendant: ecliptic longitude rising on the eastern horizon (deg). */
export function ascendant(date: Date, latDeg: number, lonEastDeg: number): number {
  const d = dayNumber(date);
  const ecl = obliquity(d);
  const lst = localSiderealDeg(date, lonEastDeg);
  const asc = atan2d(cosd(lst), -(sind(lst) * cosd(ecl) + tand(latDeg) * sind(ecl)));
  return rev(asc);
}

/** Convert BirthData into the precise UTC instant of birth (mirrors prototype applyObj). */
export function birthInstant(b: BirthData): Date {
  const [Y, M, D] = b.date.split("-").map(Number);
  const [h, m] = b.time.split(":").map(Number);
  const actualOffset = b.tzOffset + (b.isDst ? 1 : 0);
  return new Date(Date.UTC(Y, M - 1, D, h, m) - actualOffset * 3600000);
}
