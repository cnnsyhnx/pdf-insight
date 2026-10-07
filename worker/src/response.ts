import {
  analysisResponseSchema,
  type AnalysisResponse,
  type AnalyzeRequest,
} from '../../src/lib/contract.ts';
import { modelOutputSchema, type ModelOutput } from './model-output.ts';

export type Checked = { ok: true; response: AnalysisResponse } | { ok: false; problems: string[] };

type Meta = AnalysisResponse['meta'];

/**
 * Turns the model's text into the public response, or lists exactly what is wrong with it.
 * The list goes back to the model as feedback for its one retry, so it names the model's own keys.
 */
export function checkModelText(text: string, request: AnalyzeRequest, meta: Meta): Checked {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['- The answer is not valid JSON.'] };
  }
  const output = modelOutputSchema.safeParse(json);
  if (!output.success) return { ok: false, problems: describe(output.error.issues, formatPath) };

  const response = analysisResponseSchema.safeParse(assemble(output.data, request, meta));
  if (!response.success) return { ok: false, problems: describe(response.error.issues, modelPath) };
  return { ok: true, response: response.data };
}

/**
 * Builds the brief's structure. File name and page count come from the request, never from the model.
 * Changes here are only mechanical: trimming, letter case of codes, and dropping empty or repeated names.
 */
function assemble(output: ModelOutput, request: AnalyzeRequest, meta: Meta) {
  const organizations = uniqueNames(output.organizations);
  const people = uniqueNames(output.people);
  return {
    insight: {
      document: {
        fileName: request.fileName,
        pages: request.pages.length,
        language: output.language.trim().toLowerCase(),
        type: output.type,
        title: orNull(output.title),
        date: orNull(output.date),
      },
      summary: output.summarySentences
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' '),
      keyPoints: output.keyPoints.map((s) => s.trim()).filter(Boolean),
      entities: {
        organizations: organizations.map((o) => o.name),
        people: people.map((p) => p.name),
      },
      amounts: output.amounts.map(({ value, currency, context }) => ({
        value,
        currency: currency.trim().toUpperCase(),
        context: context.trim(),
      })),
      dates: output.dates.map(({ date, context }) => ({ date: date.trim(), context: context.trim() })),
      keywords: dedupe(output.keywords.map((k) => k.trim()).filter(Boolean), (k) => k),
    },
    evidence: {
      summary: output.summaryQuotes.map((q) => q.trim()).filter(Boolean),
      amounts: output.amounts.map((a) => orNull(a.quote)),
      dates: output.dates.map((d) => orNull(d.quote)),
      organizations: organizations.map((o) => orNull(o.quote)),
      people: people.map((p) => orNull(p.quote)),
    },
    meta,
  };
}

function orNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Keeps the first of items whose key matches regardless of letter case. */
function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item).toLocaleLowerCase('pl');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function uniqueNames(items: { name: string; quote: string }[]): { name: string; quote: string }[] {
  const named = items.map((i) => ({ name: i.name.trim(), quote: i.quote })).filter((i) => i.name);
  return dedupe(named, (i) => i.name);
}

function describe(
  issues: { path: PropertyKey[]; message: string }[],
  path: (p: PropertyKey[]) => string,
): string[] {
  return issues.slice(0, 20).map((issue) => `- ${path(issue.path) || '(root)'}: ${issue.message}`);
}

/** ["amounts", 0, "currency"] becomes "amounts[0].currency". */
export function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)),
    '',
  );
}

/** Maps a path in the public response back to the key the model wrote, e.g. insight.document.date to date. */
export function modelPath(path: PropertyKey[]): string {
  const [root, section, ...rest] = path;
  if (root === 'insight') {
    if (section === 'document') return formatPath(rest);
    if (section === 'summary') return 'summarySentences';
    if (section === 'entities') {
      const [kind, index] = rest;
      return typeof index === 'number' ? `${String(kind)}[${index}].name` : formatPath(rest);
    }
    return formatPath(path.slice(1));
  }
  if (root === 'evidence') {
    const [index] = rest;
    const key = section === 'summary' ? 'summaryQuotes' : String(section);
    if (typeof index !== 'number') return key;
    return section === 'summary' ? `${key}[${index}]` : `${key}[${index}].quote`;
  }
  return formatPath(path);
}
