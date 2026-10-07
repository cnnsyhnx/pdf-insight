import { MARK } from '../components/mark.ts';
import { PEN } from '../components/pen.ts';

/*
 * The opening: the name is printed on the page, the highlighter comes in, completes the logo with one stroke and
 * leaves, and the page is lifted away to show the app. Everything below is in the mark's 32-unit square.
 */

const face = { x: PEN.face.bottom.x - PEN.face.top.x, y: PEN.face.bottom.y - PEN.face.top.y };
const cut = { x: -MARK.slant, y: MARK.band.bottom - MARK.band.top };

/** The pen is drawn at the size where its nib face is exactly as long as the highlight's cut end... */
export const PEN_SCALE = Math.hypot(cut.x, cut.y) / Math.hypot(face.x, face.y);
/** ...and turned until the face lies on it. The body then points down and right, as in a right hand. */
export const PEN_TURN = Math.atan2(cut.y, cut.x) - Math.atan2(face.y, face.x);

const AXIS = { x: Math.cos(PEN_TURN), y: Math.sin(PEN_TURN) };

/** When each beat starts and ends, in ms from the first frame. */
export const BEATS = {
  approach: { from: 120, to: 460 },
  stroke: { from: 500, to: 780 },
  lift: { from: 820, to: 1100 },
  exit: { from: 1380, to: 1780 },
} as const;

/** Closer to the eye before the nib touches the paper and after it leaves it. */
const HOVER = 0.08;
/** The highlight runs this far under the nib, so no seam shows between the face and the ink. */
const UNDER_NIB = 0.15;

export interface PenPose {
  /** Top corner of the nib face. */
  x: number;
  y: number;
  scale: number;
}

export interface SplashFrame {
  /** Where the highlight ends; MARK.band.from means no highlight yet. */
  bandTo: number;
  pen: PenPose | null;
  /** How far the page has been lifted away, 0 to 1. */
  lift: number;
  done: boolean;
}

/** How far along its own axis the pen must travel to be off the screen, from touch-down and from lift-off. */
export interface Travel {
  approach: number;
  lift: number;
}

interface Beat {
  from: number;
  to: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const progress = (t: number, beat: Beat) => clamp01((t - beat.from) / (beat.to - beat.from));

/** A hand moving from rest to rest: no jolt at either end (the minimum-jerk profile). */
export function minimumJerk(x: number): number {
  const t = clamp01(x);
  return t * t * t * (10 + t * (6 * t - 15));
}

function along(from: { x: number; y: number }, distance: number, scale: number): PenPose {
  return { x: from.x + AXIS.x * distance, y: from.y + AXIS.y * distance, scale };
}

export function splashFrame(t: number, travel: Travel): SplashFrame {
  const { from, to, top } = MARK.band;
  // Pulled with a steady hand: constant acceleration, so the distance grows with the square of time.
  const lift = progress(t, BEATS.exit) ** 2;
  const done = t >= BEATS.exit.to;

  if (t < BEATS.approach.from) return { bandTo: from, pen: null, lift, done };
  if (t < BEATS.stroke.from) {
    const away = 1 - minimumJerk(progress(t, BEATS.approach));
    return {
      bandTo: from,
      pen: along({ x: from, y: top }, away * travel.approach, 1 + HOVER * away),
      lift,
      done,
    };
  }
  if (t < BEATS.lift.from) {
    const x = from + (to - from) * minimumJerk(progress(t, BEATS.stroke));
    return { bandTo: Math.min(to, x + UNDER_NIB), pen: { x, y: top, scale: 1 }, lift, done };
  }
  if (t < BEATS.lift.to) {
    const away = progress(t, BEATS.lift) ** 2;
    return { bandTo: to, pen: along({ x: to, y: top }, away * travel.lift, 1 + HOVER * away), lift, done };
  }
  return { bandTo: to, pen: null, lift, done };
}

/** SVG transform that puts the pen drawing's nib face at the pose. */
export function penTransform(pose: PenPose): string {
  const degrees = (PEN_TURN * 180) / Math.PI;
  return `translate(${pose.x} ${pose.y}) rotate(${degrees}) scale(${PEN_SCALE * pose.scale}) translate(${-PEN.face.top.x} ${-PEN.face.top.y})`;
}

/**
 * Travel distances for a mark drawn at `mark` (CSS px) in a viewport, with `margin` px to spare for motion blur.
 * The nib's top corner is the pen's highest point and its face's lower end the leftmost, so once those are past
 * the right or the bottom edge, the whole pen is.
 */
export function offscreenTravel(
  mark: { left: number; top: number; width: number },
  viewport: { width: number; height: number },
  margin: number,
): Travel {
  const unit = mark.width / MARK.size;
  const right = (viewport.width + margin - mark.left) / unit;
  const bottom = (viewport.height + margin - mark.top) / unit;
  const reach = (x: number, y: number) =>
    Math.max(0, Math.min((right - (x - MARK.slant * (1 + HOVER))) / AXIS.x, (bottom - y) / AXIS.y));
  return { approach: reach(MARK.band.from, MARK.band.top), lift: reach(MARK.band.to, MARK.band.top) };
}

/** On every page load, unless the system asks for less motion: then the logo in the top bar is all there is. */
export function shouldPlaySplash(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
