import { describe, expect, it } from 'vitest';
import { CARD, CARDS, filingFrame, HOLD_MS, LAYOUTS, LOOP_MS, SLIDE_MS, TYPE } from './filing.ts';

describe('catalogue cards', () => {
  it('have the proportions of a 125 x 75 mm library card, rod hole centred near the bottom', () => {
    expect(CARD.width / CARD.height).toBeCloseTo(5 / 3, 9);
    expect(CARD.hole.x).toBe(CARD.width / 2);
    expect(CARD.height - (CARD.hole.y + CARD.hole.r)).toBeGreaterThan(3);
  });

  it('keep every line inside the typewriter columns', () => {
    for (const layout of LAYOUTS) {
      for (const row of layout) {
        const start = row.indent ? TYPE.indent : 0;
        const end = start + row.words.reduce((sum, chars) => sum + chars, 0) + row.words.length - 1;
        expect(end).toBeLessThanOrEqual(TYPE.columns);
      }
    }
  });

  it('keep every word on the card, inside the margins and clear of the rod hole', () => {
    for (const card of CARDS) {
      for (const word of card.words) {
        expect(word.x).toBeGreaterThanOrEqual(TYPE.margin);
        expect(word.x + word.width).toBeLessThanOrEqual(CARD.width - 7);
        expect(word.y + TYPE.height).toBeLessThan(CARD.hole.y - CARD.hole.r);
      }
    }
  });

  it('leave the same narrow gap between the words of a line', () => {
    for (const card of CARDS) {
      card.words.forEach((word, i) => {
        const next = card.words[i + 1];
        if (!next || next.y !== word.y) return;
        expect(next.x - (word.x + word.width)).toBeCloseTo(TYPE.gap, 9);
      });
    }
  });

  it('have no word short enough to read as a dot', () => {
    for (const layout of LAYOUTS) {
      for (const row of layout) expect(Math.min(...row.words)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('filingFrame', () => {
  it('starts with a blank card on the blank pile and the last card on the written one', () => {
    expect(filingFrame(0)).toEqual({ typing: 0, typed: 0, slide: 0, written: CARDS.length - 1 });
  });

  it('types the words in reading order and never takes one back', () => {
    const first = CARDS[0];
    if (!first) throw new Error('no cards');
    let previous = 0;
    for (let t = 0; t < first.done; t += 5) {
      const { typing, typed, slide } = filingFrame(t);
      expect(typing).toBe(0);
      expect(typed).toBeGreaterThanOrEqual(previous);
      expect(typed).toBeLessThan(first.words.length);
      expect(slide).toBe(0);
      previous = typed;
    }
    expect(filingFrame(first.done).typed).toBe(first.words.length);
  });

  it('slides the card only after it is finished and has stayed still for a beat', () => {
    const first = CARDS[0];
    if (!first) throw new Error('no cards');
    expect(filingFrame(first.done + HOLD_MS - 1).slide).toBe(0);
    const middle = filingFrame(first.done + HOLD_MS + SLIDE_MS / 2);
    expect(middle.slide).toBeCloseTo(0.5, 9);
    expect(middle.typed).toBe(first.words.length);
    expect(filingFrame(first.done + HOLD_MS + SLIDE_MS - 1).slide).toBeGreaterThan(0.999);
  });

  it('lands the card on the written pile and puts the next blank card in its place', () => {
    const first = CARDS[0];
    if (!first) throw new Error('no cards');
    const landed = first.done + HOLD_MS + SLIDE_MS;
    expect(filingFrame(landed)).toEqual({ typing: 1, typed: 0, slide: 0, written: 0 });
  });

  it('loops without a seam', () => {
    expect(filingFrame(LOOP_MS)).toEqual(filingFrame(0));
    expect(filingFrame(LOOP_MS + 1234)).toEqual(filingFrame(1234));
    const end = filingFrame(LOOP_MS - 1);
    expect(end.typing).toBe(CARDS.length - 1);
    expect(end.slide).toBeGreaterThan(0.999);
  });

  it('files a card every three seconds or so, a few of them during a typical analysis', () => {
    for (const card of CARDS) {
      const length = card.done + HOLD_MS + SLIDE_MS;
      expect(length).toBeGreaterThan(2500);
      expect(length).toBeLessThan(4000);
    }
  });
});
