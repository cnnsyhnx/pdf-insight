import { z } from 'zod';
import { insightSchema } from './schema.ts';

/** Shared by the app and the Worker: what goes over the wire, validated on both sides. */

/*
 * Limits that keep every analysis inside the 30 s target and put a ceiling on what one call can cost. The app checks
 * them before sending and the Worker checks them again, so a script cannot get round them.
 */

/** At most 50 pages per document. */
export const MAX_PAGES = 50;
/** A dense A4 page of contract text holds about 4,000 characters... */
export const MAX_CHARS_PER_PAGE = 4_000;
/** ...so one analysis sends at most what 50 such pages hold: 200,000 characters. */
export const MAX_TEXT_CHARS = MAX_PAGES * MAX_CHARS_PER_PAGE;
/** A single page may be denser than average, but not five times denser: past this it is not a normal page. */
export const MAX_PAGE_CHARS = 5 * MAX_CHARS_PER_PAGE;

export const analyzeRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    pages: z.array(z.string().max(MAX_PAGE_CHARS)).min(1).max(MAX_PAGES),
  })
  .refine((r) => r.pages.reduce((n, p) => n + p.length, 0) <= MAX_TEXT_CHARS, {
    message: `Document text is longer than ${MAX_TEXT_CHARS} characters.`,
  });

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

const quote = z.string().trim().min(1);

/** The Worker's answer: the insight plus, for every value, the words it was taken from. */
export const analysisResponseSchema = z
  .object({
    insight: insightSchema,
    evidence: z.object({
      summary: z.array(quote),
      amounts: z.array(quote.nullable()),
      dates: z.array(quote.nullable()),
      organizations: z.array(quote.nullable()),
      people: z.array(quote.nullable()),
    }),
    meta: z.object({
      model: z.string().min(1),
      provider: z.enum(['anthropic', 'openai', 'demo']),
      durationMs: z.number().nonnegative(),
    }),
  })
  .refine(
    ({ insight, evidence }) =>
      evidence.amounts.length === insight.amounts.length &&
      evidence.dates.length === insight.dates.length &&
      evidence.organizations.length === insight.entities.organizations.length &&
      evidence.people.length === insight.entities.people.length,
    { message: 'Evidence does not line up with the extracted values.' },
  );

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

/** Error codes the Worker returns in `{ error }`; the app turns each into a specific message. */
export type WorkerError =
  | 'bad-request'
  | 'too-large'
  | 'rate-limit'
  | 'daily-limit'
  | 'invalid-response'
  | 'upstream'
  | 'not-configured'
  | 'origin'
  | 'not-found';
