import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installMatchMedia, setReducedMotion } from './matchMedia.js';

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
