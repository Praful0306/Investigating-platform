// jsdom has no matchMedia. This fake lets tests flip prefers-reduced-motion and notifies subscribers.
// Reduced motion is ON by default so animations are skipped in tests (specs/05-tests.md §4).
let reduced = true;
const listeners = new Set();

export function installMatchMedia() {
  window.matchMedia = (query) => ({
    matches: /prefers-reduced-motion/.test(query) ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
    dispatchEvent: () => false,
  });
}

export function setReducedMotion(value) {
  reduced = value;
  for (const cb of [...listeners]) cb({ matches: value });
}

export const matchMediaListenerCount = () => listeners.size;
