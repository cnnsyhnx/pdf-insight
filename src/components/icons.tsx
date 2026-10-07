/** Interface icons: 24 px grid, one 1.6 px stroke, round ends, drawn in the current text colour. */
const frame = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg {...frame}>
      <path d="M4.5 9.5H8L12.5 5.5V18.5L8 14.5H4.5Z" />
      {on ? (
        <>
          <path d="M15.8 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18.4 6.6a7.6 7.6 0 0 1 0 10.8" />
        </>
      ) : (
        <path d="M16.5 9.5 21 14M21 9.5 16.5 14" />
      )}
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...frame} width={16} height={16}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </svg>
  );
}
