import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/** True while the media query matches; follows changes (rotating a phone, resizing a window). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
}

export const useWide = () => useMediaQuery('(min-width: 960px)');
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** Width of an element in CSS pixels, kept up to date with a ResizeObserver. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Whole seconds since `since`, ticking once a second; null when there is nothing to time. */
export function useElapsedSeconds(since: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? null : Math.max(0, Math.floor((now - since) / 1000));
}
