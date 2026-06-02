import { memo } from "react";
import type { ReactElement } from "react";
import { G, Circle, Line, Path, Text as SvgText, TextPath, Defs } from "react-native-svg";
import { R, CX, CY, polar, arcPath, SIGNS } from "@astro/engine";
import { CHART } from "./palette";
import { useTheme } from "../../lib/theme";

// Round to 2 decimals to keep path strings short and stable.
const q = (n: number) => Math.round(n * 100) / 100;

// Curved sign label arc: top-half labels ride left-to-right; bottom-half flip the sweep so
// the text stays upright (mirrors the web signArc / prototype buildDial).
function signArc(s: number): string {
  const lonC = s * 30 + 15;
  const [, ly] = polar(R.signLabel, lonC);
  const span = CHART.signSpan;
  return ly < CY
    ? arcPath(R.signLabel, lonC + span / 2, lonC - span / 2, 1)
    : arcPath(R.signLabel, lonC - span / 2, lonC + span / 2, 0);
}

interface Props {
  curvedLabels?: boolean;
  idPrefix?: string;
}

function DialBase({ curvedLabels = true, idPrefix = "" }: Props) {
  const { palette: p } = useTheme();
  const ticks: ReactElement[] = [];
  for (let t = 0; t < 360; t += 5) {
    if (t % 30 === 0) continue; // sign boundaries drawn separately
    const [x1, y1] = polar(R.signInner, t);
    const [x2, y2] = polar(R.signInner - CHART.tickLength, t);
    ticks.push(
      <Line
        key={`t${t}`}
        x1={q(x1)} y1={q(y1)} x2={q(x2)} y2={q(y2)}
        stroke={p.line} strokeWidth={CHART.tickStroke} opacity={CHART.tickOpacity}
      />,
    );
  }

  const defs: ReactElement[] = [];
  const bounds: ReactElement[] = [];
  const labels: ReactElement[] = [];
  for (let s = 0; s < 12; s++) {
    const [ox, oy] = polar(R.outer, s * 30);
    const [ix, iy] = polar(R.signInner, s * 30);
    bounds.push(
      <Line
        key={`b${s}`}
        x1={q(ix)} y1={q(iy)} x2={q(ox)} y2={q(oy)}
        stroke={p.line} strokeWidth={CHART.boundStroke} opacity={CHART.boundOpacity}
      />,
    );

    const label = SIGNS[s].toUpperCase();
    if (curvedLabels) {
      const id = `${idPrefix}acSignArc${s}`;
      defs.push(<Path key={`p${s}`} id={id} d={signArc(s)} fill="none" stroke="none" />);
      labels.push(
        <SvgText
          key={`l${s}`}
          fill={p.sign}
          fontWeight="600"
          fontSize={CHART.signFontSize}
          letterSpacing={CHART.signLetterSpacing}
          textAnchor="middle"
          alignmentBaseline="central"
        >
          <TextPath href={`#${id}`} startOffset="50%">{label}</TextPath>
        </SvgText>,
      );
    } else {
      // Horizontal fallback: upright label at the sign's mid-angle. Reliable on every
      // platform; used only if curved TextPath renders poorly on the device.
      const lonC = s * 30 + 15;
      const [lx, ly] = polar(R.signLabel, lonC);
      labels.push(
        <SvgText
          key={`l${s}`}
          x={q(lx)} y={q(ly)}
          fill={p.sign}
          fontWeight="600"
          fontSize={CHART.signFontSize}
          textAnchor="middle"
          dy={CHART.signFontSize * 0.35}
        >
          {label}
        </SvgText>,
      );
    }
  }

  return (
    <G>
      <Defs>{defs}</Defs>
      <Circle cx={CX} cy={CY} r={R.outer} fill="none" stroke={p.line} strokeWidth={CHART.ringStroke} opacity={CHART.ringOpacity} />
      <Circle cx={CX} cy={CY} r={R.signInner} fill="none" stroke={p.line} strokeWidth={CHART.ringStroke} opacity={CHART.ringOpacity} />
      <Circle cx={CX} cy={CY} r={R.liveRing} fill="none" stroke={p.line} strokeWidth={CHART.tickStroke} opacity={CHART.liveRingOpacity} />
      {ticks}
      {bounds}
      {labels}
    </G>
  );
}

/** The zodiac ring: rings, minor ticks, sign boundaries, sign labels. Static. */
export const Dial = memo(DialBase);
