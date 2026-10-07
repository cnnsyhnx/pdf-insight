import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect, useRef } from 'react';
import { copy } from '../copy.ts';
import { useElementWidth } from '../hooks.ts';
import type { Rect } from '../lib/evidence.ts';
import { renderPage, type PageText } from '../lib/pdf.ts';
import { strokePath } from '../lib/stroke.ts';
import type { PageStroke } from '../lib/strokes.ts';
import styles from './EvidenceCrop.module.css';

interface Props {
  doc: PDFDocumentProxy;
  page: PageText;
  total: number;
  stroke: PageStroke;
  onWholePage: () => void;
}

/** Page text on a phone is about 5 px tall at full width; this magnification makes it about 11 px. */
const ZOOM = 2.2;

/**
 * The strip of the page to show: the quote's lines plus one line above and below, snapped to whole lines,
 * and horizontally from a little before the quote to a little after it.
 */
function cropWindow(page: PageText, rects: Rect[]) {
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  const line = rects[0]?.h ?? 0.012;
  const near = page.runs.filter((run) => run.y + run.h > top - line * 1.6 && run.y < bottom + line * 1.6);
  const pad = line * 0.35;
  const y0 = Math.max(0, Math.min(top, ...near.map((r) => r.y)) - pad);
  const y1 = Math.min(1, Math.max(bottom, ...near.map((r) => r.y + r.h)) + pad);
  const x0 = Math.max(0, Math.min(...near.map((r) => r.x), ...rects.map((r) => r.x)) - 0.02);
  const x1 = Math.min(1, Math.max(...near.map((r) => r.x + r.w), ...rects.map((r) => r.x + r.w)) + 0.02);
  return { x0, y0, span: x1 - x0, height: y1 - y0 };
}

/**
 * On phones: a magnified strip of the real page around a highlight, opened in place under the value it proves.
 * It is wider than the screen, so it scrolls sideways and opens at the start of the quote.
 */
export function EvidenceCrop({ doc, page, total, stroke, onWholePage }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = useElementWidth(scrollRef);

  const { x0, y0, span, height } = cropWindow(page, stroke.rects);
  const pageWidth = width * ZOOM;
  const cssWidth = Math.round(span * pageWidth);
  const cssHeight = Math.round(height * pageWidth * page.aspect);
  const viewHeight = 1000 * page.aspect;
  const quoteX = stroke.rects[0]?.x ?? x0;

  useEffect(() => {
    if (width === 0) return;
    const full = document.createElement('canvas');
    const handle = renderPage(doc, page.number, full, pageWidth);
    handle.done
      .then(() => {
        const target = canvasRef.current;
        if (!target) return;
        target.width = Math.round(span * full.width);
        target.height = Math.round(height * full.height);
        target
          .getContext('2d')
          ?.drawImage(
            full,
            x0 * full.width,
            y0 * full.height,
            target.width,
            target.height,
            0,
            0,
            target.width,
            target.height,
          );
        const scroller = scrollRef.current;
        if (scroller) scroller.scrollLeft = Math.max(0, (quoteX - x0) * pageWidth - 24);
      })
      .catch(() => {
        // Cancelled when the crop closes before the page is drawn.
      });
    return () => handle.cancel();
  }, [doc, page.number, width, pageWidth, x0, y0, span, height, quoteX]);

  return (
    <figure className={styles.crop}>
      <div ref={scrollRef} className={styles.scroller}>
        <div
          className={styles.paper}
          style={{ width: cssWidth || undefined, height: cssHeight || undefined }}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ width: cssWidth, height: cssHeight }}
            aria-hidden="true"
          />
          <svg
            className={styles.strokes}
            viewBox={`${x0 * 1000} ${y0 * viewHeight} ${span * 1000} ${height * viewHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {stroke.rects.map((rect, i) => (
              <path
                key={i}
                className={styles.stroke}
                d={strokePath(
                  { x: rect.x * 1000, y: rect.y * viewHeight, w: rect.w * 1000, h: rect.h * viewHeight },
                  stroke.seed + i,
                )}
              />
            ))}
          </svg>
        </div>
      </div>
      <figcaption className={styles.caption}>
        <span>{copy.document.page(page.number, total)}</span>
        <button type="button" className={styles.whole} onClick={onWholePage}>
          {copy.document.wholePage}
        </button>
      </figcaption>
    </figure>
  );
}
