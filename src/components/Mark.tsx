import type { CSSProperties, ReactNode } from 'react';
import type { Beat } from '../lib/reveal.ts';
import styles from './Mark.module.css';

interface Props {
  id?: string;
  children: ReactNode;
  label: string;
  active: boolean;
  /** A chisel nib has two edges: the broad one highlights, the narrow one underlines. */
  edge?: 'broad' | 'narrow';
  /** When set, the stroke is drawn in on this beat. */
  beat: Beat | null;
  onPick: (() => void) | null;
}

/** Words highlighted because they appear word for word in the PDF. Activating one shows them on the page. */
export function Mark({ id, children, label, active, edge = 'broad', beat, onPick }: Props) {
  const classes = [
    styles.mark,
    edge === 'narrow' ? styles.narrow : '',
    beat ? styles.reveal : '',
    active ? styles.active : '',
  ].join(' ');
  const style = beat
    ? ({ '--delay': `${beat.delay}ms`, '--dur': `${beat.duration}ms` } as CSSProperties)
    : undefined;

  if (!onPick) {
    return (
      <mark id={id} className={classes} style={style}>
        {children}
      </mark>
    );
  }
  return (
    <button id={id} type="button" className={classes} style={style} onClick={onPick} aria-label={label}>
      {children}
    </button>
  );
}
