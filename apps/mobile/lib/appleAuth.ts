/** Minimal structural shape of the parts of an `expo-apple-authentication` credential we use.
 *  Declared locally (no native import) so this module stays pure and testable under node --test. */
export interface AppleCredentialLike {
  identityToken: string | null;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
}

/** Args for `supabase.auth.signInWithIdToken`. No nonce: the Expo flow relies on Apple-token
 *  signature verification (spec §3.2). */
export interface AppleIdTokenParams {
  provider: "apple";
  token: string;
}

/** Build the signInWithIdToken args; throw if Apple returned no identity token. */
export function buildAppleIdTokenParams(identityToken: string | null): AppleIdTokenParams {
  if (!identityToken) throw new Error("Apple sign-in did not return an identity token.");
  return { provider: "apple", token: identityToken };
}

/** Join Apple's first-authorization name parts into a display name, or null if absent/blank. */
export function appleFullNameToString(fullName: AppleCredentialLike["fullName"]): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return parts.length ? parts.join(" ") : null;
}

/** `expo-apple-authentication` throws this code when the user cancels the native sheet. */
export function isAppleCancel(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  );
}
