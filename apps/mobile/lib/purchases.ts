// Thin wrapper around RevenueCat so the rest of the app never imports the SDK directly.
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { PRO_ENTITLEMENT } from "./rcEntitlement";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  revenueCatAndroidKey?: string;
  revenueCatIosKey?: string;
};

function apiKey(): string {
  const key = Platform.OS === "ios" ? extra.revenueCatIosKey : extra.revenueCatAndroidKey;
  return key ?? "";
}

let configured = false;

/** Configure the SDK once at app start. Fail-closed: swallow errors so the app still runs
 *  (entitlement simply stays Free until the SDK is reachable). */
export function configurePurchases(): void {
  if (configured) return;
  const key = apiKey();
  if (!key) {
    console.warn("RevenueCat key missing — purchases disabled");
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (e) {
    console.warn("RevenueCat configure failed:", e);
  }
}

/** Link the RevenueCat App User ID to the Supabase user id (so the webhook can attribute sales). */
export async function loginPurchases(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("RevenueCat logIn failed:", e);
  }
}

/** Return to an anonymous RevenueCat id on sign-out. */
export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    // logOut throws if already anonymous — non-fatal.
    console.warn("RevenueCat logOut skipped:", e);
  }
}

/** Current CustomerInfo, or null if unavailable. */
export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Subscribe to entitlement changes; returns an unsubscribe fn. No-op if not configured. */
export function onCustomerInfo(listener: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

/** Present the prebuilt paywall if the user lacks Pro. Returns true if they now have it. */
export async function presentProPaywall(): Promise<boolean> {
  if (!configured) return false;
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (e) {
    console.warn("Paywall error:", e);
    return false;
  }
}

/** Restore prior purchases (Play requirement). Returns true if Pro is now active. */
export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.restorePurchases();
    return PRO_ENTITLEMENT in (info.entitlements.active ?? {});
  } catch (e) {
    console.warn("Restore failed:", e);
    return false;
  }
}

/** Open the store's manage-subscription page. Returns false when there is no management URL
 *  (e.g. the Test Store, or no active store subscription) so the UI can show a fallback. */
export async function showManageSubscriptions(): Promise<boolean> {
  const info = await getCustomerInfoSafe();
  if (info?.managementURL) {
    Linking.openURL(info.managementURL).catch((e) => console.warn("openURL failed:", e));
    return true;
  }
  return false;
}
