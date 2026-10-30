import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { matchMediaListenerCount, setReducedMotion } from '../test/matchMedia.js';
import { useReducedMotion } from './useReducedMotion.js';
import { useDocumentTitle } from './useDocumentTitle.js';

describe('useReducedMotion', () => {
  it('reflects prefers-reduced-motion (on by default in tests)', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('follows the setting live', () => {
    const { result } = renderHook(() => useReducedMotion());
    act(() => setReducedMotion(false));
    expect(result.current).toBe(false);
    act(() => setReducedMotion(true));
    expect(result.current).toBe(true);
  });

  it('unsubscribes when the component goes away', () => {
    const before = matchMediaListenerCount();
    const { unmount } = renderHook(() => useReducedMotion());
    expect(matchMediaListenerCount()).toBe(before + 1);
    unmount();
    expect(matchMediaListenerCount()).toBe(before);
  });

  it('is false (full motion) and does not crash when matchMedia does not exist', () => {
    const original = window.matchMedia;
    window.matchMedia = undefined;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});

describe('useDocumentTitle', () => {
  it('sets "<title> · AI Mystery Room"', () => {
    renderHook(() => useDocumentTitle('Create a mystery'));
    expect(document.title).toBe('Create a mystery · AI Mystery Room');
  });

  it('uses the brand line when there is no page title (Home)', () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe('AI Mystery Room — every case is new');
  });

  it('updates when the title changes', () => {
    const { rerender } = renderHook(({ t }) => useDocumentTitle(t), { initialProps: { t: 'One' } });
    rerender({ t: 'Two' });
    expect(document.title).toBe('Two · AI Mystery Room');
  });
});
