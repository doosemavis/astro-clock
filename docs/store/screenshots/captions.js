// Source of truth for caption + art-direction data per shot.
// Loaded via <script src> so it works from file:// (no fetch / no server).
window.SHOTS = {
  "01-now": {
    eyebrow: "REAL-TIME",
    headline: "The live sky,\nright now",
    subline: "Planets moving in real time",
    raw: "raw/01-now.png",
    pan: 0, cropTop: 520, motion: false,
  },
  "02-birth": {
    eyebrow: "YOUR CHART",
    headline: "Your birth chart\nin seconds",
    subline: "Sun, Moon & Rising",
    raw: "raw/02-birth.png",
    pan: 1, cropTop: 520, motion: false,
  },
  "03-date": {
    eyebrow: "TIME TRAVEL",
    headline: "Travel to\nany date",
    subline: "Past or future",
    raw: "raw/03-date.png",
    pan: 2, cropTop: 520, motion: true,
  },
  "04-range": {
    eyebrow: "IN MOTION",
    headline: "Watch the\nplanets move",
    subline: "",
    raw: "raw/04-range.png",
    pan: 3, cropTop: 520, motion: true,
  },
  "05-compare": {
    eyebrow: "COMPARE",
    headline: "Compare any\ntwo charts",
    subline: "",
    raw: "raw/05-compare.png",
    pan: 4, cropTop: 283, motion: false,
    cardW: 800, cardH: 1336, cardTop: 534,
  },
  "06-wallpaper": {
    eyebrow: "KEEP IT",
    headline: "Save your chart\nas wallpaper",
    subline: "",
    raw: "raw/06-wallpaper.png",
    pan: 5, cropTop: 0, motion: false,
    cardW: 620, cardH: 1378, cardTop: 420,
  },
};
