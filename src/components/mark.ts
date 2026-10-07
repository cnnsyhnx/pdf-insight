/**
 * The logo mark in its 32-unit square: two lines of text, the second under a highlight whose ends are cut at the
 * 14° nib angle. Logo.tsx, the splash and public/favicon.svg all draw from these numbers.
 */
export const MARK = {
  size: 32,
  lineHeight: 3,
  lines: [
    { x: 5, y: 7.5, width: 22 },
    { x: 6.5, y: 18, width: 16 },
  ],
  band: { from: 6.5, to: 28.5, top: 14.5, bottom: 24.5 },
  /** How far the band's cut ends lean over its height: 2.5 in 10, i.e. 14°. */
  slant: 2.5,
} as const;

/** The highlight from its start to `to`, both ends cut at the nib angle. */
export function bandPath(to: number = MARK.band.to): string {
  const { from, top, bottom } = MARK.band;
  return `M${from} ${top}H${to}L${to - MARK.slant} ${bottom}H${from - MARK.slant}Z`;
}
