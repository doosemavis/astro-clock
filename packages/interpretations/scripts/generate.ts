import { allSignKeys, allHouseKeys, allTransitKeys } from "../src/keys.ts";
import type { Bank } from "../src/types.ts";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Human-readable title for a key (used in UI and to seed the LLM prompt). */
export function titleFor(key: string): string {
  const [kind, a, b, c] = key.split(":");
  if (kind === "sign") return `${a === "ascendant" ? "Rising" : cap(a)} in ${b}`;
  if (kind === "house") return `${cap(a)} in House ${b}`;
  if (kind === "transit") return `Transiting ${cap(a)} ${b} natal ${cap(c)}`;
  throw new Error(`Unknown interpretation key format: ${key}`);
}

export function promptFor(key: string): string {
  return [
    `Write an astrological interpretation for "${titleFor(key)}".`,
    `Return a JSON object with "summary" (one warm, plain-language sentence — a teaser)`,
    `and "body" (2–3 short paragraphs of fuller interpretation). Avoid fatalism and jargon.`,
  ].join(" ");
}

/** Injected completion: takes a key + prompt, returns the two text fields. */
export type Complete = (input: { key: string; kind: string; prompt: string })
  => Promise<{ summary: string; body: string }>;

/** Build the full v1 bank by calling `complete` for every key. Pure given `complete`. */
export async function generateBank(opts: { complete: Complete; model: string; now: string }): Promise<Bank> {
  const keys = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  const bank: Bank = {};
  for (const key of keys) {
    const kind = key.split(":")[0];
    const { summary, body } = await opts.complete({ key, kind, prompt: promptFor(key) });
    bank[key] = {
      key,
      title: titleFor(key),
      summary,
      body,
      meta: { model: opts.model, generatedAt: opts.now, reviewed: false, v: 1 },
    };
  }
  return bank;
}
