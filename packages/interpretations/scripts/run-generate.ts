import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SIGNS } from "@astro/engine";
import { signKey } from "../src/keys.ts";
import { titleFor } from "../src/titles.ts";
import { TeaserBankSchema, type TeaserBank } from "../src/teaser.ts";
import type { Subject } from "../src/types.ts";

const SUBJECTS = ["sun", "moon", "ascendant"] as const;

// Build the 36 teaser keys + titles.
const items = SUBJECTS.flatMap((subj) =>
  SIGNS.map((sign) => {
    const key = signKey(subj as Subject, sign);
    return { key, title: titleFor(key) };
  }),
);

const prompt = [
  "You are writing teaser-length astrological interpretations for a horoscope app.",
  "For EACH placement below, write ONE warm, plain-language sentence (about 15-25 words).",
  "Avoid fatalism, avoid jargon, be encouraging and specific.",
  'Return ONLY a JSON object mapping each KEY (exact string) to its sentence. No prose, no code fence.',
  "",
  ...items.map((it) => `${it.key}  =>  ${it.title}`),
].join("\n");

console.log(`Generating ${items.length} teaser summaries via claude CLI...`);
const raw = execFileSync("claude", ["-p"], { input: prompt, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

// Extract the first JSON object from the output (robust to any wrapping).
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end < 0) { console.error("No JSON in CLI output:\n", raw); process.exit(1); }
const summaries: Record<string, string> = JSON.parse(raw.slice(start, end + 1));

const bank: TeaserBank = {};
for (const it of items) {
  const summary = summaries[it.key];
  if (!summary || typeof summary !== "string") { console.error(`Missing summary for ${it.key}`); process.exit(1); }
  bank[it.key] = { title: it.title, summary: summary.trim() };
}

// Validate before writing.
TeaserBankSchema.parse(bank);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "teaser.json");
writeFileSync(outPath, JSON.stringify(bank, null, 2) + "\n");
console.log(`Wrote ${Object.keys(bank).length} entries to ${outPath}`);
