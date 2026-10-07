import type { DocumentType } from './schema.ts';

/** U+00A0 NO-BREAK SPACE: keeps two words on the same line. */
export const NBSP = '\xA0';

// Polish usually leaves 4-digit numbers ungrouped; in a column of amounts they are grouped too, so digits line up.
const amountFormat = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});
const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const languageNames = new Intl.DisplayNames(['pl'], { type: 'language' });
const pluralRules = new Intl.PluralRules('pl-PL');
const listFormat = new Intl.ListFormat('pl', { type: 'conjunction' });

/** 184500 -> "184 500,00" (the group separator is a no-break space, as Polish typesetting wants). */
export const formatAmount = (value: number): string => amountFormat.format(value);

/** "2026-10-12" -> "12 października 2026". */
export const formatDate = (iso: string): string => dateFormat.format(new Date(`${iso}T00:00:00Z`));

/** "pl" -> "polski". */
export const languageName = (code: string): string => languageNames.of(code) ?? code;

export const TYPE_LABEL: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Dokument',
};

/** Polish plural: plural(1, 'strona', 'strony', 'stron') -> "strona", 3 -> "strony", 12 -> "stron". */
export function plural(n: number, one: string, few: string, many: string): string {
  const rule = pluralRules.select(n);
  if (rule === 'one') return one;
  if (rule === 'few') return few;
  return many;
}

export const countLabel = (n: number, one: string, few: string, many: string): string =>
  `${n}${NBSP}${plural(n, one, few, many)}`;

/** [3, 7, 11] -> "3, 7 i 11". */
export const listLabel = (items: (string | number)[]): string => listFormat.format(items.map(String));

/** "12,4 MB" for file sizes in messages. */
export const formatMegabytes = (bytes: number): string =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)}${NBSP}MB`;

/**
 * Polish typesetting for model-written text: single-letter words never end a line,
 * and numbers stay with their thousands groups and units.
 * Every rule swaps one space for one no-break space, so the length (and any highlight offsets) never change.
 */
export function polishTypography(text: string): string {
  return text
    .replace(/(?<=^|[\s(„"])([aiouwzAIOUWZ])\s(?=\S)/g, `$1${NBSP}`)
    .replace(/(\d)[ \xA0](?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d)\s(zł|PLN|EUR|USD|GBP|CHF|r\.|%)/g, `$1${NBSP}$2`)
    .replace(/\b(nr|art\.|ust\.|pkt|s\.)\s(?=\d)/g, `$1${NBSP}`);
}
