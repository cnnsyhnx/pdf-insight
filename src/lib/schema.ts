import { z } from 'zod';

/** Values the brief allows in `document.type`. */
export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written as YYYY-MM-DD (ISO 8601), so "2026-02-30" fails. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Intl data is present in browsers, Node and Cloudflare Workers; the regex alone is the fallback.
const knownCurrencies = (() => {
  try {
    return new Set(Intl.supportedValuesOf('currency'));
  } catch {
    return null;
  }
})();

const languageNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
  } catch {
    return null;
  }
})();

/** Three-letter ISO 4217 currency code, e.g. "PLN" (not "zł" or "pln"). */
export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value) && (knownCurrencies?.has(value) ?? true);
}

/** Two-letter ISO 639-1 language code, e.g. "pl". */
export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2}$/.test(value) && (languageNames ? languageNames.of(value) !== undefined : true);
}

const text = z.string().trim().min(1);
const isoDate = z
  .string()
  .refine(isIsoDate, { message: 'Oczekiwano daty w formacie RRRR-MM-DD (ISO 8601).' });
const currency = z.string().refine(isCurrencyCode, { message: 'Oczekiwano kodu waluty ISO 4217, np. PLN.' });
const language = z.string().refine(isLanguageCode, { message: 'Oczekiwano kodu języka ISO 639-1, np. pl.' });

/**
 * The analysis result, exactly as section 04 of the brief defines it.
 * Missing information is null or [] and the model never guesses.
 */
export const insightSchema = z.object({
  document: z.object({
    fileName: text,
    pages: z.number().int().positive(),
    language,
    type: z.enum(DOCUMENT_TYPES),
    title: text.nullable(),
    date: isoDate.nullable(),
  }),
  summary: text,
  keyPoints: z.array(text).min(3).max(7),
  entities: z.object({
    organizations: z.array(text),
    people: z.array(text),
  }),
  amounts: z.array(
    z.object({
      value: z.number().finite(),
      currency,
      context: text,
    }),
  ),
  dates: z.array(
    z.object({
      date: isoDate,
      context: text,
    }),
  ),
  keywords: z.array(text),
});

export type Insight = z.infer<typeof insightSchema>;
