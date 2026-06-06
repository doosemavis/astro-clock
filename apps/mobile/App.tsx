import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, ToastAndroid, useWindowDimensions, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf, mixPalette, solarT, PLANET_KEYS, SIGN_GLYPH } from "@astro/engine";
import type { BirthData, Palette, Sign, PlanetKey } from "@astro/engine";
import { GLYPH_FONT, CHART } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { CompareView } from "./components/chart/CompareView";
import { Sky } from "./components/chart/Sky";
import { ChartControls } from "./components/chart/ChartControls";
import { RangeHud } from "./components/chart/RangeHud";
import { BottomSheet, SHEET_COLLAPSED_HEIGHT } from "./components/BottomSheet";
import { BirthForm } from "./components/BirthForm";
import { useChartClock } from "./hooks/useChartClock";
import { ThemeProvider } from "./lib/theme";
import { Avatar } from "./components/Avatar";
import { CoordinatesButton } from "./components/CoordinatesButton";
import { CoordinatesPanel } from "./components/coordinates/CoordinatesPanel";
import { AuthProvider, useAuth } from "./lib/auth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AccountView } from "./components/auth/AccountView";
import { HeaderMenu } from "./components/HeaderMenu";
import { allVisible, toggleVis } from "./lib/chartModel";
import type { Mode, TimeFormat, ThemeMode, Vis, Layer } from "./lib/chartModel";
import { fmtDate, fmtTime, readoutTz, cmpCaption } from "./lib/readout";
import { loadBirth, saveBirth } from "./lib/birthStore";
import { useEntitlement } from "./hooks/useEntitlement";
import { SignInPrompt } from "./components/SignInPrompt";
import { tierOf } from "./lib/entitlement";
import { clampMode } from "./lib/proMode";
import { ExportCard, EXPORT_WIDTH, exportHeight } from "./components/export/ExportCard";
import { canShare as canShareFor, canToggleLogo as canToggleLogoFor, showLogo as showLogoFor } from "./lib/exportPolicy";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting } from "./lib/exportSettings";
import type { ExportSettings, ExportToggleKey } from "./lib/exportSettings";
import { loadExportSettings, saveExportSettings } from "./lib/exportSettingsStore";
import { saveChartImage, shareChartImage } from "./lib/saveChart";
import { presentProPaywall } from "./lib/purchases";

const MODE_LABEL: Record<Mode, string> = { birth: "Birth", now: "Now", moment: "Date", range: "Range", compare: "Compare" };

// Quantize the Auto theme value so the palette only re-blends ~50x across a day (not every
// frame in Auto+Range), which bounds re-renders/style recreation.
const quantize = (x: number) => Math.round(x * 50) / 50;

function AppInner() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const { width, height } = useWindowDimensions();
  const wheelSize = Math.max(0, Math.min(width, height) - CHART.wheelPadding);

  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);
  const { session } = useAuth();
  const { isPro } = useEntitlement(session);
  const tier = tierOf(!!session, isPro);
  const anonymous = tier === "anonymous";
  const [authView, setAuthView] = useState<null | "login" | "account">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [showMajor, setShowMajor] = useState(true);
  const [showMinor, setShowMinor] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [vis, setVis] = useState<Vis>(() => ({ natal: allVisible(PLANET_KEYS), live: allVisible(PLANET_KEYS) }));
  const onToggleVis = (key: PlanetKey | "all", layer: Layer) => setVis((v) => toggleVis(v, key, layer));

  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [exportReq, setExportReq] = useState<null | "save" | "share">(null);
  const exportRef = useRef<View | null>(null);

  // Load persisted export toggles on launch.
  useEffect(() => {
    let active = true;
    loadExportSettings().then((s) => { if (active) setExportSettings(s); });
    return () => { active = false; };
  }, []);

  const onToggleExport = (key: ExportToggleKey) => {
    setExportSettings((s) => {
      const next = toggleSetting(s, key);
      saveExportSettings(next).catch(() => { /* cache only */ });
      return next;
    });
  };

  // When an export is requested, the off-screen ExportCard renders; wait two frames for
  // layout, capture it, then save or share. Clear the request when done.
  useEffect(() => {
    if (!exportReq) return;
    let cancelled = false;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (cancelled) return;
        const result = exportReq === "save"
          ? await saveChartImage(exportRef)
          : await shareChartImage(exportRef);
        if (cancelled) return;
        if (result.ok && exportReq === "save") {
          if (Platform.OS === "android") ToastAndroid.show("Saved to Photos", ToastAndroid.SHORT);
        } else if (!result.ok && result.reason === "permission") {
          Alert.alert("Photo access needed", "Allow photo access in Settings to save charts.");
        } else if (!result.ok) {
          Alert.alert("Couldn't save", "Something went wrong. Please try again.");
        }
        setExportReq(null);
      }),
    );
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [exportReq]);

  // Load the saved birth on launch (falls back to DEFAULT_BIRTH).
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => { if (active && b) setBirth(b); });
    return () => { active = false; };
  }, []);

  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const clock = useChartClock(birthMs, birth);
  const livePos = useMemo(() => positions(clock.displayInstant), [clock.displayInstant]);

  // Anonymous users only get the Now view.
  useEffect(() => {
    if (anonymous) clock.setMode("now");
  }, [anonymous, clock.setMode]);

  // Lost-Pro clamp: if entitlement drops while in a Pro mode, snap back; drop Glyph customization.
  useEffect(() => {
    if (anonymous) return; // anonymous is already handled above
    const clamped = clampMode(clock.mode, isPro);
    if (clamped !== clock.mode) clock.setMode(clamped);
    if (!isPro) setVis({ natal: allVisible(PLANET_KEYS), live: allVisible(PLANET_KEYS) });
  }, [isPro, anonymous, clock.mode, clock.setMode]);
  const compareAPos = useMemo(() => positions(new Date(clock.compareAMs)), [clock.compareAMs]);
  const compareBPos = useMemo(() => positions(new Date(clock.compareBMs)), [clock.compareBMs]);
  const cmpA = cmpCaption(clock.compareA, timeFormat);
  const cmpB = cmpCaption(clock.compareB, timeFormat);

  // Theme: light=1 / dark=0 / auto=Sun altitude at the displayed moment (birth location).
  const themeT = useMemo(() => {
    if (themeMode === "light") return 1;
    if (themeMode === "dark") return 0;
    const inst = clock.mode === "compare" ? new Date(clock.compareAMs) : clock.displayInstant;
    return quantize(solarT(inst, birth.lat, birth.lon));
  }, [themeMode, clock.mode, clock.displayInstant, clock.compareAMs, birth.lat, birth.lon]);
  const palette = useMemo(() => mixPalette(themeT), [themeT]);
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // The chart's signature: Sun / Moon / Ascendant signs (mirrors the web bigThree).
  const bigThree = useMemo(() => {
    if (anonymous) {
      // Pre-birth placeholder: the current sky's Sun + Moon, tracking the Now moment.
      // No Ascendant — it needs a birth time + place, which unlocks on sign-in.
      return `☉ ${signOf(livePos.sun)}   ☽ ${signOf(livePos.moon)}`;
    }
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}   ☽ ${signOf(natalPos.moon)}   ↑ ${signOf(asc)}`;
  }, [anonymous, livePos, birthMs, birth.lat, birth.lon, natalPos]);

  // The header avatar's glyph: the current sky's Sun sign when signed out (tracks Now),
  // the user's birth Sun sign once signed in.
  const sunGlyph = SIGN_GLYPH[signOf(anonymous ? livePos.sun : natalPos.sun) as Sign];

  // Persistent readout of the moment on screen — which view + when (fixed vs. moveable).
  const moment =
    `${MODE_LABEL[clock.mode]}  ·  ${fmtDate(clock.displayInstant, clock.mode, birth)}  ·  ${fmtTime(clock.displayInstant, clock.mode, birth, timeFormat, clock.mode === "now")}  ${readoutTz(clock.displayInstant, clock.mode, birth)}`;

  function onSave(b: BirthData) {
    setBirth(b);
    saveBirth(b).catch(() => { /* local cache only; ignore write errors */ });
    setEditing(false);
  }

  return (
    <ThemeProvider value={{ t: themeT, palette }}>
      <View style={styles.root}>
      <Sky themeT={themeT} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>MoveStar</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => setMenuOpen(true)} style={styles.editBtn} hitSlop={8}>
              <Avatar glyph={sunGlyph} />
            </Pressable>
            <CoordinatesButton onPress={() => { if (isPro) setCoordsOpen(true); else void presentProPaywall(); }} />
          </View>
        </View>
      </View>

      {clock.mode === "compare" ? (
        fontsLoaded ? (
          <CompareView
            a={{ caption: "Chart A", sub: cmpA, pos: compareAPos }}
            b={{ caption: "Chart B", sub: cmpB, pos: compareBPos }}
            view={clock.compareView}
            showMajor={showMajor}
            showMinor={showMinor}
            vis={vis.live}
          />
        ) : (
          <View style={styles.stage}><Text style={styles.note}>loading…</Text></View>
        )
      ) : (
        <View style={styles.stage}>
          <Text style={styles.moment}>{moment}</Text>
          <Text style={styles.bigThree}>{bigThree}</Text>
          <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
            {fontsLoaded
              ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} vis={vis} showNatal={!anonymous} />
              : <Text style={styles.note}>loading…</Text>}
          </View>
          {anonymous ? <SignInPrompt onPress={() => setAuthView("login")} /> : null}
        </View>
      )}

      {clock.mode === "range" && !sheetExpanded ? <RangeHud clock={clock} /> : null}

      {session ? (
        <BottomSheet onExpandedChange={setSheetExpanded}>
          <ChartControls
            clock={clock}
            isPro={isPro}
            timeFormat={timeFormat}
            onTimeFormat={setTimeFormat}
            themeMode={themeMode}
            onTheme={setThemeMode}
            showMajor={showMajor}
            onToggleMajor={() => setShowMajor((v) => !v)}
            showMinor={showMinor}
            onToggleMinor={() => setShowMinor((v) => !v)}
            vis={vis}
            onToggleVis={onToggleVis}
          />
        </BottomSheet>
      ) : null}

      <BirthForm visible={editing} initial={birth} onSave={onSave} onCancel={() => setEditing(false)} timeFormat={timeFormat} />
      <HeaderMenu
        visible={menuOpen}
        signedIn={!!session}
        // Share temporarily disabled for release: it opens the camera instead of the native
        // share sheet (expo-sharing). Re-enable with `canShareFor(tier)` once that's fixed.
        canShare={false && canShareFor(tier)}
        onClose={() => setMenuOpen(false)}
        onAuth={() => { setMenuOpen(false); setAuthView(session ? "account" : "login"); }}
        onEditBirth={() => { setMenuOpen(false); setEditing(true); }}
        onSave={() => { setMenuOpen(false); setExportReq("save"); }}
        onShare={() => { setMenuOpen(false); setExportReq("share"); }}
        exportSettings={exportSettings}
        onToggleExport={onToggleExport}
        canToggleLogo={canToggleLogoFor(tier)}
      />
      <CoordinatesPanel
        visible={coordsOpen}
        onClose={() => setCoordsOpen(false)}
        natalPos={anonymous ? null : natalPos}
        livePos={livePos}
      />
      <LoginScreen visible={authView === "login"} onClose={() => setAuthView(null)} />
      <AccountView visible={authView === "account"} onClose={() => setAuthView(null)} />
      {exportReq ? (
        <View ref={exportRef} collapsable={false} style={[styles.exportHost, { width: EXPORT_WIDTH, height: exportHeight(width, height) }]}>
          <ExportCard
            showLogo={showLogoFor(tier, exportSettings.logo)}
            toggles={exportSettings}
            palette={palette}
            themeT={themeT}
            natalPositions={natalPos}
            livePositions={livePos}
            showNatal={!anonymous}
            showMajor={showMajor}
            showMinor={showMinor}
            vis={vis}
            caption={bigThree}
            dateText={moment}
            compare={clock.mode === "compare"
              ? { aPos: compareAPos, bPos: compareBPos, aSub: cmpA, bSub: cmpB }
              : undefined}
          />
        </View>
      ) : null}
      <StatusBar style="light" />
      </View>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerRight: { alignItems: "flex-end", gap: 8 },
  brand: { color: p.text, fontSize: 24, letterSpacing: 4, fontWeight: "600" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingLeft: 12 },
  bigThree: { color: p.textDim, fontSize: 14, letterSpacing: 1, textAlign: "center", marginBottom: 12 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  wheelBox: { alignItems: "center", justifyContent: "center" },
  // Sits directly above the wheel with a 12px gap — never overlaps the circle.
  moment: {
    color: p.text, fontSize: 13, letterSpacing: 0.5, textAlign: "center",
    // Tabular figures: every digit is the same width, so the ticking seconds never
    // resize or re-center the pill — only the seconds glyphs change in place.
    fontVariant: ["tabular-nums"],
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, overflow: "hidden",
    marginBottom: 8,
  },
  note: { color: p.textDim, fontSize: 13, letterSpacing: 2 },
  exportHost: { position: "absolute", left: -100000, top: 0 },
});
