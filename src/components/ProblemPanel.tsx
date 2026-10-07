import { copy, problemCopy, type Problem } from '../copy.ts';
import { polishTypography } from '../lib/format.ts';
import styles from './ProblemPanel.module.css';

interface Props {
  problem: Problem;
  file: File | null;
  /** The document's page count, when it is the problem. */
  pages: number | null;
  onRetry: () => void;
  onPick: () => void;
}

export function ProblemPanel({ problem, file, pages, onRetry, onPick }: Props) {
  const text = problemCopy(problem, file, pages);
  return (
    <div className={styles.problem} role="alert">
      {file && <p className={styles.file}>{file.name}</p>}
      <h1 className={styles.title}>{polishTypography(text.title)}</h1>
      <p className={styles.detail}>{polishTypography(text.detail)}</p>
      <div className={styles.actions}>
        {text.retry && (
          <button type="button" className={styles.primary} onClick={onRetry}>
            {copy.actions.retry}
          </button>
        )}
        <button type="button" className={text.retry ? styles.quiet : styles.primary} onClick={onPick}>
          {copy.actions.other}
        </button>
      </div>
    </div>
  );
}
