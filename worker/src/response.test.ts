import { describe, expect, it } from 'vitest';
import type { AnalyzeRequest } from '../../src/lib/contract.ts';
import type { ModelOutput } from './model-output.ts';
import { checkModelText, formatPath, modelPath } from './response.ts';

const request: AnalyzeRequest = { fileName: 'umowa.pdf', pages: ['strona pierwsza', 'strona druga'] };
const meta = { model: 'claude-sonnet-5-5', provider: 'anthropic' as const, durationMs: 1200 };

function output(overrides: Partial<ModelOutput> = {}): ModelOutput {
  return {
    language: 'pl',
    type: 'umowa',
    title: 'Umowa ramowa nr 14/2026',
    date: '2026-03-12',
    summarySentences: ['Pierwsze zdanie.', 'Drugie zdanie za 184 500,00 zł netto.', 'Trzecie zdanie.'],
    summaryQuotes: ['184 500,00 zł netto'],
    keyPoints: ['Punkt A', 'Punkt B', 'Punkt C'],
    organizations: [{ name: 'Kwadrat Software S.A.', quote: 'Kwadrat Software S.A.' }],
    people: [],
    amounts: [{ value: 184500, currency: 'PLN', context: 'wdrożenie', quote: '184 500,00 zł netto' }],
    dates: [{ date: '2026-10-12', context: 'go-live', quote: '12 października 2026 r.' }],
    keywords: ['CRM', 'wdrożenie', 'SLA'],
    ...overrides,
  };
}

const check = (value: unknown) => checkModelText(JSON.stringify(value), request, meta);

describe('checkModelText', () => {
  it('builds the brief structure, with file name and page count taken from the request', () => {
    const result = check(output());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.insight.document).toEqual({
      fileName: 'umowa.pdf',
      pages: 2,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa ramowa nr 14/2026',
      date: '2026-03-12',
    });
    expect(result.response.insight.summary).toBe(
      'Pierwsze zdanie. Drugie zdanie za 184 500,00 zł netto. Trzecie zdanie.',
    );
    expect(result.response.evidence.amounts).toEqual(['184 500,00 zł netto']);
    expect(result.response.meta).toEqual(meta);
  });

  it('only tidies mechanically: code case, blanks, repeated names', () => {
    const result = check(
      output({
        language: ' PL ',
        title: '  ',
        date: '',
        amounts: [{ value: 10, currency: 'pln', context: ' opłata ', quote: ' 10 zł ' }],
        organizations: [
          { name: 'Nordwave', quote: 'Nordwave' },
          { name: 'NORDWAVE', quote: 'NORDWAVE' },
          { name: ' ', quote: '' },
        ],
        keywords: ['CRM', 'crm', '', 'SLA'],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { insight, evidence } = result.response;
    expect(insight.document.language).toBe('pl');
    expect(insight.document.title).toBeNull();
    expect(insight.document.date).toBeNull();
    expect(insight.amounts[0]).toEqual({ value: 10, currency: 'PLN', context: 'opłata' });
    expect(evidence.amounts).toEqual(['10 zł']);
    expect(insight.entities.organizations).toEqual(['Nordwave']);
    expect(evidence.organizations).toEqual(['Nordwave']);
    expect(insight.keywords).toEqual(['CRM', 'SLA']);
  });

  it('rejects text that is not JSON', () => {
    expect(checkModelText('Oto analiza: {', request, meta)).toEqual({
      ok: false,
      problems: ['- The answer is not valid JSON.'],
    });
  });

  it('names the model own keys when a value breaks the schema', () => {
    const result = check(
      output({
        date: '2026-02-30',
        amounts: [{ value: 1, currency: 'ZŁ', context: 'x', quote: '1 zł' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.startsWith('- date:'))).toBe(true);
    expect(result.problems.some((p) => p.startsWith('- amounts[0].currency:'))).toBe(true);
  });

  it('enforces 3 to 5 summary sentences', () => {
    const result = check(output({ summarySentences: ['Jedno.', 'Dwa.'] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatch(/^- summarySentences:/);
  });

  it('rejects keys the schema does not define', () => {
    const result = check({ ...output(), confidence: 0.9 });
    expect(result.ok).toBe(false);
  });
});

describe('paths', () => {
  it('formats array indexes', () => {
    expect(formatPath(['amounts', 0, 'currency'])).toBe('amounts[0].currency');
    expect(formatPath([])).toBe('');
  });

  it('maps response paths back to model keys', () => {
    expect(modelPath(['insight', 'document', 'date'])).toBe('date');
    expect(modelPath(['insight', 'summary'])).toBe('summarySentences');
    expect(modelPath(['insight', 'entities', 'people', 1])).toBe('people[1].name');
    expect(modelPath(['insight', 'amounts', 2, 'currency'])).toBe('amounts[2].currency');
    expect(modelPath(['evidence', 'summary', 0])).toBe('summaryQuotes[0]');
    expect(modelPath(['evidence', 'dates', 3])).toBe('dates[3].quote');
  });
});
