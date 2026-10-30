import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null);

function subscribe(onChange) {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

// true = the visitor asked for less motion: render final states and skip loops, parallax and timelines.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
