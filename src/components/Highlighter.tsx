import styles from './Highlighter.module.css';
import { PEN } from './pen.ts';

/**
 * A chisel-tip highlighter seen from the side, in one flat colour with the details cut out: the gap under the
 * clip, the step where the cap sits over the barrel, the seam of the end plug. When uncapped, the cap slides off
 * along the pen's axis and shows the nib, cut at the same 14° angle as every highlight in the app.
 */
export function Highlighter({ uncapped, className }: { uncapped: boolean; className?: string }) {
  const classes = [styles.pen, uncapped ? styles.uncapped : '', className ?? ''].join(' ');
  return (
    <svg className={classes} viewBox="-48 -4 336 68" fill="currentColor" aria-hidden="true">
      {/* Barrel, then the end plug behind a cut seam. */}
      <path d={PEN.barrel} />
      <path d={PEN.plug} />
      {/* Collar and chisel nib, hidden under the cap until it comes off. */}
      <path d={PEN.collar} />
      <path d={PEN.nib} />
      <g className={styles.cap}>
        <path d={PEN.cap} />
        <path d={PEN.clip} />
      </g>
    </svg>
  );
}
