import { StyleSheet, Text, View } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import type { Vis } from "../../lib/chartModel";
import type { Framing } from "../../lib/exportPolicy";
import type { ExportSettings } from "../../lib/exportSettings";
import { ThemeProvider } from "../../lib/theme";
import { ChartWheel } from "../chart/ChartWheel";
import { CompareWheel } from "../chart/CompareWheel";
import { Sky } from "../chart/Sky";

/** Square export resolution (px). 1080 = clean for social. */
export const EXPORT_SIZE = 1080;

export interface ExportCardProps {
  framing: Framing;
  toggles: ExportSettings;
  palette: Palette;
  themeT: number;
  natalPositions: Positions;
  livePositions: Positions;
  showNatal: boolean;
  showMajor: boolean;
  showMinor: boolean;
  vis: Vis;
  /** Pre-built strings from App (e.g. "☉ Leo  ☽ Aries  ↑ Libra"). */
  caption: string;
  /** e.g. "Birth · Jul 29, 1992 · 2:28pm". */
  dateText: string;
  /** e.g. "Jonesboro, AR". */
  placeLabel?: string;
  /** When set, render the Compare pair instead of the single natal/live wheel. */
  compare?: {
    aPos: Positions;
    bPos: Positions;
    aSub: string;
    bSub: string;
  };
}

// Each CompareWheel in export mode: card minus wordmark/footer/gaps split across 2 wheels.
const COMPARE_WHEEL_SIZE = Math.floor((EXPORT_SIZE - 320) / 2);

/** A fixed-size composed chart image. `branded` adds the MoveStar wordmark + footer;
 *  `clean` (Pro) omits all branding. Overlay text obeys `toggles`.
 *  When `compare` is provided, renders both Compare wheels stacked vertically. */
export function ExportCard({
  framing, toggles, palette: p, themeT,
  natalPositions, livePositions, showNatal, showMajor, showMinor, vis,
  caption, dateText, placeLabel, compare,
}: ExportCardProps) {
  const branded = framing === "branded";
  const wheel = EXPORT_SIZE - 260; // leave room for wordmark/caption/labels/footer

  return (
    <ThemeProvider value={{ t: themeT, palette: p }}>
      <View style={[styles.card, { width: EXPORT_SIZE, height: EXPORT_SIZE, backgroundColor: p.bg }]}>
        {toggles.cosmicBackground ? <Sky themeT={themeT} /> : null}
        {branded ? <Text style={[styles.wordmark, { color: p.text }]}>MOVESTAR</Text> : null}

        {compare ? (
          // Compare mode: two wheels stacked vertically, each with its sub-caption pill.
          <View style={styles.compareStage}>
            <CompareWheel
              idPrefix="export-a-"
              caption="Chart A"
              subCaption={compare.aSub}
              size={COMPARE_WHEEL_SIZE}
              pos={compare.aPos}
              showMajor={showMajor}
              showMinor={showMinor}
              vis={vis.live}
            />
            <View style={styles.compareDivider} />
            <CompareWheel
              idPrefix="export-b-"
              caption="Chart B"
              subCaption={compare.bSub}
              size={COMPARE_WHEEL_SIZE}
              pos={compare.bPos}
              showMajor={showMajor}
              showMinor={showMinor}
              vis={vis.live}
            />
          </View>
        ) : (
          // Single-wheel mode (natal / live).
          <View style={styles.stage}>
            {toggles.caption ? <Text style={[styles.caption, { color: p.textDim }]}>{caption}</Text> : null}
            <View style={{ width: wheel, height: wheel }}>
              <ChartWheel
                size={wheel}
                natalPositions={natalPositions}
                livePositions={livePositions}
                showNatal={showNatal}
                showMajor={showMajor}
                showMinor={showMinor}
                vis={vis}
              />
            </View>
            {toggles.dateTime ? <Text style={[styles.date, { color: p.text }]}>{dateText}</Text> : null}
            {toggles.placeLabel && placeLabel ? (
              <Text style={[styles.place, { color: p.textDim }]}>{placeLabel}</Text>
            ) : null}
          </View>
        )}

        {branded ? <Text style={[styles.footer, { color: p.textDim }]}>movestar.app</Text> : null}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", alignItems: "center", justifyContent: "space-between", paddingVertical: 48 },
  wordmark: { fontSize: 40, letterSpacing: 10, fontWeight: "700" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: { fontSize: 30, letterSpacing: 1.5, marginBottom: 18, textAlign: "center" },
  date: { fontSize: 28, letterSpacing: 0.5, marginTop: 18, textAlign: "center" },
  place: { fontSize: 24, marginTop: 6, textAlign: "center" },
  footer: { fontSize: 22, letterSpacing: 2, opacity: 0.8 },
  // Compare mode: center both wheels vertically with a small gap between them.
  compareStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  compareDivider: { height: 20 },
});
