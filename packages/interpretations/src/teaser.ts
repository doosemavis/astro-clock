import { z } from "zod";

export interface TeaserEntry {
  title: string;   // e.g. "Sun in Leo" / "Rising in Scorpio"
  summary: string; // one warm, plain-language sentence (FREE teaser)
}
export type TeaserBank = Record<string, TeaserEntry>;

export const TeaserBankSchema = z.record(
  z.string(),
  z.object({ title: z.string().min(1), summary: z.string().min(1) }),
);

import teaserJson from "../data/teaser.json" with { type: "json" };
export const TEASER_BANK: TeaserBank = teaserJson as TeaserBank;
