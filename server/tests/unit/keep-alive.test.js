import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_INTERVAL_MS, keepAliveUrl, startKeepAlive } from '../../src/keep-alive.js';

const MIN = 60_000;
const quiet = () => ({ info: vi.fn(), warn: vi.fn() });
const ok = () => vi.fn(async () => ({ ok: true, status: 200 }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('keepAliveUrl (which address to ping)', () => {
  it('is the public address plus /api/health', () => {
    expect(keepAliveUrl('https://ai-mystery-room-api.onrender.com')).toBe('https://ai-mystery-room-api.onrender.com/api/health');
  });

  it('copes with a trailing slash and with extra slashes', () => {
    expect(keepAliveUrl('https://x.onrender.com/')).toBe('https://x.onrender.com/api/health');
    expect(keepAliveUrl('https://x.onrender.com///')).toBe('https://x.onrender.com/api/health');
  });

  it.each([
    ['plain http (Render always gives https; anything else is a mistake)', 'http://x.onrender.com'],
    ['not an address', 'not a url'],
    ['empty', ''],
    ['undefined', undefined],
    ['a number', 42],
    ['another scheme', 'ftp://x.example.com'],
    ['a javascript: address', 'javascript:alert(1)'],
  ])('refuses %s', (_name, value) => {
    expect(keepAliveUrl(value)).toBeNull();
  });
});

describe('startKeepAlive', () => {
  it('pings /api/health on the schedule, not at once, and again each interval', async () => {
    const fetchImpl = ok();
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl, log: quiet() });
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://x.onrender.com/api/health');
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('the default interval is 10 minutes: safely inside the 15 minutes after which a free Render service sleeps', () => {
    expect(DEFAULT_INTERVAL_MS).toBe(10 * MIN);
    expect(DEFAULT_INTERVAL_MS).toBeLessThan(15 * MIN);
  });

  it('is a GET with a time limit, so a stuck request cannot pile up', async () => {
    const fetchImpl = ok();
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl, log: quiet() });
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    const [, options] = fetchImpl.mock.calls[0];
    expect(options.method ?? 'GET').toBe('GET');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('never throws and never stops when the ping fails (network error, 500, timeout)', async () => {
    const log = quiet();
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, status: 200 });
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl, log });
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  it('logs a failure with a reason but without leaking anything but the status or error message', async () => {
    const log = quiet();
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 502 }), log });
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(log.warn.mock.calls[0][0]).toMatch(/502/);
  });

  it('does not start a second ping while the previous one is still running', async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((res) => { finish = () => res({ ok: true, status: 200 }); }));
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl, intervalMs: 1000, log: quiet() });
    await vi.advanceTimersByTimeAsync(3500);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // the slow one is still going
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('stop() ends the schedule (used when the server shuts down)', async () => {
    const fetchImpl = ok();
    const stop = startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl, log: quiet() });
    stop();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 5);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not keep the process alive on its own (the timer is unref-ed)', () => {
    const timer = { unref: vi.fn() };
    const setIntervalImpl = vi.fn(() => timer);
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl: ok(), setIntervalImpl, log: quiet() });
    expect(timer.unref).toHaveBeenCalled();
  });

  it('with an unusable address it does nothing, says why, and still returns a stop function', async () => {
    const log = quiet();
    const fetchImpl = ok();
    const stop = startKeepAlive({ baseUrl: 'http://insecure.example.com', fetchImpl, log });
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('says it started, with the address and the interval in minutes', () => {
    const log = quiet();
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl: ok(), log });
    expect(log.info.mock.calls[0][0]).toMatch(/https:\/\/x\.onrender\.com\/api\/health/);
    expect(log.info.mock.calls[0][0]).toMatch(/10 min/);
  });

  it('an interval below one minute is refused (it would hammer the free service)', () => {
    const setIntervalImpl = vi.fn(() => ({ unref() {} }));
    startKeepAlive({ baseUrl: 'https://x.onrender.com', fetchImpl: ok(), intervalMs: 1000, setIntervalImpl, log: quiet(), minIntervalMs: MIN });
    expect(setIntervalImpl.mock.calls[0][1]).toBeGreaterThanOrEqual(MIN);
  });
});
