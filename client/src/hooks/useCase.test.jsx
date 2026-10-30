import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PUBLIC_CASE_EXAMPLE } from '../api/mock/fixtures.js';
import { useCase } from './useCase.js';

vi.mock('../api/cases.js', () => ({ getCase: vi.fn() }));
const { getCase } = await import('../api/cases.js');

const fresh = (id = 'aaaaaaaaaaaaaaaaaaaaaaaa') => ({
  ...structuredClone(PUBLIC_CASE_EXAMPLE),
  id,
  clues: PUBLIC_CASE_EXAMPLE.clues.map((c) => ({ ...c, discovered: false, description: null })),
  hints: { total: 2, used: 0, revealed: [] },
  progress: { discoveredCount: 0, totalClues: 5, hintsUsed: 0, hintsTotal: 2 },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => { getCase.mockReset(); });

describe('useCase: loading', () => {
  it('starts loading, then has the case', async () => {
    getCase.mockResolvedValue(fresh());
    const { result } = renderHook(() => useCase('aaaaaaaaaaaaaaaaaaaaaaaa'));
    expect(result.current).toMatchObject({ loading: true, data: null, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.title).toBe('The Silent Sitar');
    expect(getCase).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(getCase).toHaveBeenCalledTimes(1);
  });

  it('keeps the error (and no data) when loading fails', async () => {
    getCase.mockRejectedValue({ status: 404, code: 'CASE_NOT_FOUND', message: 'x' });
    const { result } = renderHook(() => useCase('aaaaaaaaaaaaaaaaaaaaaaaa'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatchObject({ code: 'CASE_NOT_FOUND' });
    expect(result.current.data).toBeNull();
  });

  it('refresh() loads again and clears an old error', async () => {
    getCase.mockRejectedValueOnce({ status: 0, code: 'NETWORK', message: 'x' }).mockResolvedValueOnce(fresh());
    const { result } = renderHook(() => useCase('aaaaaaaaaaaaaaaaaaaaaaaa'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => { result.current.refresh(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(getCase).toHaveBeenCalledTimes(2);
  });

  it('switching to another case id shows loading, never the previous case', async () => {
    getCase.mockResolvedValueOnce(fresh('aaaaaaaaaaaaaaaaaaaaaaaa')).mockResolvedValueOnce({ ...fresh('bbbbbbbbbbbbbbbbbbbbbbbb'), title: 'Second' });
    const { result, rerender } = renderHook(({ id }) => useCase(id), { initialProps: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    await waitFor(() => expect(result.current.data?.id).toBe('aaaaaaaaaaaaaaaaaaaaaaaa'));
    rerender({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data?.title).toBe('Second'));
  });

  it('a slow answer for the old id cannot overwrite the new one', async () => {
    const slow = deferred();
    getCase.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ ...fresh('bbbbbbbbbbbbbbbbbbbbbbbb'), title: 'Second' });
    const { result, rerender } = renderHook(({ id }) => useCase(id), { initialProps: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    rerender({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
    await waitFor(() => expect(result.current.data?.title).toBe('Second'));
    await act(async () => { slow.resolve({ ...fresh('aaaaaaaaaaaaaaaaaaaaaaaa'), title: 'First (late)' }); await slow.promise; });
    expect(result.current.data.title).toBe('Second');
  });
});

describe('useCase: applying server replies without refetching', () => {
  const loaded = async () => {
    getCase.mockResolvedValue(fresh());
    const hook = renderHook(() => useCase('aaaaaaaaaaaaaaaaaaaaaaaa'));
    await waitFor(() => expect(hook.result.current.data).not.toBeNull());
    return hook;
  };
  const clueReply = { clue: { id: 'c2', title: 'Torn ticket', location: 'Back stairwell', discovered: true, description: 'Stamped 7:12.' }, progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 0, hintsTotal: 2 }, alreadyDiscovered: false };

  it('applyClue reveals that clue and updates progress, with no new request', async () => {
    const { result } = await loaded();
    act(() => result.current.applyClue(clueReply));
    const c2 = result.current.data.clues.find((c) => c.id === 'c2');
    expect(c2).toMatchObject({ discovered: true, description: 'Stamped 7:12.' });
    expect(result.current.data.clues.filter((c) => c.discovered)).toHaveLength(1);
    expect(result.current.data.progress.discoveredCount).toBe(1);
    expect(getCase).toHaveBeenCalledTimes(1);
  });

  it('applyClue never mutates the previous state object', async () => {
    const { result } = await loaded();
    const before = result.current.data;
    act(() => result.current.applyClue(clueReply));
    expect(before.clues.find((c) => c.id === 'c2').discovered).toBe(false);
    expect(result.current.data).not.toBe(before);
  });

  it('applyClue for an unknown clue id changes nothing and does not crash', async () => {
    const { result } = await loaded();
    act(() => result.current.applyClue({ ...clueReply, clue: { ...clueReply.clue, id: 'c99' } }));
    expect(result.current.data.clues.every((c) => !c.discovered)).toBe(true);
    expect(result.current.data.progress.discoveredCount).toBe(0); // the counts of a clue we do not have are not applied either
  });

  const hintReply = (index, used) => ({ hint: { index, text: `Hint text ${index}` }, progress: { discoveredCount: 0, totalClues: 5, hintsUsed: used, hintsTotal: 2 } });

  it('applyHint adds the hint in order and updates the counts', async () => {
    const { result } = await loaded();
    act(() => result.current.applyHint(hintReply(0, 1)));
    act(() => result.current.applyHint(hintReply(1, 2)));
    expect(result.current.data.hints).toEqual({ total: 2, used: 2, revealed: [{ index: 0, text: 'Hint text 0' }, { index: 1, text: 'Hint text 1' }] });
    expect(result.current.data.progress.hintsUsed).toBe(2);
  });

  it('applyHint keeps hints sorted even if replies arrive out of order, and never duplicates one', async () => {
    const { result } = await loaded();
    act(() => result.current.applyHint(hintReply(1, 2)));
    act(() => result.current.applyHint(hintReply(0, 2)));
    act(() => result.current.applyHint(hintReply(0, 2)));
    expect(result.current.data.hints.revealed.map((h) => h.index)).toEqual([0, 1]);
  });

  it('applying before the case has loaded is a harmless no-op', () => {
    getCase.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCase('aaaaaaaaaaaaaaaaaaaaaaaa'));
    expect(() => act(() => {
      result.current.applyClue(clueReply);
      result.current.applyHint(hintReply(0, 1));
    })).not.toThrow();
    expect(result.current.data).toBeNull();
  });
});
