import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { installMatchMedia, setReducedMotion } from './matchMedia.js';

// Pages are lazy-loaded and pull in GSAP: on a slow or busy machine that first import can take longer than the
// default 1 s wait. A test must not depend on how fast the computer is.
configure({ asyncUtilTimeout: 5000 });

// GSAP's ScrollTrigger calls matchMedia the moment it is imported, which happens before any beforeEach runs.
installMatchMedia();

beforeEach(() => {
  installMatchMedia();
  setReducedMotion(true);
  window.scrollTo = vi.fn();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
