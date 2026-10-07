import { describe, expect, it } from 'vitest';
import { insightSchema, isCurrencyCode, isIsoDate, isLanguageCode, type Insight } from './schema.ts';

const firstAmount = { value: 12500.0, currency: 'PLN', context: 'wynagrodzenie' };
const firstDate = { date: '2026-10-01', context: 'termin płatności' };

/** The example from section 04 of the brief, with key points padded to the required minimum of three. */
const briefExample: Insight = {
  document: {
    fileName: 'umowa.pdf',
    pages: 4,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa serwisowa',
    date: '2026-09-01',
  },
  summary: 'Umowa określa zasady…',
  keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500,00 PLN', 'Termin płatności 1 października 2026'],
  entities: {
    organizations: ['Przykład sp. z o.o.'],
    people: [],
  },
  amounts: [firstAmount],
  dates: [firstDate],
  keywords: ['serwis', 'SLA'],
};

const parse = (overrides: (draft: Insight) => void) => {
  const draft = structuredClone(briefExample);
  overrides(draft);
  return insightSchema.safeParse(draft);
};

describe('insightSchema', () => {
  it('accepts the example from the brief', () => {
    expect(insightSchema.safeParse(briefExample).success).toBe(true);
  });

  it('accepts null and empty arrays where the document has no information', () => {
    const result = parse((d) => {
      d.document.title = null;
      d.document.date = null;
      d.entities = { organizations: [], people: [] };
      d.amounts = [];
      d.dates = [];
      d.keywords = [];
    });
    expect(result.success).toBe(true);
  });

  it('rejects a document type outside the allowed list', () => {
    const result = insightSchema.safeParse({
      ...briefExample,
      document: { ...briefExample.document, type: 'list' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects dates that are not ISO 8601 calendar days', () => {
    expect(parse((d) => (d.document.date = '01.09.2026')).success).toBe(false);
    expect(parse((d) => (d.dates = [{ ...firstDate, date: '2026-02-30' }])).success).toBe(false);
  });

  it('rejects currencies that are not ISO 4217 codes', () => {
    expect(parse((d) => (d.amounts = [{ ...firstAmount, currency: 'zł' }])).success).toBe(false);
    expect(parse((d) => (d.amounts = [{ ...firstAmount, currency: 'pln' }])).success).toBe(false);
  });

  it('rejects a language that is not an ISO 639-1 code', () => {
    expect(parse((d) => (d.document.language = 'pol')).success).toBe(false);
    expect(parse((d) => (d.document.language = 'PL')).success).toBe(false);
  });

  it('requires 3 to 7 key points', () => {
    expect(parse((d) => (d.keyPoints = d.keyPoints.slice(0, 2))).success).toBe(false);
    expect(parse((d) => (d.keyPoints = Array.from({ length: 8 }, (_, i) => `Punkt ${i + 1}`))).success).toBe(
      false,
    );
  });

  it('rejects a missing summary and an empty one', () => {
    const withoutSummary: Partial<Insight> = structuredClone(briefExample);
    delete withoutSummary.summary;
    expect(insightSchema.safeParse(withoutSummary).success).toBe(false);
    expect(parse((d) => (d.summary = '   ')).success).toBe(false);
  });

  it('rejects a page count that is not a positive integer', () => {
    expect(parse((d) => (d.document.pages = 0)).success).toBe(false);
    expect(parse((d) => (d.document.pages = 2.5)).success).toBe(false);
  });

  it('rejects amounts that are not finite numbers', () => {
    expect(parse((d) => (d.amounts = [{ ...firstAmount, value: Number.NaN }])).success).toBe(false);
    const asString = { ...briefExample, amounts: [{ value: '12 500,00', currency: 'PLN', context: 'x' }] };
    expect(insightSchema.safeParse(asString).success).toBe(false);
  });
});

describe('format checks', () => {
  it('isIsoDate accepts real days only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });

  it('isCurrencyCode accepts ISO 4217 codes', () => {
    expect(['PLN', 'EUR', 'USD'].every(isCurrencyCode)).toBe(true);
    expect(isCurrencyCode('ABC')).toBe(false);
  });

  it('isLanguageCode accepts ISO 639-1 codes', () => {
    expect(['pl', 'en', 'de'].every(isLanguageCode)).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
  });
});
