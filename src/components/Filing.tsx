import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from '../hooks.ts';
import { CARDS, cardPath, filingFrame, PILES, pileSidePath, SCENE, TYPE } from '../lib/filing.ts';
import styles from './Filing.module.css';

/** The card shown on top of the written pile before the first card lands there. */
const LAST = CARDS.length - 1;

/** A squared-up pile: the edges of the cards under the top one, as one strip along its right and bottom sides. */
function Pile({ x }: { x: number }) {
  return <path d={pileSidePath(x)} fill="var(--rule-strong)" />;
}

interface FacesProps {
  shown: number;
  /** Words on the shown face; null for all of them. */
  typed: number | null;
  groups: RefObject<(SVGGElement | null)[]>;
}

/** Every layout's words, one group per layout; only the group in use is displayed. */
function Faces({ shown, typed, groups }: FacesProps) {
  return CARDS.map((card, i) => (
    <g
      key={i}
      ref={(node) => {
        groups.current[i] = node;
      }}
      display={i === shown ? undefined : 'none'}
    >
      {card.words.map((word, j) => (
        <rect
          key={j}
          x={word.x}
          y={word.y}
          width={word.width}
          height={TYPE.height}
          rx={TYPE.radius}
          visibility={typed === null || j < typed ? undefined : 'hidden'}
        />
      ))}
    </g>
  ));
}

/**
 * The wait for the analysis: the document is being catalogued. The top card on the blank pile is typed word by
 * word, the way the model writes its answer, then slid across onto the written pile. Silent on purpose: the waiting
 * is the build-up, and sound and touch are kept for the moment the result is highlighted.
 * Before the text goes out it lies blank; with reduced motion one written card stays still.
 */
export function Filing({ writing }: { writing: boolean }) {
  const reduced = useReducedMotion();
  const movingRef = useRef<SVGGElement>(null);
  const typingFaces = useRef<(SVGGElement | null)[]>([]);
  const writtenFaces = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const moving = movingRef.current;
    if (!writing || reduced || !moving) return;
    const typing = typingFaces.current;
    const written = writtenFaces.current;

    let raf = 0;
    let origin: number | null = null;
    // What the DOM shows now, so a frame only touches what changed.
    let shown = { typing: 0, typed: 0, written: LAST, x: 0 };

    const draw = (now: number) => {
      origin ??= now;
      const frame = filingFrame(now - origin);
      const x = Math.round(frame.slide * (PILES.written - PILES.blank) * 100) / 100;

      if (frame.typing !== shown.typing) {
        typing[shown.typing]?.setAttribute('display', 'none');
        typing[frame.typing]?.removeAttribute('display');
      }
      if (frame.typing !== shown.typing || frame.typed !== shown.typed) {
        typing[frame.typing]?.querySelectorAll('rect').forEach((rect, j) => {
          if (j < frame.typed) rect.removeAttribute('visibility');
          else rect.setAttribute('visibility', 'hidden');
        });
      }
      if (frame.written !== shown.written) {
        written[shown.written]?.setAttribute('display', 'none');
        written[frame.written]?.removeAttribute('display');
      }
      if (x !== shown.x) moving.setAttribute('transform', `translate(${x} 0)`);

      shown = { typing: frame.typing, typed: frame.typed, written: frame.written, x };
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [writing, reduced]);

  return (
    <svg
      className={styles.scene}
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      aria-hidden="true"
      // Remounted when the analysis starts, so the scene always begins with a blank card.
      key={writing && !reduced ? 'writing' : 'waiting'}
    >
      <Pile x={PILES.written} />
      <g transform={`translate(${PILES.written} 0)`}>
        <path d={cardPath(0, 0)} fill="var(--desk)" fillRule="evenodd" />
        <g fill="var(--ink-2)">
          <Faces shown={LAST} typed={null} groups={writtenFaces} />
        </g>
      </g>

      <Pile x={PILES.blank} />
      {/* The blank card under the top one: what is left when the top card slides away. */}
      <path d={cardPath(PILES.blank, 0)} fill="var(--desk)" fillRule="evenodd" />
      <g ref={movingRef}>
        <path d={cardPath(PILES.blank, 0)} fill="var(--desk)" fillRule="evenodd" />
        <g fill="var(--ink-2)">
          <Faces shown={0} typed={reduced ? null : 0} groups={typingFaces} />
        </g>
      </g>
    </svg>
  );
}
