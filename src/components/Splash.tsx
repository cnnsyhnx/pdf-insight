import { useEffect, useEffectEvent, useRef } from 'react';
import { BEATS, offscreenTravel, penTransform, splashFrame } from '../lib/splash.ts';
import { bandPath, MARK } from './mark.ts';
import { PEN } from './pen.ts';
import styles from './Splash.module.css';

const FONT = '600 64px "Libre Franklin Variable"';
const FONT_WAIT_MS = 700;
/** Past the screen edge by this much before the pen counts as gone. */
const OFFSCREEN_MARGIN = 24;
const SKIP_EVENTS = ['pointerdown', 'keydown', 'wheel', 'dragenter'] as const;

/** Waits for the brand face, so the name never jumps from a fallback font mid-scene; never longer than a moment. */
function fontsReady(): Promise<void> {
  if (document.fonts.check(FONT)) return Promise.resolve();
  const loaded = document.fonts.load(FONT).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS))]);
}

/**
 * The opening, on every page load: the name is printed on the page, the highlighter completes the logo with one
 * stroke and leaves, and the page is lifted away to show the app. Any key, click or touch skips to the lift.
 * Every frame comes from one clock (lib/splash.ts), so the ink can never run ahead of or behind the nib.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<SVGSVGElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGGElement>(null);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const sheet = sheetRef.current;
    const lockup = lockupRef.current;
    const mark = markRef.current;
    const band = bandRef.current;
    const pen = penRef.current;
    if (!sheet || !lockup || !mark || !band || !pen) return;

    let raf = 0;
    let origin: number | null = null;
    let skipped = 0;
    let stopped = false;
    let travel = { approach: 0, lift: 0 };

    const draw = (now: number) => {
      if (stopped) return;
      origin ??= now;
      const frame = splashFrame(now - origin + skipped, travel);
      band.setAttribute('d', frame.bandTo > MARK.band.from ? bandPath(frame.bandTo) : 'M0 0');
      if (frame.pen) {
        pen.removeAttribute('display');
        pen.setAttribute('transform', penTransform(frame.pen));
      } else {
        pen.setAttribute('display', 'none');
      }
      if (frame.lift > 0) {
        sheet.style.transform = `translate3d(0, ${(-frame.lift * (window.innerHeight + 2)).toFixed(1)}px, 0)`;
        sheet.style.pointerEvents = 'none';
      }
      if (frame.done) {
        stopped = true;
        finish();
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    const begin = () => {
      if (stopped || origin !== null || raf) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      travel = offscreenTravel(mark.getBoundingClientRect(), viewport, OFFSCREEN_MARGIN);
      lockup.dataset.ready = '';
      raf = requestAnimationFrame(draw);
    };

    const skip = () => {
      const elapsed = origin === null ? 0 : performance.now() - origin;
      skipped = Math.max(skipped, BEATS.exit.from - elapsed);
      begin();
    };

    for (const type of SKIP_EVENTS) window.addEventListener(type, skip, { passive: true });
    void fontsReady().then(begin);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const type of SKIP_EVENTS) window.removeEventListener(type, skip);
    };
  }, []);

  const [first, second] = MARK.lines;
  return (
    <div ref={sheetRef} className={styles.sheet} aria-hidden="true" data-splash>
      <div ref={lockupRef} className={styles.lockup}>
        <svg ref={markRef} className={styles.mark} viewBox="0 0 32 32">
          <rect
            x={first.x}
            y={first.y}
            width={first.width}
            height={MARK.lineHeight}
            rx="1.5"
            fill="currentColor"
          />
          <path ref={bandRef} d="M0 0" fill="var(--marker)" />
          <rect
            x={second.x}
            y={second.y}
            width={second.width}
            height={MARK.lineHeight}
            rx="1.5"
            fill="currentColor"
          />
          <g ref={penRef} display="none" fill="currentColor">
            <path d={PEN.barrel} />
            <path d={PEN.plug} />
            <path d={PEN.collar} />
            <path d={PEN.nib} />
          </g>
        </svg>
        <span className={styles.word}>PDF Insight</span>
      </div>
    </div>
  );
}
