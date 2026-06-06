// These two polyfills MUST come first, before supabase-js loads:
//  - get-random-values: PKCE generates its code verifier with crypto.getRandomValues, which
//    Hermes does not provide natively.
//  - url-polyfill: supabase-js relies on the WHATWG URL API in React Native.
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail fast and loud — a missing env var otherwise surfaces as opaque network errors.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to apps/mobile/.env and fill in the values.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // there is no browser URL to read the session from on native
    flowType: "pkce",
  },
});

// Auto-refresh tokens only while the app is foregrounded — the documented Supabase RN pattern.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
