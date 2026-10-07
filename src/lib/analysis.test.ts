import { describe, expect, it } from 'vitest';
import {
  buildAnalysis,
  exportSchema,
  fromExportJson,
  toExportJson,
  type AnalysisResponse,
} from './analysis.ts';
import type { PageText, TextRun } from './pdf.ts';
import { insightSchema } from './schema.ts';

const run = (str: string, y: number): TextRun => ({
  str,
  x: 0.1,
  y,
  w: str.length * 0.008,
  h: 0.012,
  eol: true,
});

const pages: PageText[] = [
  {
    number: 1,
    aspect: 1.414,
    runs: [
      run('Umowa serwisowa zawarta 1 września 2026 r.', 0.1),
      run('Wynagrodzenie wynosi 12 500,00 zł netto miesięcznie.', 0.2),
    ],
    scan: false,
  },
  { number: 2, aspect: 1.414, runs: [], scan: true },
];

const response: AnalysisResponse = {
  insight: {
    document: {
      fileName: 'umowa.pdf',
      pages: 2,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa',
      date: '2026-09-01',
    },
    summary:
      'Umowa serwisowa została zawarta 1 września 2026 r. Wynagrodzenie wynosi 12 500,00 zł netto. Dotyczy usług serwisowych.',
    keyPoints: ['Wynagrodzenie miesięczne', 'Umowa serwisowa', 'Data zawarcia'],
    entities: { organizations: [], people: [] },
    amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie miesięczne' }],
    dates: [{ date: '2026-09-01', context: 'zawarcie umowy' }],
    keywords: ['serwis'],
  },
  evidence: {
    // The second quote is not in the PDF: it must not become a highlight.
    summary: ['12 500,00 zł netto', 'usług serwisowych'],
    amounts: ['12 500,00 zł netto'],
    dates: ['1 września 2026 r.'],
    organizations: [],
    people: [],
  },
  meta: { model: 'claude-sonnet-5-5', provider: 'anthropic', durationMs: 14_569 },
};

const analysis = buildAnalysis(response, pages, new Date('2026-10-07T18:00:00Z'));

describe('buildAnalysis', () => {
  it('highlights only quotes found word for word in the PDF', () => {
    expect(analysis.summaryMarks).toHaveLength(1);
    const [mark] = analysis.summaryMarks;
    expect(mark && analysis.insight.summary.slice(mark.start, mark.end)).toBe('12 500,00 zł netto');
    expect(analysis.sources.amounts[0]?.found.page).toBe(1);
    expect(analysis.sources.dates[0]?.found.page).toBe(1);
  });

  it('records which pages are scans, whose content is missing from the result', () => {
    expect(analysis.meta.scannedPages).toEqual([2]);
  });
});

describe('the downloaded JSON', () => {
  const json = toExportJson(analysis);

  it('keeps every field of the brief schema, unchanged', () => {
    expect(insightSchema.safeParse(json).success).toBe(true);
    expect(Object.keys(json)).toEqual(expect.arrayContaining(Object.keys(response.insight)));
    expect(json.amounts).toEqual(response.insight.amounts);
  });

  it('adds where each value was found and which pages were scans', () => {
    expect(json.sources.amounts[0]).toEqual({ page: 1, quote: '12 500,00 zł netto' });
    expect(json.meta).toMatchObject({ generator: 'PDF Insight', scannedPages: [2] });
  });

  it('comes back from history as the same result', () => {
    const again = fromExportJson(exportSchema.parse(JSON.parse(JSON.stringify(json))));
    expect(again.insight).toEqual(analysis.insight);
    expect(again.meta).toEqual(analysis.meta);
  });

  it('still reads results saved before scanned pages were recorded', () => {
    const { generator, model, durationMs, analyzedAt } = json.meta;
    const old = exportSchema.parse({ ...json, meta: { generator, model, durationMs, analyzedAt } });
    expect(old.meta.scannedPages).toEqual([]);
  });
});
