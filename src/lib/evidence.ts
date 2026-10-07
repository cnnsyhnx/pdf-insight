import type { PageText, TextRun } from './pdf.ts';

/** A box on a page in page-relative units (0..1), y measured from the top. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a quote sits in the PDF: its page and one box per line it spans. */
export interface Found {
  page: number;
  rects: Rect[];
}

/**
 * Unifies characters that PDFs and language models write differently, so a quote can match the page.
 * Written as code points because several of them are invisible or look alike in an editor.
 */
export function normalizeChar(c: string): string {
  switch (c.codePointAt(0)) {
    case 0x00ad: // soft hyphen: only marks where a word may break
      return '';
    case 0x2018: // ‘
    case 0x2019: // ’
    case 0x201a: // ‚
      return "'";
    case 0x201c: // “
    case 0x201d: // ”
    case 0x201e: // „
      return '"';
    case 0x2010: // hyphen
    case 0x2011: // non-breaking hyphen
    case 0x2012: // figure dash
    case 0x2013: // en dash
      return '-';
    default:
      return /\s/.test(c) ? ' ' : c;
  }
}

/** Lower case that never changes the string length, so indices stay aligned. */
function lowerOf(c: string): string {
  const lower = c.toLocaleLowerCase('pl');
  return lower.length === c.length ? lower : c;
}

function lowerAll(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) out += lowerOf(s.charAt(i));
  return out;
}

/** Normalizes a quote the same way page text is normalized. */
export function normalizeQuote(quote: string): string {
  let out = '';
  for (let i = 0; i < quote.length; i++) {
    const c = normalizeChar(quote.charAt(i));
    if (c === ' ') {
      if (out !== '' && !out.endsWith(' ')) out += ' ';
    } else {
      out += c;
    }
  }
  return out.trim();
}

interface CharRef {
  run: number;
  offset: number;
}

export interface PageIndex {
  page: number;
  text: string;
  lower: string;
  /** For every character of `text`, the run and offset it came from; null for inserted spaces. */
  refs: (CharRef | null)[];
}

const sameLine = (a: TextRun, b: TextRun) => Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5;

/** Joins a page's runs into searchable text, remembering where every letter came from. */
export function indexPage(page: PageText): PageIndex {
  let text = '';
  let lower = '';
  const refs: (CharRef | null)[] = [];
  const space = () => {
    if (text !== '' && !text.endsWith(' ')) {
      text += ' ';
      lower += ' ';
      refs.push(null);
    }
  };

  page.runs.forEach((run, r) => {
    const prev = page.runs[r - 1];
    // A new line, or a horizontal gap wider than a word space, separates words even without a space character.
    if (prev && (!sameLine(prev, run) || run.x - (prev.x + prev.w) > prev.h * 0.12)) space();
    for (let o = 0; o < run.str.length; o++) {
      const c = normalizeChar(run.str.charAt(o));
      if (c === '') continue;
      if (c === ' ') {
        space();
        continue;
      }
      text += c;
      lower += lowerOf(c);
      refs.push({ run: r, offset: o });
    }
    if (run.eol) space();
  });

  return { page: page.number, text, lower, refs };
}

/** Boxes covering the given characters, one per line; characters are assumed evenly spread across a run. */
function rectsFor(runs: TextRun[], refs: (CharRef | null)[]): Rect[] {
  const spans = new Map<number, { from: number; to: number }>();
  for (const ref of refs) {
    if (!ref) continue;
    const span = spans.get(ref.run);
    if (span) {
      span.from = Math.min(span.from, ref.offset);
      span.to = Math.max(span.to, ref.offset);
    } else {
      spans.set(ref.run, { from: ref.offset, to: ref.offset });
    }
  }

  const rects: Rect[] = [];
  for (const [r, { from, to }] of [...spans].sort((a, b) => a[0] - b[0])) {
    const run = runs[r];
    if (!run) continue;
    const perChar = run.w / Math.max(run.str.length, 1);
    const rect = { x: run.x + perChar * from, y: run.y, w: perChar * (to - from + 1), h: run.h };
    const last = rects.at(-1);
    if (last && Math.abs(last.y - rect.y) < rect.h * 0.5 && rect.x - (last.x + last.w) < rect.h) {
      const right = Math.max(last.x + last.w, rect.x + rect.w);
      last.y = Math.min(last.y, rect.y);
      last.h = Math.max(last.h, rect.h);
      last.w = right - last.x;
    } else {
      rects.push(rect);
    }
  }
  return rects;
}

/**
 * Finds a quote word for word in the PDF, falling back to ignoring letter case, and returns where it sits.
 * Anything not found returns null: the app then shows the value without a highlight.
 */
export function locate(quote: string, pages: PageText[], indexes: PageIndex[]): Found | null {
  const needle = normalizeQuote(quote);
  if (needle.length < 2) return null;
  const needleLower = lowerAll(needle);
  for (const index of indexes) {
    let at = index.text.indexOf(needle);
    if (at < 0) at = index.lower.indexOf(needleLower);
    if (at < 0) continue;
    const page = pages.find((p) => p.number === index.page);
    if (!page) continue;
    const rects = rectsFor(page.runs, index.refs.slice(at, at + needle.length));
    if (rects.length > 0) return { page: index.page, rects };
  }
  return null;
}

/** Finds a quote inside plain text (the summary) and returns its start and end in the original string. */
export function findInText(text: string, quote: string): { start: number; end: number } | null {
  let norm = '';
  const refs: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = normalizeChar(text.charAt(i));
    if (c === '') continue;
    if (c === ' ') {
      if (norm !== '' && !norm.endsWith(' ')) {
        norm += ' ';
        refs.push(i);
      }
      continue;
    }
    norm += c;
    refs.push(i);
  }

  const needle = normalizeQuote(quote);
  if (needle === '') return null;
  let at = norm.indexOf(needle);
  if (at < 0) at = lowerAll(norm).indexOf(lowerAll(needle));
  if (at < 0) return null;
  const start = refs[at];
  const last = refs[at + needle.length - 1];
  if (start === undefined || last === undefined) return null;
  return { start, end: last + 1 };
}
