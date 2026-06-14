import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, ToastAndroid, useColorScheme, useWindowDimensions, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf, mixPalette, PLANET_KEYS, SIGN_GLYPH } from "@astro/engine";
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
import { themeTForMode } from "./lib/themeMode";
import { loadThemeMode, saveThemeMode } from "./lib/themeStorage";
import { fmtDate, fmtTime, readoutTz, cmpCaption } from "./lib/readout";
import { loadBirth, saveBirth } from "./lib/birthStore";
import { useEntitlement } from "./hooks/useEntitlement";
import { SignInPrompt } from "./components/SignInPrompt";
import { tierOf } from "./lib/entitlement";
import { clampMode, coordinatesLocked } from "./lib/proMode";
import { ExportCard, EXPORT_WIDTH, exportHeight } from "./components/export/ExportCard";
import { canShare as canShareFor, canToggleLogo as canToggleLogoFor, showLogo as showLogoFor, canSave as canSaveFor } from "./lib/exportPolicy";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting } from "./lib/exportSettings";
import type { ExportSettings, ExportToggleKey } from "./lib/exportSettings";
import { loadExportSettings, saveExportSettings } from "./lib/exportSettingsStore";
import { saveChartImage, shareChartImage } from "./lib/saveChart";
import { presentProPaywall } from "./lib/purchases";

const MODE_LABEL: Record<Mode, string> = { birth: "Birth", now: "Now", moment: "Date", range: "Range", compare: "Compare" };

/** The chart Name counts as "unset" when empty or still the DEFAULT_BIRTH placeholder — only
 *  then does the account name fill it as a default (a user-edited name is never overwritten). */
const isDefaultName = (n?: string): boolean => !n || n === DEFAULT_BIRTH.name;

// Quantize the Auto theme value so the palette only re-blends ~50x across a day (not every
// frame in Auto+Range), which bounds re-renders/style recreation.

function AppInner() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const { width, height } = useWindowDimensions();
  const wheelSize = Math.max(0, Math.min(width, height) - CHART.wheelPadding);

  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);
  const { session, user } = useAuth();
  const { isPro } = useEntitlement(session);
  const tier = tierOf(!!session, isPro);
  const anonymous = tier === "anonymous";
  // Account display name (user_metadata.name); used to default the chart's Name. A ref holds
  // the latest value so the launch loader can apply it without a stale closure.
  const accountName = (user?.user_metadata?.name as string | undefined)?.trim() ?? "";
  const accountNameRef = useRef(accountName);
  accountNameRef.current = accountName;
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

  // Load persisted theme on launch.
  useEffect(() => {
    let active = true;
    loadThemeMode().then((m) => { if (active) setThemeMode(m); });
    return () => { active = false; };
  }, []);
  // Change + persist the theme. Saving in the handler (not a value-effect) avoids clobbering
  // the just-loaded value on mount.
  const onThemeChange = (m: ThemeMode) => { setThemeMode(m); void saveThemeMode(m); };

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
    loadBirth().then((b) => { if (active && b) setBirth({ ...b, name: isDefaultName(b.name) ? (accountNameRef.current || b.name) : b.name }); });
    return () => { active = false; };
  }, []);

  // account → chart: the account name fills the chart's Name only as a default (when unset),
  // so a user-edited chart Name is never overwritten.
  useEffect(() => {
    if (!accountName) return;
    setBirth((prev) => (isDefaultName(prev.name) ? { ...prev, name: accountName } : prev));
  }, [accountName]);

  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const natalAsc = useMemo(() => ascendant(new Date(birthMs), birth.lat, birth.lon), [birthMs, birth.lat, birth.lon]);
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

  // The coordinates panel's two value columns are mode-dependent:
  //   birth/now/date → Fixed = natal, Moveable = live (transit)
  //   range          → From  = range start,  To = range end
  //   compare        → Chart A = compareA,   Chart B = compareB
  const rangeFromPos = useMemo(() => positions(new Date(clock.rangeStartMs)), [clock.rangeStartMs]);
  const rangeToPos = useMemo(() => positions(new Date(clock.rangeEndMs)), [clock.rangeEndMs]);
  // The panel's "Now" column needs the live sky even in Birth mode, where the chart's own
  // displayInstant is frozen at the birth instant — so tick a dedicated nowMs while the
  // panel is open in Birth mode.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!coordsOpen || clock.mode !== "birth") return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [coordsOpen, clock.mode]);
  const nowPos = useMemo(() => positions(new Date(nowMs)), [nowMs]);

  const coords = useMemo(() => {
    switch (clock.mode) {
      case "range":
        return { fixedPos: rangeFromPos, movablePos: rangeToPos, fixedLabel: "From", movableLabel: "To" };
      case "compare":
        return { fixedPos: compareAPos, movablePos: compareBPos, fixedLabel: "Chart A", movableLabel: "Chart B" };
      case "moment":
        return { fixedPos: anonymous ? null : natalPos, movablePos: livePos, fixedLabel: "Birth", movableLabel: fmtDate(clock.displayInstant, "moment", birth) };
      case "birth":
        return { fixedPos: anonymous ? null : natalPos, movablePos: nowPos, fixedLabel: "Birth", movableLabel: "Now" };
      default: // now
        return { fixedPos: anonymous ? null : natalPos, movablePos: livePos, fixedLabel: "Birth", movableLabel: "Now" };
    }
  }, [clock.mode, clock.displayInstant, rangeFromPos, rangeToPos, compareAPos, compareBPos, anonymous, natalPos, livePos, nowPos, birth]);

  // Theme: light=1 / dark=0 / system=follow the OS scheme (live via useColorScheme).
  const osScheme = useColorScheme();
  const themeT = useMemo(
    () => themeTForMode(themeMode, osScheme === "dark"),
    [themeMode, osScheme],
  );
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
    // The chart Name is independent: editing it NEVER changes the account name (which comes only
    // from the create-account form or 3rd-party auth). It's pre-filled from the account name as a
    // default while still the placeholder, then it's its own thing.
  }

  return (
    <ThemeProvider value={{ t: themeT, palette }}>
      <View style={styles.root}>
      <Sky themeT={themeT} />
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.headerRow} pointerEvents="box-none">
          <Text style={styles.brand}>MoveStar</Text>
          <View style={styles.headerRight} pointerEvents="box-none">
            <Pressable onPress={() => setMenuOpen(true)} style={styles.editBtn} hitSlop={8}>
              <Avatar glyph={sunGlyph} />
            </Pressable>
            <CoordinatesButton onPress={() => { if (anonymous) setAuthView("login"); else setCoordsOpen((v) => !v); }} />
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
        canSave={canSaveFor(tier)}
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
        fixedPos={coords.fixedPos}
        movablePos={coords.movablePos}
        fixedLabel={coords.fixedLabel}
        movableLabel={coords.movableLabel}
        natalPos={natalPos}
        ascLon={natalAsc}
        isPro={isPro}
        coordsLocked={coordinatesLocked(clock.mode, isPro)}
        onUpgrade={() => void presentProPaywall()}
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
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 2, zIndex: 20 },
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
