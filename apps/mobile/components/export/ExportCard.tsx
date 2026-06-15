import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import type { Vis } from "../../lib/chartModel";
import { ThemeProvider } from "../../lib/theme";
import { ChartWheel } from "../chart/ChartWheel";
import { CompareWheel } from "../chart/CompareWheel";
import { Sky } from "../chart/Sky";

/** Export image width in px. Height matches the device screen aspect (see `exportHeight`) so
 *  the saved image works as a phone wallpaper — full-bleed, no letterboxing. */
export const EXPORT_WIDTH = 1080;

/** Portrait export height for a given screen, matching its aspect ratio. */
export function exportHeight(screenW: number, screenH: number): number {
  if (!screenW || !screenH) return Math.round(EXPORT_WIDTH * (16 / 9));
  return Math.round(EXPORT_WIDTH * (screenH / screenW));
}

export interface ExportCardProps {
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
  /** When set, render the Compare pair instead of the single natal/live wheel. */
  compare?: {
    aPos: Positions;
    bPos: Positions;
    aSub: string;
    bSub: string;
  };
}

const COMPARE_WHEEL_SIZE = Math.floor((EXPORT_WIDTH - 360) / 2);

/** A full-height (screen-aspect) composed chart image for saving/sharing — designed to double
 *  as a wallpaper. The chart + labels sit as a centered cluster over the cosmic background, which
 *  fills the whole frame. `branded` adds the MoveStar wordmark + footer; `clean` (Pro) omits them.
 *  Overlay text obeys `toggles`. */
export function ExportCard({
  palette: p, themeT,
  natalPositions, livePositions, showNatal, showMajor, showMinor, vis,
  caption, dateText, compare,
}: ExportCardProps) {
  const { width: sw, height: sh } = useWindowDimensions();
  const height = exportHeight(sw, sh);
  const wheel = EXPORT_WIDTH - 120; // width-constrained; the tall frame has vertical room to spare

  return (
    <ThemeProvider value={{ t: themeT, palette: p }}>
      <View style={[styles.card, { width: EXPORT_WIDTH, height, backgroundColor: p.bg }]}>
        <Sky themeT={themeT} width={EXPORT_WIDTH} height={height} />

        <View style={styles.content}>
          {/* Brand lockup: MOVESTAR is the wordmark; the tagline rides below it (the tall
              export frame always has the vertical room for it). */}
          <View style={styles.brand}>
            <Text style={[styles.wordmark, { color: p.text }]}>MOVESTAR</Text>
            <Text style={[styles.tagline, { color: p.textDim }]}>Live Birth Chart</Text>
          </View>

          {compare ? (
            // Compare mode: two wheels stacked vertically, each with its sub-caption pill.
            <View style={styles.compareStage}>
              <CompareWheel
                idPrefix="export-a-" caption="Chart A" subCaption={compare.aSub}
                size={COMPARE_WHEEL_SIZE} pos={compare.aPos}
                showMajor={showMajor} showMinor={showMinor} vis={vis.live}
              />
              <View style={styles.compareDivider} />
              <CompareWheel
                idPrefix="export-b-" caption="Chart B" subCaption={compare.bSub}
                size={COMPARE_WHEEL_SIZE} pos={compare.bPos}
                showMajor={showMajor} showMinor={showMinor} vis={vis.live}
              />
            </View>
          ) : (
            <>
              <Text style={[styles.caption, { color: p.textDim }]}>{caption}</Text>
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
              <Text style={[styles.date, { color: p.text }]}>{dateText}</Text>
            </>
          )}

          <Text style={[styles.footer, { color: p.textDim }]}>movestar.app</Text>
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  // Full-bleed frame; the content cluster is centered, so the starfield fills above and below it.
  card: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  brand: { alignItems: "center", marginBottom: 30 },
  wordmark: { fontSize: 44, letterSpacing: 12, fontWeight: "700" },
  tagline: { fontSize: 22, letterSpacing: 4, fontWeight: "500", marginTop: 10 },
  caption: { fontSize: 32, letterSpacing: 1.5, marginBottom: 24, textAlign: "center" },
  date: { fontSize: 28, letterSpacing: 0.5, marginTop: 26, textAlign: "center" },
  footer: { fontSize: 22, letterSpacing: 2, opacity: 0.8, marginTop: 34 },
  compareStage: { alignItems: "center", justifyContent: "center" },
  compareDivider: { height: 24 },
});
