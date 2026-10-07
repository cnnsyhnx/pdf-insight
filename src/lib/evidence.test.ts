import { describe, expect, it } from 'vitest';
import { findInText, indexPage, locate, normalizeQuote } from './evidence.ts';
import { NBSP } from './format.ts';
import type { PageText, TextRun } from './pdf.ts';

const run = (str: string, x: number, y: number, eol = false): TextRun => ({
  str,
  x,
  y,
  w: str.length * 0.008,
  h: 0.012,
  eol,
});

/** A contract page where an amount breaks across two lines and a company name is split into two runs. */
const page: PageText = {
  number: 4,
  aspect: 1.414,
  runs: [
    run(
      'Za realizację wdrożenia Wykonawcy przysługuje wynagrodzenie ryczałtowe w wysokości 184 500,00',
      0.1,
      0.2,
      true,
    ),
    run('zł netto (słownie: sto osiemdziesiąt cztery tysiące pięćset złotych 00/100).', 0.1, 0.22, true),
    run('Kwadrat Software', 0.1, 0.3),
    run('S.A.', 0.3, 0.3, true),
  ],
  scan: false,
};
const pages = [page];
const indexes = pages.map(indexPage);

describe('locate', () => {
  it('finds a quote that breaks across lines and returns one box per line', () => {
    const found = locate('184 500,00 zł netto', pages, indexes);
    expect(found?.page).toBe(4);
    expect(found?.rects).toHaveLength(2);
  });

  it('treats no-break spaces in the quote as ordinary spaces', () => {
    expect(locate(`184${NBSP}500,00${NBSP}zł netto`, pages, indexes)?.page).toBe(4);
  });

  it('joins runs separated by a gap with a space', () => {
    expect(locate('Kwadrat Software S.A.', pages, indexes)?.page).toBe(4);
  });

  it('falls back to ignoring letter case', () => {
    expect(locate('WYNAGRODZENIE RYCZAŁTOWE', pages, indexes)?.page).toBe(4);
  });

  it('returns null for words that are not in the document, so nothing invented gets highlighted', () => {
    expect(locate('1 PLN', pages, indexes)).toBeNull();
    expect(locate('kara umowna 50 000 zł', pages, indexes)).toBeNull();
  });

  it('ignores quotes too short to prove anything', () => {
    expect(locate('a', pages, indexes)).toBeNull();
  });
});

describe('findInText', () => {
  it('returns positions in the original string even when spacing differs', () => {
    const summary = `Wynagrodzenie wynosi 184${NBSP}500,00 zł netto, płatne w 5 etapach.`;
    const at = findInText(summary, '184 500,00 zł netto');
    expect(at).not.toBeNull();
    expect(summary.slice(at?.start, at?.end)).toBe(`184${NBSP}500,00 zł netto`);
  });

  it('returns null when the quote is not in the text', () => {
    expect(findInText('Umowa trwa 24 miesiące.', '36 miesięcy')).toBeNull();
  });
});

describe('normalizeQuote', () => {
  it('collapses whitespace and unifies quotes and dashes', () => {
    expect(normalizeQuote('  „Go–live”\n  12.10.2026 ')).toBe('"Go-live" 12.10.2026');
  });
});
