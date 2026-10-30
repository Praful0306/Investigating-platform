import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RESULT_EXAMPLE } from '../api/mock/fixtures.js';
import { useResult } from './useResult.js';

vi.mock('../api/cases.js', () => ({ getResult: vi.fn() }));
const { getResult } = await import('../api/cases.js');

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const resultFor = (caseId, title = 'The Silent Sitar') => ({ ...structuredClone(RESULT_EXAMPLE), caseId, title });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => { getResult.mockReset(); });

describe('useResult', () => {
  it('uses a carried result for the same case without any request', () => {
    const { result } = renderHook(() => useResult(A, resultFor(A)));
    expect(result.current).toMatchObject({ loading: false, error: null });
    expect(result.current.data.caseId).toBe(A);
    expect(getResult).not.toHaveBeenCalled();
  });

  it('ignores a result carried from another case and fetches', async () => {
    getResult.mockResolvedValue(resultFor(A, 'Fetched'));
    const { result } = renderHook(() => useResult(A, resultFor(B, 'Carried')));
    expect(result.current).toMatchObject({ loading: true, data: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.title).toBe('Fetched');
    expect(getResult).toHaveBeenCalledWith(A);
  });

  it('keeps the error (and no data) when loading fails, and refresh tries again', async () => {
    getResult.mockRejectedValueOnce({ status: 500, code: 'INTERNAL_ERROR', message: 'x' });
    getResult.mockResolvedValueOnce(resultFor(A));
    const { result } = renderHook(() => useResult(A));
    await waitFor(() => expect(result.current.error).toMatchObject({ code: 'INTERNAL_ERROR' }));
    expect(result.current).toMatchObject({ data: null, loading: false });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data?.caseId).toBe(A));
    expect(result.current.error).toBeNull();
    expect(getResult).toHaveBeenCalledTimes(2);
  });

  it('never shows the previous case while another one loads', async () => {
    getResult.mockImplementation((id) => Promise.resolve(resultFor(id, id === A ? 'First' : 'Second')));
    const { result, rerender } = renderHook(({ id }) => useResult(id), { initialProps: { id: A } });
    await waitFor(() => expect(result.current.data?.title).toBe('First'));
    const second = deferred();
    getResult.mockImplementation(() => second.promise);
    rerender({ id: B });
    expect(result.current).toMatchObject({ data: null, loading: true });
    await act(async () => second.resolve(resultFor(B, 'Second')));
    expect(result.current.data.title).toBe('Second');
  });

  it('a slow answer for an old case cannot overwrite the new one', async () => {
    const slow = deferred();
    getResult.mockImplementation((id) => (id === A ? slow.promise : Promise.resolve(resultFor(B, 'Second'))));
    const { result, rerender } = renderHook(({ id }) => useResult(id), { initialProps: { id: A } });
    rerender({ id: B });
    await waitFor(() => expect(result.current.data?.title).toBe('Second'));
    await act(async () => slow.resolve(resultFor(A, 'Late first')));
    expect(result.current.data.title).toBe('Second');
    expect(getResult).toHaveBeenCalledTimes(2); // A once, B once: the late answer did not knock B out and force a refetch
  });
});
