import { z } from 'zod';
import type { AnalysisResponse } from './contract.ts';
import { findInText, indexPage, locate, type Found } from './evidence.ts';
import type { PageText } from './pdf.ts';
import { insightSchema, type Insight } from './schema.ts';

export { analysisResponseSchema, type AnalysisResponse } from './contract.ts';

const quote = z.string().trim().min(1);

/** Proof for one value: the quote and where it sits in the PDF. */
export interface Source {
  quote: string;
  found: Found;
}

/** A stretch of the summary that appears word for word in the PDF. */
export interface SummaryMark {
  start: number;
  end: number;
  source: Source;
}

export interface Sources {
  amounts: (Source | null)[];
  dates: (Source | null)[];
  organizations: (Source | null)[];
  people: (Source | null)[];
}

export interface Analysis {
  insight: Insight;
  summaryMarks: SummaryMark[];
  sources: Sources;
  /** scannedPages: pages that are images without a text layer, so their content is not in the result. */
  meta: { model: string; durationMs: number; analyzedAt: string; scannedPages: number[] };
}

/**
 * Checks every quote against the PDF text. Only quotes found word for word become highlights,
 * so the yellow on screen is decided by this code, never by the model.
 */
export function buildAnalysis(response: AnalysisResponse, pages: PageText[], analyzedAt: Date): Analysis {
  const indexes = pages.map(indexPage);
  // Single spaces only, so typesetting can swap a space for a no-break space without moving highlight offsets.
  const insight = { ...response.insight, summary: response.insight.summary.replace(/\s+/g, ' ').trim() };
  const source = (q: string | null): Source | null => {
    if (!q) return null;
    const found = locate(q, pages, indexes);
    return found ? { quote: q, found } : null;
  };

  const summaryMarks: SummaryMark[] = [];
  for (const q of response.evidence.summary) {
    const at = findInText(insight.summary, q);
    const proof = at ? source(q) : null;
    if (!at || !proof) continue;
    if (summaryMarks.some((m) => at.start < m.end && m.start < at.end)) continue;
    summaryMarks.push({ ...at, source: proof });
  }
  summaryMarks.sort((a, b) => a.start - b.start);

  // A name is highlighted only if the name itself is in the PDF; otherwise its quote is shown as the proof.
  const named = (names: string[], quotes: (string | null)[]) =>
    names.map((name, i) => source(name) ?? source(quotes[i] ?? null));

  return {
    insight,
    summaryMarks,
    sources: {
      amounts: response.evidence.amounts.map(source),
      dates: response.evidence.dates.map(source),
      organizations: named(insight.entities.organizations, response.evidence.organizations),
      people: named(insight.entities.people, response.evidence.people),
    },
    meta: {
      model: response.meta.model,
      durationMs: response.meta.durationMs,
      analyzedAt: analyzedAt.toISOString(),
      scannedPages: pages.filter((p) => p.scan).map((p) => p.number),
    },
  };
}

const sourceRef = z.object({ page: z.number().int().positive(), quote }).nullable();

/** The downloadable JSON: the brief's schema unchanged, plus where each value was found and how it was made. */
export const exportSchema = insightSchema.extend({
  sources: z.object({
    amounts: z.array(sourceRef),
    dates: z.array(sourceRef),
    organizations: z.array(sourceRef),
    people: z.array(sourceRef),
  }),
  meta: z.object({
    generator: z.literal('PDF Insight'),
    model: z.string(),
    durationMs: z.number().nonnegative(),
    analyzedAt: z.iso.datetime(),
    // Results saved before this field existed have none, which means no scanned pages were noticed.
    scannedPages: z.array(z.number().int().positive()).default([]),
  }),
});

export type ExportJson = z.infer<typeof exportSchema>;

/** Builds the download and validates it once more, so a file never leaves the app in a shape the schema rejects. */
export function toExportJson(analysis: Analysis): ExportJson {
  const ref = (s: Source | null) => (s ? { page: s.found.page, quote: s.quote } : null);
  return exportSchema.parse({
    ...analysis.insight,
    sources: {
      amounts: analysis.sources.amounts.map(ref),
      dates: analysis.sources.dates.map(ref),
      organizations: analysis.sources.organizations.map(ref),
      people: analysis.sources.people.map(ref),
    },
    meta: { generator: 'PDF Insight', ...analysis.meta },
  });
}

/** A saved result from history. The PDF is not stored, so sources know their page but not their place on it. */
export function fromExportJson(json: ExportJson): Analysis {
  const { sources, meta, ...insight } = json;
  const toSource = (ref: { page: number; quote: string } | null): Source | null =>
    ref ? { quote: ref.quote, found: { page: ref.page, rects: [] } } : null;
  return {
    insight,
    summaryMarks: [],
    sources: {
      amounts: sources.amounts.map(toSource),
      dates: sources.dates.map(toSource),
      organizations: sources.organizations.map(toSource),
      people: sources.people.map(toSource),
    },
    meta: {
      model: meta.model,
      durationMs: meta.durationMs,
      analyzedAt: meta.analyzedAt,
      scannedPages: meta.scannedPages,
    },
  };
}
