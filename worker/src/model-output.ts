import { z } from 'zod';
import { DOCUMENT_TYPES } from '../../src/lib/schema.ts';

const quote = z.string().describe('The exact characters from the document where this value appears.');

/**
 * What the model must return. It differs from the public schema on purpose: the summary comes as separate
 * sentences (so 3-5 is countable) and every value carries the quote it was taken from.
 */
export const modelOutputSchema = z.strictObject({
  language: z.string().describe('ISO 639-1 code, e.g. "pl".'),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().nullable(),
  date: z.string().nullable().describe('YYYY-MM-DD or null.'),
  summarySentences: z.array(z.string()).min(3).max(5),
  summaryQuotes: z.array(z.string()),
  keyPoints: z.array(z.string()).min(3).max(7),
  organizations: z.array(z.strictObject({ name: z.string(), quote })),
  people: z.array(z.strictObject({ name: z.string(), quote })),
  amounts: z.array(
    z.strictObject({
      value: z.number(),
      currency: z.string().describe('ISO 4217 code, e.g. "PLN".'),
      context: z.string(),
      quote,
    }),
  ),
  dates: z.array(z.strictObject({ date: z.string().describe('YYYY-MM-DD.'), context: z.string(), quote })),
  keywords: z.array(z.string()),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** Keywords a strict JSON-schema mode may reject; Zod checks these limits after the answer arrives. */
const UNSUPPORTED = new Set([
  '$schema',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'pattern',
  'format',
]);

function tighten(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tighten);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!UNSUPPORTED.has(key)) out[key] = tighten(value);
  }
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

/** JSON Schema for strict structured output: every object closed and every key required. */
export function strictJsonSchema(): Record<string, unknown> {
  return tighten(z.toJSONSchema(modelOutputSchema, { target: 'draft-7' })) as Record<string, unknown>;
}
