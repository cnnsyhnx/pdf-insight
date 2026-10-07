import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  OPS,
  PasswordException,
  Util,
} from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_PAGES } from './contract.ts';

// Vite emits the worker as a hashed asset under the app's base path, so it also resolves on GitHub Pages.
GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** One run of text as pdf.js reports it, in page-relative units (0..1) with y measured from the top. */
export interface TextRun {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  eol: boolean;
}

export interface PageText {
  /** 1-based page number. */
  number: number;
  /** Page height divided by page width. */
  aspect: number;
  runs: TextRun[];
  /** No text layer, but an image on the page: a scan. Its content cannot be read, so the app says so. */
  scan: boolean;
}

/** Operators that paint a picture; a page without text that uses one of them is a scan, not an empty page. */
const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
]);

export interface ReadPdf {
  doc: PDFDocumentProxy;
  pages: PageText[];
  chars: number;
}

export type PdfProblem = 'not-pdf' | 'too-large' | 'too-many-pages' | 'password' | 'damaged' | 'no-text';

export class PdfReadError extends Error {
  readonly problem: PdfProblem;
  /** The document's page count, when it is the problem. */
  readonly pages: number | null;

  constructor(problem: PdfProblem, pages: number | null = null) {
    super(problem);
    this.problem = problem;
    this.pages = pages;
  }
}

/** Rejects a file before reading it: too big, or not a PDF by its signature (the extension proves nothing). */
export async function checkFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) throw new PdfReadError('too-large');
  // The spec allows a few bytes of junk before the header, so look at the first kilobyte.
  const head = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
  if (!head.includes('%PDF-')) throw new PdfReadError('not-pdf');
}

export interface ReadProgress {
  doc: PDFDocumentProxy;
  page: PageText;
  total: number;
}

/** Opens the PDF and collects every page's text together with where each run sits; reports each page as it lands. */
export async function readPdf(
  data: ArrayBuffer,
  onPage?: (progress: ReadProgress) => void,
): Promise<ReadPdf> {
  // pdf.js 6 no longer compiles font code with eval (the CVE-2024-4367 path); its builds contain no `new Function`.
  const task = getDocument({ data: new Uint8Array(data) });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (error) {
    if (error instanceof PasswordException) throw new PdfReadError('password');
    if (error instanceof InvalidPDFException) throw new PdfReadError('damaged');
    throw error;
  }
  // Known as soon as the file opens, so a long document is turned away before a single page is read.
  if (doc.numPages > MAX_PAGES) {
    const count = doc.numPages;
    void task.destroy();
    throw new PdfReadError('too-many-pages', count);
  }

  const pages: PageText[] = [];
  let chars = 0;
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const runs: TextRun[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      // Map the run's text matrix into viewport space: [4] and [5] are the baseline origin, y grows downwards.
      const m: number[] = Util.transform(viewport.transform, item.transform);
      const fontSize = Math.hypot(m[2] ?? 0, m[3] ?? 0);
      const x = m[4] ?? 0;
      const baseline = m[5] ?? 0;
      runs.push({
        str: item.str,
        x: x / viewport.width,
        y: (baseline - fontSize * 0.86) / viewport.height,
        w: item.width / viewport.width,
        h: (fontSize * 1.1) / viewport.height,
        eol: item.hasEOL,
      });
      chars += item.str.length;
    }
    const scan = runs.length === 0 && (await page.getOperatorList()).fnArray.some((fn) => IMAGE_OPS.has(fn));
    const pageText = { number, aspect: viewport.height / viewport.width, runs, scan };
    pages.push(pageText);
    onPage?.({ doc, page: pageText, total: doc.numPages });
  }

  if (chars === 0) throw new PdfReadError('no-text');
  return { doc, pages, chars };
}

/** Plain text of one page, lines kept, for the analysis request. */
export function pageToText(page: PageText): string {
  let out = '';
  page.runs.forEach((run, i) => {
    const prev = page.runs[i - 1];
    if (prev && !prev.eol && run.x - (prev.x + prev.w) > prev.h * 0.12 && !out.endsWith(' ')) out += ' ';
    out += run.str;
    if (run.eol) out += '\n';
  });
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

export interface RenderHandle {
  done: Promise<void>;
  cancel: () => void;
}

/** Draws a page into a canvas at the given CSS width, sharp on high-density screens. */
export function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): RenderHandle {
  let cancelled = false;
  let cancelTask: (() => void) | null = null;
  const done = (async () => {
    const page = await doc.getPage(pageNumber);
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * density });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const task = page.render({ canvas, viewport });
    cancelTask = () => task.cancel();
    await task.promise;
  })();
  return {
    done,
    cancel: () => {
      cancelled = true;
      cancelTask?.();
    },
  };
}
