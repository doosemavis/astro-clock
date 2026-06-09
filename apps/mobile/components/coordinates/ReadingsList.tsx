import { useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { buildReadingRows } from "../../lib/readingRows";
import { ProLockSheet } from "../ProLockSheet";

interface Props {
  natalPos: Positions;
  ascLon: number;
  isPro: boolean;
}

/** Scrollable list of natal sign reading rows (teaser / locked / coming-soon). */
export function ReadingsList({ natalPos, ascLon, isPro }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [proSheetVisible, setProSheetVisible] = useState(false);
  const rows = useMemo(() => buildReadingRows(natalPos, ascLon, isPro), [natalPos, ascLon, isPro]);

  return (
    <>
      <ScrollView style={s.body} contentContainerStyle={s.scroll}>
        {rows.map((row) => {
          if (row.state === "teaser") {
            return (
              <View key={row.key} style={s.row}>
                <Text style={s.title}>{row.title}</Text>
                {row.summary ? <Text style={s.summary}>{row.summary}</Text> : null}
              </View>
            );
          }
          if (row.state === "locked") {
            return (
              <Pressable key={row.key} style={s.row} onPress={() => setProSheetVisible(true)}
                accessibilityRole="button" accessibilityLabel={`${row.title} — Pro feature`}>
                <View style={s.lockedRow}>
                  <Text style={s.title}>{row.title}</Text>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>🔒 Pro</Text>
                  </View>
                </View>
              </Pressable>
            );
          }
          // comingSoon
          return (
            <View key={row.key} style={s.row}>
              <Text style={s.title}>{row.title}</Text>
              <Text style={s.comingSoon}>Full reading coming soon</Text>
            </View>
          );
        })}
      </ScrollView>
      <ProLockSheet visible={proSheetVisible} onClose={() => setProSheetVisible(false)} />
    </>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  body: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 12 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border },
  lockedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: p.text, fontSize: 15, fontWeight: "700" },
  summary: { color: p.textDim, fontSize: 13, lineHeight: 19, marginTop: 4 },
  comingSoon: { color: p.textDim, fontSize: 13, marginTop: 4 },
  badge: { backgroundColor: p.panel, borderWidth: 1, borderColor: p.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: p.textDim, fontSize: 12, fontWeight: "600" },
});
