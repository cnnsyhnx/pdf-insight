import { describe, expect, it } from 'vitest';
import { formatAmount, formatDate, listLabel, NBSP, plural, polishTypography } from './format.ts';

describe('Polish formatting', () => {
  it('groups thousands with a no-break space and uses a decimal comma', () => {
    expect(formatAmount(184500)).toBe(`184${NBSP}500,00`);
  });

  it('writes dates with the month in the genitive', () => {
    expect(formatDate('2026-10-12')).toBe('12 października 2026');
  });

  it('picks the right plural form', () => {
    const pages = (n: number) => plural(n, 'strona', 'strony', 'stron');
    expect([1, 3, 5, 12, 22, 25].map(pages)).toEqual([
      'strona',
      'strony',
      'stron',
      'stron',
      'strony',
      'stron',
    ]);
  });
});

describe('polishTypography', () => {
  it('keeps single-letter words with the next word', () => {
    expect(polishTypography('Umowa o wdrożenie i utrzymanie')).toBe(
      `Umowa o${NBSP}wdrożenie i${NBSP}utrzymanie`,
    );
  });

  it('handles single-letter words that follow each other', () => {
    expect(polishTypography('a w razie zmian')).toBe(`a${NBSP}w${NBSP}razie zmian`);
  });

  it('keeps numbers with their thousands groups and units', () => {
    expect(polishTypography('wynosi 184 500,00 zł netto')).toBe(`wynosi 184${NBSP}500,00${NBSP}zł netto`);
    expect(polishTypography('dostępność 99,5 % i umowa nr 14/2026 z 2026 r.')).toBe(
      `dostępność 99,5${NBSP}% i${NBSP}umowa nr${NBSP}14/2026 z${NBSP}2026${NBSP}r.`,
    );
  });

  it('never changes the length, so highlight offsets stay valid', () => {
    const text = 'Umowa nr 14/2026 o wartości 184 500,00 zł, a w razie zmian 2026 r.';
    expect(polishTypography(text)).toHaveLength(text.length);
  });
});

describe('listLabel', () => {
  it('joins page numbers the Polish way', () => {
    expect(listLabel([11])).toBe('11');
    expect(listLabel([3, 11])).toBe('3 i 11');
    expect(listLabel([2, 3, 5])).toBe('2, 3 i 5');
  });
});
