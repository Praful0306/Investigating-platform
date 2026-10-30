import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { http } from './http.js';
import * as api from './cases.js';

const spy = (data) => vi.spyOn(http, 'request').mockResolvedValue({ data });
afterEach(() => vi.restoreAllMocks());

describe('real API calls', () => {
  it('createCase posts premise + difficulty and unwraps `case`', async () => {
    const s = spy({ case: { id: 'abc' } });
    expect(await api.createCase({ premise: 'A stolen trophy at a cricket final', difficulty: 'easy' })).toEqual({ id: 'abc' });
    expect(s).toHaveBeenCalledWith({ method: 'post', url: '/cases', data: { premise: 'A stolen trophy at a cricket final', difficulty: 'easy' } });
  });

  it('createCase sends turnstileToken only when there is one', async () => {
    const s = spy({ case: {} });
    await api.createCase({ premise: 'A stolen trophy at a cricket final', difficulty: 'hard', turnstileToken: 'tok' });
    expect(s.mock.calls[0][0].data).toEqual({ premise: 'A stolen trophy at a cricket final', difficulty: 'hard', turnstileToken: 'tok' });
    await api.createCase({ premise: 'A stolen trophy at a cricket final', difficulty: 'hard', turnstileToken: '' });
    expect(s.mock.calls[1][0].data).not.toHaveProperty('turnstileToken');
  });

  it('startSession posts to /auth/session and returns who you are and how many cases were claimed', async () => {
    const body = { user: { id: 'u1', email: 'a@b.co', displayName: 'A' }, claimed: 2 };
    const s = spy(body);
    expect(await api.startSession()).toEqual(body);
    expect(s).toHaveBeenCalledWith({ method: 'post', url: '/auth/session' });
  });

  it('getCase unwraps `case`', async () => {
    const s = spy({ case: { id: '1' } });
    expect(await api.getCase('1')).toEqual({ id: '1' });
    expect(s).toHaveBeenCalledWith({ method: 'get', url: '/cases/1' });
  });

  it('discoverClue returns clue + progress + alreadyDiscovered', async () => {
    const body = { clue: { id: 'c1' }, progress: { discoveredCount: 1 }, alreadyDiscovered: false };
    const s = spy(body);
    expect(await api.discoverClue('1', 'c1')).toEqual(body);
    expect(s).toHaveBeenCalledWith({ method: 'post', url: '/cases/1/clues/c1/discover' });
  });

  it('requestHint returns hint + progress', async () => {
    const body = { hint: { index: 0, text: 'x' }, progress: { hintsUsed: 1 } };
    const s = spy(body);
    expect(await api.requestHint('1')).toEqual(body);
    expect(s).toHaveBeenCalledWith({ method: 'post', url: '/cases/1/hints' });
  });

  it('accuse posts only the suspectId and unwraps `result`', async () => {
    const s = spy({ result: { verdict: 'correct' } });
    expect(await api.accuse('1', 's2')).toEqual({ verdict: 'correct' });
    expect(s).toHaveBeenCalledWith({ method: 'post', url: '/cases/1/accuse', data: { suspectId: 's2' } });
  });

  it('getResult unwraps `result`; listCases unwraps `cases`; health returns the body', async () => {
    spy({ result: { verdict: 'incorrect' } });
    expect(await api.getResult('1')).toEqual({ verdict: 'incorrect' });
    spy({ cases: [{ id: '1' }] });
    expect(await api.listCases()).toEqual([{ id: '1' }]);
    spy({ ok: true, db: 'up' });
    expect(await api.health()).toEqual({ ok: true, db: 'up' });
  });

  it('url-encodes ids so a hostile id cannot change the path', async () => {
    const s = spy({ case: {} });
    await api.getCase('../health');
    expect(s.mock.calls[0][0].url).toBe('/cases/..%2Fhealth');
    await api.discoverClue('1', 'c1/../../x');
    expect(s.mock.calls[1][0].url).toBe('/cases/1/clues/c1%2F..%2F..%2Fx/discover');
  });

  it('failures reject with the flattened { status, code, message }, never an AxiosError', async () => {
    vi.spyOn(http, 'request').mockRejectedValue(
      new AxiosError('x', 'ERR_BAD_REQUEST', undefined, {}, { status: 409, data: { error: { code: 'NO_HINTS_LEFT', message: 'No hints left.' } }, headers: {}, config: {} }),
    );
    const err = await api.requestHint('1').catch((e) => e);
    expect(err).not.toBeInstanceOf(Error);
    expect(err).toMatchObject({ status: 409, code: 'NO_HINTS_LEFT', message: 'No hints left.' });
  });

  it('a network failure rejects with code NETWORK', async () => {
    vi.spyOn(http, 'request').mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(await api.health().catch((e) => e)).toMatchObject({ status: 0, code: 'NETWORK' });
  });
});

describe('mock mode (VITE_USE_MOCK=true or --mode mock)', () => {
  const load = async () => {
    vi.resetModules();
    const [cases, mock, httpMod] = await Promise.all([import('./cases.js'), import('./mock/index.js'), import('./http.js')]);
    mock.__setLatency(0);
    return { cases, mock, request: vi.spyOn(httpMod.http, 'request') };
  };

  it.each([
    ['VITE_USE_MOCK', () => vi.stubEnv('VITE_USE_MOCK', 'true')],
    ['--mode mock', () => vi.stubEnv('MODE', 'mock')],
  ])('%s: same function names, answered in memory, the network is never touched', async (_n, enable) => {
    enable();
    const { cases, mock, request } = await load();
    expect(Object.keys(cases).sort()).toEqual(Object.keys(api).sort());
    const created = await cases.createCase({ premise: 'A stolen trophy at a cricket final', difficulty: 'easy' });
    expect(created.suspects).toHaveLength(3);
    expect((await cases.getCase(created.id)).id).toBe(created.id);
    expect((await cases.discoverClue(created.id, 'c1')).clue.discovered).toBe(true);
    expect((await cases.requestHint(created.id)).hint.index).toBe(0);
    expect((await cases.accuse(created.id, 's2')).verdict).toBe('correct');
    expect((await cases.getResult(created.id)).caseId).toBe(created.id);
    expect(await cases.listCases()).toHaveLength(1);
    expect((await cases.startSession()).claimed).toBe(0);
    expect((await cases.health()).ok).toBe(true);
    expect(request).not.toHaveBeenCalled();
    mock.__reset();
  });

  it('without the flag the real client is used', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { cases, request } = await load();
    request.mockResolvedValue({ data: { ok: true } });
    await cases.health();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
