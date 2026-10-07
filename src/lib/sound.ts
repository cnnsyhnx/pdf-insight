const STORAGE_KEY = 'pdf-insight:sound';

let context: AudioContext | null = null;

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
  }
}

/** Browsers only allow audio after a gesture; every caller runs after a click or a dropped file. */
function audio(): AudioContext | null {
  if (!isSoundOn()) return null;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Brownish noise: closer to fibre dragging on paper than white hiss.
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.12) * 0.985;
    data[i] = last * 3.2;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

/** A felt tip drawn across paper: the sound lasts exactly as long as the stroke on screen. */
export function playStroke(durationMs: number, delayMs = 0): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delayMs / 1000;
  const length = durationMs / 1000;

  const src = noise(ctx, length + 0.05);
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 700;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(2600, start);
  band.frequency.linearRampToValueAtTime(3300, start + length);
  band.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.09, start + 0.025);
  gain.gain.setValueAtTime(0.09, start + Math.max(length - 0.05, 0.03));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.04);

  src.connect(high).connect(band).connect(gain).connect(ctx.destination);
  src.start(start);
  src.stop(start + length + 0.06);
}

/** The cap coming off a marker: a short dry click. */
export function playCap(): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noise(ctx, 0.04);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 1.4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start(t);
}

/** A short tap on phones that support vibration; silently nothing elsewhere. */
export function haptic(ms = 8): void {
  if ('vibrate' in navigator) navigator.vibrate(ms);
}
