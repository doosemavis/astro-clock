import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseOnboardingSeen, SEEN_VALUE } from "./onboarding.ts";

const KEY = "movestar.onboarding.v1";

/** Has the first-run walkthrough been seen? false on absent/corrupt/read-error (so it shows once). */
export async function loadOnboardingSeen(): Promise<boolean> {
  try {
    return parseOnboardingSeen(await AsyncStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/** Mark the walkthrough seen (local cache only; ignore write errors). */
export async function saveOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, SEEN_VALUE);
  } catch {
    /* local cache only */
  }
}
