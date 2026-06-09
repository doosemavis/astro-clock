const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Human-readable title for an interpretation key (used in UI and to seed prompts). */
export function titleFor(key: string): string {
  const [kind, a, b, c] = key.split(":");
  if (kind === "sign") return `${a === "ascendant" ? "Rising" : cap(a)} in ${b}`;
  if (kind === "house") return `${cap(a)} in House ${b}`;
  if (kind === "transit") return `Transiting ${cap(a)} ${b} natal ${cap(c)}`;
  throw new Error(`Unknown interpretation key format: ${key}`);
}
