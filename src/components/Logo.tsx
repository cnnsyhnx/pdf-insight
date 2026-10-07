import styles from './Logo.module.css';
import { bandPath, MARK } from './mark.ts';

/**
 * The mark: two lines of text, the second one highlighted. The stroke is cut at the same 14° nib angle
 * as every highlight in the app. public/favicon.svg is the same drawing.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  const [first, second] = MARK.lines;
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x={first.x}
        y={first.y}
        width={first.width}
        height={MARK.lineHeight}
        rx="1.5"
        fill="currentColor"
      />
      <path d={bandPath()} fill="var(--marker)" />
      <rect
        x={second.x}
        y={second.y}
        width={second.width}
        height={MARK.lineHeight}
        rx="1.5"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.word}>PDF Insight</span>
    </span>
  );
}
