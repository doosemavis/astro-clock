import { memo, useMemo } from "react";

// Deterministic PRNG so the server and client render identical stars (no hydration
// mismatch) — replaces the prototype's Math.random() star scatter.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Stars = memo(function Stars() {
  const stars = useMemo(() => {
    const rnd = mulberry32(0x5eed);
    return Array.from({ length: 160 }, () => ({
      cx: +(rnd() * 100).toFixed(2),
      cy: +(rnd() * 100).toFixed(2),
      r: +(0.04 + rnd() * 0.13).toFixed(3),
      o: +(0.25 + rnd() * 0.7).toFixed(2),
    }));
  }, []);
  return (
    <>
      {stars.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#ffffff" opacity={s.o} />
      ))}
    </>
  );
});

/**
 * Fixed background starfield, masked to the area outside the wheel and faded out as
 * the theme brightens. `opacity` and `maskImage` change per frame in Auto/Now, but the
 * 160 stars are memoized so only the wrapping <svg> reconciles.
 */
export function StarLayer({
  opacity, maskImage, maskComposite,
}: { opacity: number; maskImage?: string; maskComposite?: string }) {
  // Two Compare wheels need two mask holes -> two gradients composited with "intersect"
  // (legacy WebKit keyword: "source-in"). Single wheel passes no composite (one layer).
  const webkitComposite = maskComposite === "intersect" ? "source-in" : undefined;
  return (
    <svg
      className="ac-starfield"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      aria-hidden
      style={{ opacity, WebkitMaskImage: maskImage, maskImage, WebkitMaskComposite: webkitComposite, maskComposite }}
    >
      <Stars />
    </svg>
  );
}
