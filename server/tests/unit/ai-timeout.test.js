import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../../src/services/ai/index.js';

// a stand-in for an AbortSignal that records who is listening
function fakeSignal() {
  const listeners = new Set();
  return {
    aborted: false,
    listeners,
    addEventListener: vi.fn((type, fn) => { if (type === 'abort') listeners.add(fn); }),
    removeEventListener: vi.fn((type, fn) => { if (type === 'abort') listeners.delete(fn); }),
    abort() { this.aborted = true; [...listeners].forEach((fn) => fn()); },
  };
}

describe('withTimeout', () => {
  it('returns what the work returns when it finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), fakeSignal())).resolves.toBe('done');
  });

  it('passes the work\'s own error through unchanged', async () => {
    const boom = new Error('provider said no');
    await expect(withTimeout(Promise.reject(boom), fakeSignal())).rejects.toBe(boom);
  });

  it('rejects with a 504 "timed out" ProviderError when the signal aborts first', async () => {
    const signal = fakeSignal();
    const racing = withTimeout(new Promise(() => {}), signal);
    signal.abort();
    await expect(racing).rejects.toMatchObject({ status: 504, retryable: true, message: 'timed out' });
  });

  it('removes its abort listener once the work has finished (no listener left behind after a success)', async () => {
    const signal = fakeSignal();
    await withTimeout(Promise.resolve('x'), signal);
    expect(signal.listeners.size).toBe(0);
    expect(signal.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('removes it after a failure too', async () => {
    const signal = fakeSignal();
    await withTimeout(Promise.reject(new Error('x')), signal).catch(() => {});
    expect(signal.listeners.size).toBe(0);
  });

  it('removes it after a timeout too', async () => {
    const signal = fakeSignal();
    const racing = withTimeout(new Promise(() => {}), signal).catch(() => {});
    signal.abort();
    await racing;
    expect(signal.listeners.size).toBe(0);
  });

  it('a signal that is already aborted rejects at once, without waiting for an event that will never come', async () => {
    const signal = fakeSignal();
    signal.aborted = true;
    await expect(withTimeout(new Promise(() => {}), signal)).rejects.toMatchObject({ status: 504 });
  });

  it('many calls in a row leave nothing registered', async () => {
    const signal = fakeSignal();
    for (let i = 0; i < 50; i++) await withTimeout(Promise.resolve(i), signal);
    expect(signal.listeners.size).toBe(0);
  });
});
