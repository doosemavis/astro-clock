/** The subset of `supabase.auth.signUp`'s `data` we need to classify the outcome. Kept as a
 *  minimal structural type so this module is pure and testable under `node --test`. */
export interface SignUpData {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

export type SignUpOutcome = "success" | "needs_confirm" | "already_exists";

/** Classify a (non-error) signUp response.
 *  - session present                → "success" (confirmation off, or already confirmed)
 *  - user with EMPTY identities[]    → "already_exists" (Supabase anti-enumeration obfuscation
 *                                       when email confirmation is ON — see spec §3.3)
 *  - otherwise                       → "needs_confirm" (new account awaiting the email link) */
export function interpretSignUp(data: SignUpData): SignUpOutcome {
  if (data.session) return "success";
  const identities = data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) return "already_exists";
  return "needs_confirm";
}
