import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DEFAULT_BIRTH, birthInstant, positions } from "@astro/engine";
import type { Positions } from "@astro/engine";
import type { DemoKind } from "../../lib/onboarding";
import { ChartWheel } from "../chart/ChartWheel";

const SAMPLE_NATAL: Positions = positions(birthInstant(DEFAULT_BIRTH));
const SWEEP_START = birthInstant(DEFAULT_BIRTH).getTime();
const SWEEP_SPAN_MS = 365 * 24 * 3600 * 1000;   // loop over one year
const SWEEP_STEP_MS = 48 * 3600 * 1000;          // +48h per tick → planets visibly move
const SWEEP_INTERVAL = 90;                        // ms between ticks (~11 fps)

/** A small animated ChartWheel demoing one feature for the onboarding walkthrough. */
export function OnboardingDemo({ kind, size }: { kind: DemoKind; size: number }) {
  const [liveMs, setLiveMs] = useState(() => Date.now());
  const [sweepMs, setSweepMs] = useState(SWEEP_START);

  useEffect(() => {
    if (kind === "live") {
      const id = setInterval(() => setLiveMs(Date.now()), 1000);
      return () => clearInterval(id);
    }
    if (kind === "timetravel") {
      const id = setInterval(
        () => setSweepMs((ms) => SWEEP_START + ((ms - SWEEP_START + SWEEP_STEP_MS) % SWEEP_SPAN_MS)),
        SWEEP_INTERVAL,
      );
      return () => clearInterval(id);
    }
    return undefined; // "natal": static
  }, [kind]);

  const livePos = useMemo(() => {
    if (kind === "live") return positions(new Date(liveMs));
    if (kind === "timetravel") return positions(new Date(sweepMs));
    return SAMPLE_NATAL; // natal
  }, [kind, liveMs, sweepMs]);

  return (
    <View style={{ width: size, height: size }}>
      <ChartWheel
        size={size}
        natalPositions={SAMPLE_NATAL}
        livePositions={livePos}
        showNatal={kind === "natal"}
        showMajor
        showMinor={false}
      />
    </View>
  );
}
