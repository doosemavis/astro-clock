export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

/** Policy: >= 8 chars, >= 1 letter, >= 1 number. Lockstep with apps/web/lib/password.ts
 *  and mirrored in the Supabase dashboard policy (the server is the real gate). */
export function validatePassword(pw: string): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) problems.push("a letter");
  if (!/[0-9]/.test(pw)) problems.push("a number");
  return { ok: problems.length === 0, problems };
}
