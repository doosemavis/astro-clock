import { memo } from "react";

/**
 * Daytime clouds — the light-theme counterpart to the starfield. A soft, translucent
 * fractal-noise texture (SVG feTurbulence) that fades in as the theme brightens
 * (opacity = themeT), so stars cross-fade into clouds at dawn. No JS randomness, so it
 * is SSR-stable; masked to the sky around the wheel, like the stars. Not drawn at night.
 */
function CloudLayerBase({
  opacity, maskImage, maskComposite,
}: { opacity: number; maskImage?: string; maskComposite?: string }) {
  if (opacity <= 0.001) return null;
  const webkitComposite = maskComposite === "intersect" ? "source-in" : undefined;
  return (
    <svg className="ac-clouds" aria-hidden style={{ opacity, WebkitMaskImage: maskImage, maskImage, WebkitMaskComposite: webkitComposite, maskComposite }}>
      <defs>
        <filter id="ac-cloud-filter" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0075 0.012"
            numOctaves={4}
            seed={11}
            stitchTiles="stitch"
            result="noise"
          />
          {/* Force RGB to white; carry the noise through as alpha. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 1 0"
            result="white"
          />
          {/* Carve the even noise into distinct translucent puffs with clear-sky gaps:
              low noise -> transparent, high noise -> soft white (capped ~0.6). */}
          <feComponentTransfer in="white" result="puffs">
            <feFuncA type="table" tableValues="0 0 0 0.25 0.5 0.6" />
          </feComponentTransfer>
          <feGaussianBlur in="puffs" stdDeviation={5} />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#ac-cloud-filter)" />
    </svg>
  );
}

export const CloudLayer = memo(CloudLayerBase);
