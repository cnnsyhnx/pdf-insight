export interface Beat {
  delay: number;
  duration: number;
}

/**
 * Timing for highlights drawn one after another, like a hand going down the text: each stroke takes longer the
 * more words it covers, and the next one starts as the pen leaves the previous. Sound and motion share this plan.
 */
export function planReveal(lengths: number[], start = 420): Beat[] {
  let clock = start;
  return lengths.map((chars) => {
    const duration = Math.round(Math.min(Math.max(chars * 21, 170), 460));
    const beat = { delay: clock, duration };
    clock += Math.round(duration * 0.8) + 70;
    return beat;
  });
}
