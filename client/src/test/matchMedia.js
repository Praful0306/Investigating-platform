// jsdom has no matchMedia. This fake lets tests flip prefers-reduced-motion, understands min/max-width against
// window.innerWidth (GSAP's matchMedia uses those), and notifies subscribers.
// Reduced motion is ON by default so animations are skipped in tests (specs/05-tests.md §4).
let reduced = true;
const listeners = new Set();

function matches(query) {
  if (/prefers-reduced-motion\s*:\s*reduce/.test(query)) return reduced;
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (min || max) return (!min || window.innerWidth >= Number(min[1])) && (!max || window.innerWidth <= Number(max[1]));
  return false; // hover / pointer queries: no fine pointer in tests, so pointer-only effects stay off
}

export function installMatchMedia() {
  window.matchMedia = (query) => ({
    matches: matches(query),
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
