import type { Rect } from './evidence.ts';

/** The highlighter's nib is cut at 14 degrees; the logo and the text highlights use the same angle. */
const NIB = Math.tan((14 * Math.PI) / 180);

/** FNV-1a: a stable number from a string, used to seed each stroke. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic random generator: a stroke looks hand-drawn but is identical on every render. */
function random(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One highlighter stroke over a line of text, in the coordinate space of `box`:
 * chisel-cut ends at the nib angle, a slight overshoot past the words and edges that waver
 * the way a felt tip does on paper.
 */
export function strokePath(box: Rect, seed: number): string {
  const rand = random(seed);
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;

  const height = box.h * 0.94;
  const top = box.y + box.h * 0.05 + jitter(box.h * 0.025);
  const bottom = top + height;
  const lean = height * NIB;
  const left = box.x - height * 0.24 + jitter(height * 0.06);
  const right = box.x + box.w + height * 0.2 + jitter(height * 0.06);
  const length = right - left;
  const waver = height * 0.03;

  return [
    `M${r1(left + lean)} ${r1(top)}`,
    `C${r1(left + lean + length * 0.33)} ${r1(top + jitter(waver))} ${r1(left + lean + length * 0.66)} ${r1(top + jitter(waver))} ${r1(right)} ${r1(top + jitter(waver))}`,
    `L${r1(right - lean)} ${r1(bottom)}`,
    `C${r1(right - lean - length * 0.33)} ${r1(bottom + jitter(waver))} ${r1(right - lean - length * 0.66)} ${r1(bottom + jitter(waver))} ${r1(left)} ${r1(bottom + jitter(waver))}`,
    'Z',
  ].join(' ');
}

/** How long a hand takes to draw a stroke of this length: about 1.3 page widths per second, never instant. */
export const strokeDuration = (relativeLength: number): number =>
  Math.round(Math.min(Math.max(relativeLength * 760, 180), 520));
