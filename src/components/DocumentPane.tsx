import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { copy } from '../copy.ts';
import { useElementWidth, useReducedMotion } from '../hooks.ts';
import { renderPage, type PageText } from '../lib/pdf.ts';
import { strokeDuration, strokePath } from '../lib/stroke.ts';
import type { PageStroke, StrokeMap } from '../lib/strokes.ts';
import styles from './DocumentPane.module.css';

export interface Active {
  key: string;
  /** Bumped on every pick so the same highlight can be drawn again. */
  nonce: number;
  /** Where the pick came from; the other side scrolls to it. */
  from: 'text' | 'page';
}

interface Props {
  doc: PDFDocumentProxy;
  pages: PageText[];
  total: number;
  strokes: StrokeMap | null;
  active: Active | null;
  reveal: boolean;
  onPick: (key: string) => void;
}

/** The PDF itself: real pages on the desk, with the highlights drawn exactly where the quotes are. */
export function DocumentPane({ doc, pages, total, strokes, active, reveal, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const reduced = useReducedMotion();
  const gutter = width < 600 ? 32 : 96;
  const pageWidth = Math.max(Math.min(width - gutter, 760), 200);
  const activeStroke = active ? (strokes?.byKey.get(active.key) ?? null) : null;

  useEffect(() => {
    if (!activeStroke || active?.from !== 'text') return;
    document.getElementById(activeStroke.id)?.scrollIntoView({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [activeStroke, active, reduced]);

  return (
    <div ref={ref} className={styles.pane}>
      {width > 0 &&
        pages.map((page) => (
          <PdfPage
            key={page.number}
            doc={doc}
            page={page}
            total={total}
            width={pageWidth}
            strokes={strokes?.byPage.get(page.number) ?? []}
            activeId={activeStroke?.id ?? null}
            activeNonce={active?.nonce ?? 0}
            reveal={reveal}
            onPick={onPick}
          />
        ))}
    </div>
  );
}

interface PageProps {
  doc: PDFDocumentProxy;
  page: PageText;
  total: number;
  width: number;
  strokes: PageStroke[];
  activeId: string | null;
  activeNonce: number;
  reveal: boolean;
  onPick: (key: string) => void;
}

function PdfPage({ doc, page, total, width, strokes, activeId, activeNonce, reveal, onPick }: PageProps) {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const height = Math.round(width * page.aspect);
  const viewHeight = 1000 * page.aspect;

  // Pages are drawn when they come near the viewport, so a long PDF does not fill memory with canvases.
  useEffect(() => {
    const element = figureRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '900px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || !canvas) return;
    const handle = renderPage(doc, page.number, canvas, width);
    handle.done.catch(() => {
      // Cancelled by a newer render (resize) or a failed draw: the page stays blank paper.
    });
    return () => handle.cancel();
  }, [near, doc, page.number, width]);

  return (
    <figure ref={figureRef} className={styles.figure}>
      <div className={styles.paper} style={{ width, height }}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} aria-hidden="true" />
        {strokes.length > 0 && (
          <svg
            className={styles.strokes}
            viewBox={`0 0 1000 ${viewHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {strokes.map((stroke) =>
              stroke.rects.map((rect, i) => {
                const isActive = stroke.id === activeId;
                const style = {
                  '--delay': `${650 + stroke.order * 110 + i * 90}ms`,
                  '--dur': `${strokeDuration(rect.w)}ms`,
                } as CSSProperties;
                const box = {
                  x: rect.x * 1000,
                  y: rect.y * viewHeight,
                  w: rect.w * 1000,
                  h: rect.h * viewHeight,
                };
                return (
                  <path
                    key={`${stroke.id}-${i}-${isActive ? activeNonce : 'idle'}`}
                    className={[
                      styles.stroke,
                      reveal ? styles.reveal : '',
                      isActive ? styles.redraw : '',
                    ].join(' ')}
                    style={style}
                    d={strokePath(box, stroke.seed + i)}
                  />
                );
              }),
            )}
          </svg>
        )}
        {strokes.map((stroke) => {
          const first = stroke.rects[0];
          const key = stroke.keys[0];
          if (!first || !key) return null;
          return (
            <button
              key={stroke.id}
              id={stroke.id}
              type="button"
              tabIndex={-1}
              className={styles.hit}
              style={{
                left: `${first.x * 100}%`,
                top: `${first.y * 100}%`,
                width: `${first.w * 100}%`,
                height: `${first.h * 100}%`,
              }}
              aria-label={copy.document.strokeLabel(page.number)}
              onClick={() => onPick(key)}
            />
          );
        })}
      </div>
      <figcaption className={styles.caption}>{copy.document.page(page.number, total)}</figcaption>
    </figure>
  );
}
