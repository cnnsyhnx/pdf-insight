import { useEffect } from 'react';
import { copy } from '../copy.ts';
import { playCap } from '../lib/sound.ts';
import { Highlighter } from './Highlighter.tsx';
import styles from './DropSheet.module.css';

/**
 * drop: the drop target with its invitation. touch: phones, where the sheet is only tapped.
 * blank: a file is being read and the pages are on their way. note: a sentence printed on the sheet.
 */
export type SheetMode = 'drop' | 'touch' | 'blank' | 'note';

interface Props {
  mode: SheetMode;
  dragging: boolean;
  onPick: () => void;
  note?: string;
}

/** A blank A4 sheet on the desk with a capped highlighter lying on it. */
export function DropSheet({ mode, dragging, onPick, note }: Props) {
  useEffect(() => {
    if (dragging) playCap();
  }, [dragging]);

  return (
    <div className={`${styles.desk} ${mode === 'touch' ? styles.compact : ''}`}>
      <div className={`${styles.stage} ${dragging ? styles.dragging : ''}`}>
        <button
          type="button"
          className={styles.sheet}
          onClick={onPick}
          aria-label={copy.intro.pick}
          disabled={mode === 'blank'}
        >
          {mode === 'drop' && (
            <>
              <span className={styles.prompt}>{dragging ? copy.intro.sheetDragging : copy.intro.sheet}</span>
              <span className={styles.limit}>{copy.intro.sheetLimit}</span>
            </>
          )}
          {mode === 'touch' && <span className={styles.prompt}>{copy.intro.sheetTouch}</span>}
          {mode === 'note' && note && <span className={styles.prompt}>{note}</span>}
        </button>
        <Highlighter uncapped={dragging} className={styles.pen} />
      </div>
    </div>
  );
}
