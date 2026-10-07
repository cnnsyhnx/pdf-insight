import { copy } from '../copy.ts';
import { SoundIcon } from './icons.tsx';
import { Logo } from './Logo.tsx';
import styles from './TopBar.module.css';

interface Props {
  file: string | null;
  soundOn: boolean;
  onToggleSound: () => void;
  onNewFile: (() => void) | null;
  onDownload: (() => void) | null;
}

export function TopBar({ file, soundOn, onToggleSound, onNewFile, onDownload }: Props) {
  return (
    <header className={styles.bar}>
      <Logo />
      {file && (
        <p className={styles.file} title={file}>
          {file}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.icon}
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={copy.actions.sound}
          title={soundOn ? copy.actions.soundOn : copy.actions.soundOff}
        >
          <SoundIcon on={soundOn} />
        </button>
        {onNewFile && (
          <button type="button" className={styles.quiet} onClick={onNewFile}>
            {copy.actions.newFile}
          </button>
        )}
        {onDownload && (
          <button type="button" className={styles.primary} onClick={onDownload}>
            {copy.actions.download}
          </button>
        )}
      </div>
    </header>
  );
}
