import { copy } from '../copy.ts';
import { countLabel, polishTypography, TYPE_LABEL } from '../lib/format.ts';
import type { HistoryEntry } from '../lib/history.ts';
import { CloseIcon } from './icons.tsx';
import styles from './Intro.module.css';

interface Props {
  wide: boolean;
  history: HistoryEntry[];
  onPick: () => void;
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
}

const savedAt = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function Intro({ wide, history, onPick, onOpen, onRemove }: Props) {
  return (
    <div className={styles.intro}>
      <h1 className={styles.title}>{polishTypography(copy.intro.title)}</h1>
      <p className={styles.lead}>{polishTypography(copy.intro.lead)}</p>

      <div className={styles.pickRow}>
        <button type="button" className={styles.pick} onClick={onPick}>
          {copy.intro.pick}
        </button>
        {wide && <span className={styles.hint}>{copy.intro.dropHint}</span>}
      </div>
      <p className={styles.privacy}>{polishTypography(copy.intro.privacy)}</p>
      <p className={styles.rights}>{copy.intro.rights}</p>

      {history.length > 0 && (
        <section className={styles.history} aria-labelledby="history-title">
          <h2 id="history-title" className={styles.historyTitle}>
            {copy.intro.history}
          </h2>
          <ul className={styles.list}>
            {history.map((entry) => {
              const doc = entry.result.document;
              const title = doc.title ?? doc.fileName;
              return (
                <li key={entry.id} className={styles.item}>
                  <button type="button" className={styles.open} onClick={() => onOpen(entry)}>
                    <span className={styles.name}>{polishTypography(title)}</span>
                    <span className={styles.meta}>
                      {TYPE_LABEL[doc.type]} · {countLabel(entry.pages, 'strona', 'strony', 'stron')} ·{' '}
                      {savedAt.format(new Date(entry.savedAt))}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => onRemove(entry.id)}
                    aria-label={copy.intro.remove(title)}
                  >
                    <CloseIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
