import { minimumJerk } from './splash.ts';

/*
 * The wait for the analysis, as a cataloguer's desk seen from above: on the left a pile of blank catalogue cards,
 * on the right the cards already written. The top card is typed word by word, the way the model writes its answer,
 * then slid across onto the written pile, and the blank card under it is next. Units are millimetres.
 */

/** A library catalogue card, 125 x 75 mm, with the hole for the drawer rod punched near the bottom edge. */
export const CARD = { width: 125, height: 75, hole: { x: 62.5, y: 67.5, r: 3.75 } } as const;

/**
 * A squared-up pile, seen a little from the lower right: the edges of the cards under the top one show as one strip
 * along its right and bottom sides. The holes line up, so the desk shows through them.
 */
export const PILE_SIDE = { x: 1.6, y: 2.2 } as const;

/** The blank pile on the left, the written one on the right. */
export const PILES = { blank: 0, written: CARD.width + 16 } as const;

export const SCENE = {
  width: PILES.written + CARD.width + PILE_SIDE.x,
  height: CARD.height + PILE_SIDE.y,
} as const;

/**
 * Typewriter text, drawn as one bar per word: elite pitch, a narrow gap between words so a line reads as a line of
 * text and not as dashes, and square ends like typed letters.
 */
export const TYPE = {
  pitch: 2.3,
  height: 2,
  gap: 1.3,
  radius: 0.4,
  margin: 9,
  indent: 4,
  columns: 46,
} as const;

/**
 * A catalogue card's layout, line by line: the heading at the first indent, the title paragraph at the second indent
 * running back to the first, the description, then the tracings above the hole. Each word is its length in
 * characters; nothing on the card is readable, the drawing carries no data.
 */
export interface Line {
  y: number;
  /** Starts at the second indent: the first line of a paragraph. */
  indent: boolean;
  /** The first line of a new paragraph gets a longer pause before it. */
  paragraph: boolean;
  words: number[];
}

const line = (y: number, indent: boolean, paragraph: boolean, words: number[]): Line => ({
  y,
  indent,
  paragraph,
  words,
});

// No word shorter than three characters: at this size a two-letter word becomes a dot, and a line of dots and
// dashes reads as Morse code.
export const LAYOUTS: Line[][] = [
  [
    line(10, false, true, [9, 7]),
    line(16.5, true, true, [6, 3, 9, 5, 7, 4]),
    line(22, false, false, [8, 4, 10, 3, 6, 7]),
    line(27.5, false, false, [5, 9, 3, 6]),
    line(34, true, true, [7, 5, 8]),
    line(46, true, true, [3, 8, 4, 5]),
  ],
  [
    line(10, false, true, [11, 4]),
    line(16.5, true, true, [8, 3, 6, 11, 3, 5]),
    line(22, false, false, [7, 6, 3, 9, 4, 8]),
    line(27.5, false, false, [10, 4]),
    line(34, true, true, [5, 3, 6, 4]),
    line(46, true, true, [3, 6, 3, 7]),
  ],
  [
    line(10, false, true, [6, 10]),
    line(16.5, true, true, [9, 5, 7, 3, 8, 5]),
    line(22, false, false, [4, 8, 6, 10, 5, 6]),
    line(27.5, false, false, [7, 3, 9]),
    line(34, true, true, [4, 6, 3, 5]),
    line(46, true, true, [3, 9, 3, 4]),
  ],
];

/** One typed word: its bar on the card and when it appears, in ms from the moment the card is ready. */
export interface TypedWord {
  x: number;
  y: number;
  width: number;
  at: number;
}

export interface TypedCard {
  words: TypedWord[];
  /** When the last word is down. */
  done: number;
}

/** Before the first word: the blank card lies there for a moment. */
const READY_MS = 260;
/** Between words, longer for longer words: about the pace at which the model streams its answer. */
const wordGap = (chars: number) => 34 + 5 * chars;
const NEW_LINE_MS = 80;
const NEW_PARAGRAPH_MS = 150;
/** The finished card stays put for a beat before it is slid away. */
export const HOLD_MS = 320;
/** The slide onto the written pile: one hand movement, from rest to rest. */
export const SLIDE_MS = 480;

/** Places every word in typewriter columns and gives it its moment. */
export function typeset(layout: Line[]): TypedCard {
  const words: TypedWord[] = [];
  let clock = READY_MS;
  layout.forEach((row, i) => {
    if (i > 0) clock += row.paragraph ? NEW_PARAGRAPH_MS : NEW_LINE_MS;
    let column = row.indent ? TYPE.indent : 0;
    row.words.forEach((chars, j) => {
      if (j > 0) clock += wordGap(row.words[j - 1] ?? chars);
      words.push({
        x: TYPE.margin + column * TYPE.pitch,
        y: row.y,
        // The bar runs into the space after the word, leaving only the narrow gap of typed text.
        width: (chars + 1) * TYPE.pitch - TYPE.gap,
        at: clock,
      });
      column += chars + 1;
    });
  });
  return { words, done: clock };
}

export const CARDS: TypedCard[] = LAYOUTS.map(typeset);

const cardLength = (card: TypedCard) => card.done + HOLD_MS + SLIDE_MS;

/** One pass through every layout; the scene at the end is the scene at the start. */
export const LOOP_MS = CARDS.reduce((sum, card) => sum + cardLength(card), 0);

export interface FilingFrame {
  /** Layout on the card being typed, the top of the blank pile. */
  typing: number;
  /** How many of its words are on it. */
  typed: number;
  /** How far it has slid towards the written pile, 0 to 1, already eased. */
  slide: number;
  /** Layout on top of the written pile. */
  written: number;
}

export function filingFrame(elapsed: number): FilingFrame {
  let t = ((elapsed % LOOP_MS) + LOOP_MS) % LOOP_MS;
  for (const [index, card] of CARDS.entries()) {
    const length = cardLength(card);
    if (t < length || index === CARDS.length - 1) {
      return {
        typing: index,
        typed: card.words.filter((word) => word.at <= t).length,
        slide: minimumJerk((t - card.done - HOLD_MS) / SLIDE_MS),
        written: (index + CARDS.length - 1) % CARDS.length,
      };
    }
    t -= length;
  }
  throw new Error('unreachable: CARDS is never empty');
}

/** The side of a pile whose top card is at (x, 0): the strip that shows along its right and bottom edges. */
export function pileSidePath(x: number): string {
  const { width, height } = CARD;
  const { x: dx, y: dy } = PILE_SIDE;
  return `M${x + width} 0L${x + width + dx} ${dy}V${height + dy}H${x + dx}L${x} ${height}H${x + width}Z`;
}

/** The card's outline with the rod hole cut out (even-odd), at (x, y). */
export function cardPath(x: number, y: number): string {
  const { width, height, hole } = CARD;
  const cx = x + hole.x;
  const cy = y + hole.y;
  return (
    `M${x} ${y}H${x + width}V${y + height}H${x}Z` +
    `M${cx - hole.r} ${cy}a${hole.r} ${hole.r} 0 1 0 ${2 * hole.r} 0a${hole.r} ${hole.r} 0 1 0 ${-2 * hole.r} 0Z`
  );
}
