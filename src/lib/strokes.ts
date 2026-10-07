import type { Analysis, Source } from './analysis.ts';
import type { Rect } from './evidence.ts';
import { hashString } from './stroke.ts';

/** One highlight on a page. Several values share it when they quote the same words. */
export interface PageStroke {
  id: string;
  page: number;
  rects: Rect[];
  keys: string[];
  seed: number;
  /** Position in reading order across the document: page first, then top to bottom. */
  order: number;
}

export interface StrokeMap {
  byPage: Map<number, PageStroke[]>;
  byKey: Map<string, PageStroke>;
}

const overlaps = (a: Rect, b: Rect) =>
  Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5 && a.x < b.x + b.w && b.x < a.x + a.w;

function unionInto(target: Rect[], extra: Rect[]): void {
  for (const rect of extra) {
    const hit = target.find((t) => overlaps(t, rect));
    if (!hit) {
      target.push({ ...rect });
      continue;
    }
    const right = Math.max(hit.x + hit.w, rect.x + rect.w);
    hit.x = Math.min(hit.x, rect.x);
    hit.w = right - hit.x;
    hit.y = Math.min(hit.y, rect.y);
    hit.h = Math.max(hit.h, rect.h);
  }
}

/**
 * Turns every located quote into strokes. Highlighter ink is transparent, so two strokes over the same words
 * would darken; quotes that overlap are merged into one stroke instead.
 * Keys: s0.. summary, a0.. amounts, d0.. dates, o0.. organisations, p0.. people.
 */
export function collectStrokes(analysis: Analysis): StrokeMap {
  const entries: [string, Source | null][] = [
    ...analysis.summaryMarks.map((m, i): [string, Source] => [`s${i}`, m.source]),
    ...analysis.sources.amounts.map((s, i): [string, Source | null] => [`a${i}`, s]),
    ...analysis.sources.dates.map((s, i): [string, Source | null] => [`d${i}`, s]),
    ...analysis.sources.organizations.map((s, i): [string, Source | null] => [`o${i}`, s]),
    ...analysis.sources.people.map((s, i): [string, Source | null] => [`p${i}`, s]),
  ];

  const strokes: PageStroke[] = [];
  const byKey = new Map<string, PageStroke>();
  for (const [key, source] of entries) {
    if (!source) continue;
    const { page, rects } = source.found;
    let stroke = strokes.find(
      (s) => s.page === page && s.rects.some((a) => rects.some((b) => overlaps(a, b))),
    );
    if (stroke) {
      unionInto(stroke.rects, rects);
    } else {
      stroke = { id: '', page, rects: rects.map((r) => ({ ...r })), keys: [], seed: 0, order: 0 };
      strokes.push(stroke);
    }
    stroke.keys.push(key);
    byKey.set(key, stroke);
  }

  strokes.sort((a, b) => a.page - b.page || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));
  const byPage = new Map<number, PageStroke[]>();
  strokes.forEach((stroke, order) => {
    stroke.order = order;
    stroke.id = `stroke-${order}`;
    stroke.seed = hashString(`${stroke.page}:${stroke.keys.join(',')}`);
    byPage.set(stroke.page, [...(byPage.get(stroke.page) ?? []), stroke]);
  });
  return { byPage, byKey };
}
