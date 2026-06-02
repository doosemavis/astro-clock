// Theme palettes + color mixing + solar day/night blend. Ported from the prototype's
// NIGHT/DAY objects, mixColor, aspectColor, solarT. Pure — the React layer applies the
// resulting CSS variables; this module just computes colors.
import type { AspectDef } from "./types.ts";
import { sunAltitude } from "./ephemeris.ts";

export interface Palette {
  bg: string; bgEdge: string; panel: string; border: string;
  text: string; textDim: string; seclabel: string;
  line: string; sign: string; natal: string; live: string;
}

export const NIGHT: Palette = {
  bg: "#0c0e26", bgEdge: "#05060f", panel: "#0a0b22", border: "#272a52",
  text: "#e9eaf6", textDim: "#9a9cc0", seclabel: "#6f72a0",
  line: "#aeb2e0", sign: "#ccd0ef", natal: "#7a7da8", live: "#f2e7c2",
};

export const DAY: Palette = {
  bg: "#a9c4e8", bgEdge: "#7fa3d4", panel: "#c4d6ef", border: "#5f7bac",
  text: "#0d1733", textDim: "#3a4774", seclabel: "#48588a",
  line: "#1b2a55", sign: "#111d40", natal: "#3d4f86", live: "#0c1430",
};

/** Maps palette keys to CSS custom-property names (prototype THEME_KEYS). */
export const THEME_VARS: Record<keyof Palette, string> = {
  bg: "--bg", bgEdge: "--bg-edge", panel: "--panel", border: "--border",
  text: "--text", textDim: "--text-dim", seclabel: "--seclabel",
  line: "--line", sign: "--sign", natal: "--natal", live: "--live",
};

function hexRgb(h: string): [number, number, number] {
  h = h.replace("#", "");
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

/** Linear blend between two hex colors -> "rgb(...)" (prototype mixColor). */
export function mixColor(h1: string, h2: string, t: number): string {
  const a = hexRgb(h1), b = hexRgb(h2);
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/** All CSS variables for a theme value t (0 = dark, 1 = light). */
export function themeVars(t: number): Record<string, string> {
  t = Math.max(0, Math.min(1, t));
  const out: Record<string, string> = {};
  (Object.keys(THEME_VARS) as (keyof Palette)[]).forEach(k => {
    out[THEME_VARS[k]] = mixColor(NIGHT[k], DAY[k], t);
  });
  return out;
}

/** Aspect stroke for the current theme value (prototype aspectColor). */
export function aspectColor(def: AspectDef, t: number): string {
  return mixColor(def.dark, def.light, t);
}

function smoothstep(x: number): number {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

/**
 * Day/night blend value (0 = night, 1 = day) for a moment & place, from the real Sun
 * altitude. Holds full dark through night AND twilight (sun at or below the horizon),
 * then brightens as the sun climbs, reaching full day by ~+18° altitude. This keeps
 * dawn/dusk on the dark palette instead of washing out through a low-contrast grey
 * midpoint (the prototype's -9°..+9° band brightened too early at dusk).
 */
export function solarT(date: Date, lat: number, lon: number): number {
  return smoothstep(sunAltitude(date, lat, lon) / 18);
}

/** A full palette blended NIGHT->DAY by t (0 = night, 1 = day). The object form of
 *  themeVars(), for runtime styling (React Native has no CSS custom properties). */
export function mixPalette(t: number): Palette {
  t = Math.max(0, Math.min(1, t));
  const out = {} as Palette;
  (Object.keys(THEME_VARS) as (keyof Palette)[]).forEach((k) => {
    out[k] = mixColor(NIGHT[k], DAY[k], t);
  });
  return out;
}
