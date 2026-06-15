import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, FlatList, useWindowDimensions,
  type ListRenderItemInfo, type NativeSyntheticEvent, type NativeScrollEvent,
} from "react-native";
import { mixPalette } from "@astro/engine";
import type { Palette } from "@astro/engine";
import { ThemeProvider } from "../../lib/theme";
import { SLIDES, type Slide, type CtaAction } from "../../lib/onboarding";
import { OnboardingDemo } from "./OnboardingDemo";

interface Props {
  visible: boolean;
  onDismiss: () => void;        // skip / maybe-later-to-Now / continue → anonymous Now
  onCreateAccount: () => void;  // any create-account CTA → open sign-up
}

export function OnboardingWalkthrough({ visible, onDismiss, onCreateAccount }: Props) {
  // Onboarding is a branded first-run moment — always the dark cosmic look, regardless of app theme.
  const p = useMemo(() => mixPalette(0), []);
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(p), [p]);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const demoSize = Math.min(width * 0.72, 320);

  // Reset to the first slide whenever the overlay (re)opens — e.g. replay from the menu.
  useEffect(() => {
    if (visible) {
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [visible]);

  function act(action: CtaAction) {
    if (action === "createAccount") return onCreateAccount();
    if (action === "dismiss") return onDismiss();
    if (index < SLIDES.length - 1) {            // "next"
      const next = index + 1;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      onDismiss();
    }
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  function renderItem({ item }: ListRenderItemInfo<Slide>) {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.demoBox}><OnboardingDemo kind={item.demo} size={demoSize} /></View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    );
  }

  const slide = SLIDES[index];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <ThemeProvider value={{ t: 0, palette: p }}>
      <View style={styles.root}>
        <Pressable style={styles.skip} onPress={onDismiss} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.ctas}>
          <Pressable style={styles.primaryBtn} onPress={() => act(slide.primary.action)}>
            <Text style={styles.primaryText}>{slide.primary.label}</Text>
          </Pressable>
          {slide.secondary ? (
            <Pressable style={styles.secondaryBtn} onPress={() => act(slide.secondary!.action)}>
              <Text style={styles.secondaryText}>{slide.secondary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      </ThemeProvider>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg, paddingTop: 64, paddingBottom: 40 },
  skip: { position: "absolute", top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: p.textDim, fontSize: 15, fontWeight: "600" },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 },
  demoBox: { alignItems: "center", justifyContent: "center" },
  title: { color: p.text, fontSize: 26, fontWeight: "700", textAlign: "center", letterSpacing: 0.5 },
  body: { color: p.textDim, fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 320 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: p.border },
  dotActive: { backgroundColor: p.text, width: 18 },
  ctas: { paddingHorizontal: 28, gap: 10 },
  primaryBtn: { backgroundColor: p.text, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryText: { color: p.bg, fontSize: 16, fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: p.textDim, fontSize: 15, fontWeight: "600" },
});
