import type { Bank, Interpretation } from "./types.ts";

/** Pure lookup of a single interpretation over a bank. */
export function lookup(bank: Bank, key: string): Interpretation | null {
  return bank[key] ?? null;
}
