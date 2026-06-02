import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BirthData } from "@astro/engine";

const KEY = "movestar.birth.v1";

/** Returns the saved birth, or null if absent/corrupt (caller falls back to DEFAULT_BIRTH). */
export async function loadBirth(): Promise<BirthData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as BirthData;
    const valid =
      typeof b?.date === "string" &&
      typeof b?.time === "string" &&
      typeof b?.lat === "number" &&
      typeof b?.lon === "number" &&
      typeof b?.tzOffset === "number" &&
      typeof b?.isDst === "boolean";
    return valid ? b : null;
  } catch {
    return null;
  }
}

export async function saveBirth(b: BirthData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(b));
}
