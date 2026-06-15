// Pure onboarding data + helpers (no React, no AsyncStorage) so node --test can cover it.

export type DemoKind = "live" | "natal" | "timetravel";
export type CtaAction = "createAccount" | "next" | "dismiss";
export interface SlideCta { label: string; action: CtaAction; }
export interface Slide {
  id: string;
  title: string;
  body: string;
  demo: DemoKind;
  primary: SlideCta;
  secondary?: SlideCta;
}

export const SLIDES: Slide[] = [
  {
    id: "welcome",
    title: "Welcome to MoveStar",
    body: "Your living sky — the real planets, in real time.",
    demo: "live",
    primary: { label: "Create free account", action: "createAccount" },
    secondary: { label: "Maybe later", action: "next" },
  },
  {
    id: "live",
    title: "The live sky",
    body: "Watch the actual planets move in real time.",
    demo: "live",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "birth",
    title: "Your birth chart",
    body: "Cast your birth chart — Sun, Moon & Rising — and save it as a wallpaper.",
    demo: "natal",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "go-further",
    title: "Go further",
    body: "Travel to any date, animate a date range, and compare two charts.",
    demo: "timetravel",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "create",
    title: "See your chart",
    body: "Want to see your birth chart with all these features? Create an account.",
    demo: "natal",
    primary: { label: "Create account", action: "createAccount" },
    secondary: { label: "Continue to the live sky", action: "dismiss" },
  },
];

/** AsyncStorage value meaning "the walkthrough has been seen". */
export const SEEN_VALUE = "1";

/** Parse the persisted onboarding flag: only the exact SEEN_VALUE counts as seen. */
export function parseOnboardingSeen(raw: string | null): boolean {
  return raw === SEEN_VALUE;
}
