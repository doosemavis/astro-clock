import { allSignKeys, allHouseKeys, allTransitKeys } from "../src/keys.ts";
import type { Bank } from "../src/types.ts";
import { titleFor } from "../src/titles.ts";

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
