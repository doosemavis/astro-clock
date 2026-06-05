import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "permission" | "error" };

async function capture(ref: RefObject<View | null>): Promise<string> {
  return captureRef(ref, { format: "png", quality: 1 });
}

/** Capture the referenced view and write it to the device photo library. */
export async function saveChartImage(ref: RefObject<View | null>): Promise<SaveResult> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(); // write+read; save needs write
    if (!perm.granted) return { ok: false, reason: "permission" };
    const uri = await capture(ref);
    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Capture the referenced view and open the native share sheet (Pro only — caller gates). */
export async function shareChartImage(ref: RefObject<View | null>): Promise<SaveResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: "error" };
    const uri = await capture(ref);
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
