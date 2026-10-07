/**
 * The chisel-tip highlighter seen from the side, in its own drawing units: barrel, end plug, collar and nib, and the
 * cap that covers the last two. The nib's flat face runs from `face.top` to `face.bottom`, 14° off vertical, the
 * same angle every highlight in the app is cut at.
 */
export const PEN = {
  barrel: 'M92 10H262Q266 10 266 14V50Q266 54 262 54H92Z',
  plug: 'M269 17H278Q282 17 282 21V43Q282 47 278 47H269Z',
  collar: 'M80 18H92V46H80Z',
  nib: 'M80 22H62L67 42H80Z',
  cap: 'M24 8H100V56H24Q12 56 12 44V20Q12 8 24 8Z',
  clip: 'M22.5 1H90Q92.5 1 92.5 3.5V8H84V5.5H22.5Q20 5.5 20 3.25Q20 1 22.5 1Z',
  face: { top: { x: 62, y: 22 }, bottom: { x: 67, y: 42 } },
} as const;
