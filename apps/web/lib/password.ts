export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

/** Policy: >= 8 chars, >= 1 letter, >= 1 number. Mirror this in the Supabase dashboard. */
export function validatePassword(pw: string): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) problems.push("a letter");
  if (!/[0-9]/.test(pw)) problems.push("a number");
  return { ok: problems.length === 0, problems };
}
