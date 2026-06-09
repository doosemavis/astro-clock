import { z } from "zod";

export const InterpretationSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  meta: z.object({
    model: z.string().min(1),
    generatedAt: z.string().min(1),
    reviewed: z.boolean(),
    v: z.number().int().positive(),
  }),
});

export const BankSchema = z.record(z.string(), InterpretationSchema);

/** Single source of truth: the TS shapes are derived from the Zod schema. */
export type Interpretation = z.infer<typeof InterpretationSchema>;
export type Bank = z.infer<typeof BankSchema>;
