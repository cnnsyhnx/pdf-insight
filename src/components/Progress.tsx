import { copy } from '../copy.ts';
import { useElapsedSeconds } from '../hooks.ts';
import { polishTypography } from '../lib/format.ts';
import { Filing } from './Filing.tsx';
import styles from './Progress.module.css';

type StepState = 'done' | 'now' | 'later';

interface Props {
  fileName: string;
  phase: 'reading' | 'analyzing';
  read: number;
  total: number | null;
  chars: number;
  startedAt: number | null;
  /** Pages that are images without text: said out loud, because their content will be missing from the result. */
  scanned: number[];
}

/** Real steps with real numbers: pages read, characters, seconds. No invented percentage. */
export function Progress({ fileName, phase, read, total, chars, startedAt, scanned }: Props) {
  const elapsed = useElapsedSeconds(phase === 'analyzing' ? startedAt : null);

  const steps: { label: string; state: StepState; detail: string }[] = [
    {
      label: copy.progress.read,
      state: phase === 'reading' ? 'now' : 'done',
      detail:
        phase === 'reading'
          ? total
            ? copy.progress.reading(read, total)
            : ''
          : copy.progress.readDone(total ?? read, chars),
    },
    {
      label: copy.progress.analyze,
      state: phase === 'analyzing' ? 'now' : 'later',
      detail: elapsed === null ? '' : copy.progress.seconds(elapsed),
    },
    { label: copy.progress.verify, state: 'later', detail: '' },
  ];

  return (
    <div className={styles.progress}>
      <Filing writing={phase === 'analyzing'} />
      <p className={styles.file}>{fileName}</p>
      <ol className={styles.steps} aria-live="polite">
        {steps.map((step) => (
          <li key={step.label} className={styles.step} data-state={step.state}>
            <span className={styles.label}>{step.label}</span>
            <span className={styles.detail}>{step.detail}</span>
            <span className={styles.state}>{copy.progress[step.state]}</span>
          </li>
        ))}
      </ol>
      {scanned.length > 0 && (
        <p className={styles.note}>{polishTypography(copy.progress.scanned(scanned))}</p>
      )}
    </div>
  );
}
