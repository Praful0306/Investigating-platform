import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCountdown } from './useCountdown.js';
import { useElapsedSeconds } from './useElapsedSeconds.js';
import { useHealthWake } from './useHealthWake.js';

vi.mock('../api/cases.js', () => ({ health: vi.fn() }));
const { health } = await import('../api/cases.js');

// braces matter: a function returned from beforeEach is run by vitest as a cleanup, and mockReset() returns the mock
beforeEach(() => { health.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('useHealthWake', () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  it('pings /health once on mount', () => {
    health.mockResolvedValue({ ok: true });
    renderHook(() => useHealthWake());
    expect(health).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the server answers quickly', async () => {
    vi.useFakeTimers();
    health.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useHealthWake());
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.waking).toBe(false);
  });

  it('says "waking" after 3 s without an answer, and stops when it answers', async () => {
    vi.useFakeTimers();
    const d = deferred();
    health.mockReturnValue(d.promise);
    const { result } = renderHook(() => useHealthWake());
    expect(result.current.waking).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(result.current.waking).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(result.current.waking).toBe(true);
    await act(async () => { d.resolve({ ok: true }); await d.promise; });
    expect(result.current.waking).toBe(false);
  });

  it('a failed ping also clears the message (the page must not get stuck on it)', async () => {
    vi.useFakeTimers();
    let fail;
    const ping = new Promise((_resolve, reject) => { fail = reject; });
    ping.catch(() => {}); // the hook handles it; this keeps the test runner from reporting the deliberate failure
    health.mockReturnValue(ping);
    const { result } = renderHook(() => useHealthWake());
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(result.current.waking).toBe(true);
    await act(async () => { fail({ code: 'NETWORK' }); });
    expect(result.current.waking).toBe(false);
  });

  it('cleans up: no timer left and no update after unmount', async () => {
    vi.useFakeTimers();
    const d = deferred();
    health.mockReturnValue(d.promise);
    const { unmount } = renderHook(() => useHealthWake());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    d.resolve({ ok: true });
    await d.promise;
  });
});

describe('useElapsedSeconds', () => {
  it('is 0 while idle', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsedSeconds(false));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(0);
  });

  it('counts whole seconds while running', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsedSeconds(true));
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(3);
    act(() => { vi.advanceTimersByTime(27000); });
    expect(result.current).toBe(30);
  });

  it('resets when it stops and starts again', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ on }) => useElapsedSeconds(on), { initialProps: { on: true } });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(4);
    rerender({ on: false });
    expect(result.current).toBe(0);
    rerender({ on: true });
    expect(result.current).toBe(0); // straight away, not "4" left over from the last run until the next tick
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(2);
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useElapsedSeconds(true));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useCountdown', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current[0]).toBe(0);
  });

  it('counts down from the start value and stops at 0', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());
    act(() => result.current[1](60));
    expect(result.current[0]).toBe(60);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current[0]).toBe(59);
    act(() => { vi.advanceTimersByTime(58000); });
    expect(result.current[0]).toBe(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current[0]).toBe(0);
    expect(vi.getTimerCount()).toBe(0); // stops ticking once finished
  });

  it('rounds up, so the visible number never reaches 0 before the time is really up', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());
    act(() => result.current[1](60));
    act(() => { vi.advanceTimersByTime(250); }); // 59.75 s left: shows 60, not 59
    expect(result.current[0]).toBe(60);
    act(() => { vi.advanceTimersByTime(800); }); // 58.95 s left: shows 59
    expect(result.current[0]).toBe(59);
  });

  it('a zero or negative start does not disturb a countdown that is already running', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());
    act(() => result.current[1](60));
    act(() => result.current[1](0));
    act(() => result.current[1](-5));
    expect(result.current[0]).toBe(60);
  });

  it('can be restarted', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());
    act(() => result.current[1](5));
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
  });

  it('ignores zero or negative values', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current[1](0));
    expect(result.current[0]).toBe(0);
    act(() => result.current[1](-5));
    expect(result.current[0]).toBe(0);
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCountdown());
    act(() => result.current[1](60));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('waitFor is available for async assertions in this file', async () => {
  await waitFor(() => expect(true).toBe(true));
});
