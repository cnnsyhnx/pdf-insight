import { describe, expect, it } from 'vitest';
import { MARK } from '../components/mark.ts';
import { PEN } from '../components/pen.ts';
import { BEATS, minimumJerk, offscreenTravel, PEN_SCALE, PEN_TURN, splashFrame } from './splash.ts';

const travel = { approach: 200, lift: 180 };

/** The nib face's lower end on the page, for a pen whose face top is at (x, y). */
function faceBottom(x: number, y: number, scale = 1) {
  const fx = (PEN.face.bottom.x - PEN.face.top.x) * PEN_SCALE * scale;
  const fy = (PEN.face.bottom.y - PEN.face.top.y) * PEN_SCALE * scale;
  return {
    x: x + fx * Math.cos(PEN_TURN) - fy * Math.sin(PEN_TURN),
    y: y + fx * Math.sin(PEN_TURN) + fy * Math.cos(PEN_TURN),
  };
}

describe('splash geometry', () => {
  it('lays the nib face exactly on the cut end of the highlight', () => {
    const bottom = faceBottom(MARK.band.to, MARK.band.top);
    expect(bottom.x).toBeCloseTo(MARK.band.to - MARK.slant, 9);
    expect(bottom.y).toBeCloseTo(MARK.band.bottom, 9);
    expect(PEN_SCALE).toBeCloseTo(0.5, 9);
    expect((PEN_TURN * 180) / Math.PI).toBeCloseTo(28.07, 2);
  });

  it('moves like a hand: still at both ends', () => {
    expect(minimumJerk(0)).toBe(0);
    expect(minimumJerk(1)).toBe(1);
    expect(minimumJerk(0.5)).toBeCloseTo(0.5, 9);
    const slope = (x: number) => (minimumJerk(x + 1e-4) - minimumJerk(x)) / 1e-4;
    expect(slope(0)).toBeCloseTo(0, 3);
    expect(slope(0.9999)).toBeCloseTo(0, 2);
  });
});

describe('splashFrame', () => {
  it('starts with the name printed and no highlight', () => {
    const first = splashFrame(0, travel);
    expect(first.bandTo).toBe(MARK.band.from);
    expect(first.pen).toBeNull();
    expect(first.lift).toBe(0);
  });

  it('brings the pen in from off the page to the start of the line', () => {
    const entering = splashFrame(BEATS.approach.from, travel);
    expect(entering.pen?.scale).toBeCloseTo(1.08, 9);
    expect(
      Math.hypot((entering.pen?.x ?? 0) - MARK.band.from, (entering.pen?.y ?? 0) - MARK.band.top),
    ).toBeCloseTo(travel.approach, 6);
    const landed = splashFrame(BEATS.approach.to, travel);
    expect(landed.pen).toEqual({ x: MARK.band.from, y: MARK.band.top, scale: 1 });
  });

  it('keeps the highlight under the nib for the whole stroke', () => {
    for (let t = BEATS.stroke.from; t < BEATS.lift.from; t += 7) {
      const frame = splashFrame(t, travel);
      const x = frame.pen?.x ?? Number.NaN;
      expect(frame.pen?.y).toBe(MARK.band.top);
      expect(frame.bandTo).toBeGreaterThanOrEqual(x);
      expect(frame.bandTo - x).toBeLessThanOrEqual(0.15 + 1e-9);
    }
    expect(splashFrame(BEATS.stroke.to, travel).bandTo).toBe(MARK.band.to);
  });

  it('lifts the pen away and leaves the completed logo', () => {
    const leaving = splashFrame(BEATS.lift.to - 1, travel);
    expect(leaving.pen?.scale).toBeGreaterThan(1.07);
    const after = splashFrame(BEATS.lift.to, travel);
    expect(after.pen).toBeNull();
    expect(after.bandTo).toBe(MARK.band.to);
  });

  it('lifts the page last and then ends', () => {
    expect(splashFrame(BEATS.exit.from, travel).lift).toBe(0);
    const middle = splashFrame((BEATS.exit.from + BEATS.exit.to) / 2, travel).lift;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(0.5);
    expect(splashFrame(BEATS.exit.to, travel)).toMatchObject({ lift: 1, done: true });
  });
});

describe('offscreenTravel', () => {
  it('takes the pen past the nearer of the right and bottom edges', () => {
    // A phone: the mark is 52 px wide, near the middle of a 390 x 844 screen.
    const mark = { left: 40, top: 400, width: 52 };
    const result = offscreenTravel(mark, { width: 390, height: 844 }, 0);
    const unit = 52 / 32;
    const end = (d: number) => ({
      x: MARK.band.to + Math.cos(PEN_TURN) * d,
      y: MARK.band.top + Math.sin(PEN_TURN) * d,
    });
    const point = end(result.lift);
    const leftmost = mark.left + (point.x - MARK.slant * 1.08) * unit;
    const topmost = mark.top + point.y * unit;
    expect(leftmost >= 390 - 1e-6 || topmost >= 844 - 1e-6).toBe(true);
    expect(result.approach).toBeGreaterThan(result.lift);
  });
});
