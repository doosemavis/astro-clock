import { memo } from "react";
import type { ReactNode } from "react";
import { R, CX, CY, polar, arcPath, SIGNS } from "@astro/engine";

// Round SVG coordinates to 2 decimals so the server (Node) and client (V8) emit
// byte-identical strings — raw float math differs in the last digit between the two,
// which React flags as a hydration mismatch.
const q = (n: number) => Math.round(n * 100) / 100;

// Curved sign label: an invisible arc path the text rides along. Labels in the top
// half read left-to-right along the inside of the ring; bottom half flips sweep so
// they stay upright (prototype buildDial).
function signArc(s: number): string {
  const lonC = s * 30 + 15;
  const [, ly] = polar(R.signLabel, lonC);
  const span = 28;
  return ly < CY
    ? arcPath(R.signLabel, lonC + span / 2, lonC - span / 2, 1)
    : arcPath(R.signLabel, lonC - span / 2, lonC + span / 2, 0);
}

function DialBase() {
  const ticks: ReactNode[] = [];
  for (let t = 0; t < 360; t += 5) {
    if (t % 30 === 0) continue; // sign boundaries are drawn separately
    const [x1, y1] = polar(R.signInner, t);
    const [x2, y2] = polar(R.signInner - 8, t);
    ticks.push(<line key={`t${t}`} className="s-tick" x1={q(x1)} y1={q(y1)} x2={q(x2)} y2={q(y2)} strokeWidth={1} opacity={0.42} />);
  }

  const defs: ReactNode[] = [];
  const bounds: ReactNode[] = [];
  const labels: ReactNode[] = [];
  for (let s = 0; s < 12; s++) {
    const [ox, oy] = polar(R.outer, s * 30);
    const [ix, iy] = polar(R.signInner, s * 30);
    bounds.push(<line key={`b${s}`} className="s-bound" x1={q(ix)} y1={q(iy)} x2={q(ox)} y2={q(oy)} strokeWidth={1.5} opacity={0.55} />);
    const id = `acSignArc${s}`;
    defs.push(<path key={`p${s}`} id={id} d={signArc(s)} fill="none" stroke="none" />);
    labels.push(
      <text key={`l${s}`} className="s-sign" textAnchor="middle" dominantBaseline="central" fontSize={17} letterSpacing={2.5}>
        <textPath href={`#${id}`} startOffset="50%">{SIGNS[s].toUpperCase()}</textPath>
      </text>,
    );
  }

  return (
    <g>
      <defs>{defs}</defs>
      <circle className="s-ring" cx={CX} cy={CY} r={R.outer} strokeWidth={1.5} opacity={0.6} />
      <circle className="s-ring" cx={CX} cy={CY} r={R.signInner} strokeWidth={1.5} opacity={0.6} />
      <circle className="s-ring" cx={CX} cy={CY} r={R.liveRing} strokeWidth={1} opacity={0.32} />
      {ticks}
      {bounds}
      {labels}
    </g>
  );
}

/** The zodiac ring: rings, minor ticks, sign boundaries, curved sign labels. Static. */
export const Dial = memo(DialBase);
