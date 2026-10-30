import { describe, expect, it, vi } from 'vitest';
import { optionalAuth, requireAuth } from '../../src/middleware/auth.js';

const run = async (headers, verify) => {
  const req = { headers };
  const next = vi.fn();
  await optionalAuth(verify)(req, {}, next);
  return { req, next, error: next.mock.calls[0]?.[0] };
};
const ok = vi.fn(async (t) => ({ id: `uid-of-${t}`, email: null, displayName: 'X' }));

describe('optionalAuth', () => {
  it('no Authorization header at all: a guest, carry on', async () => {
    const { req, next, error } = await run({}, ok);
    expect(next).toHaveBeenCalledTimes(1);
    expect(error).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it('an EMPTY Authorization header is not "no header": it is a bad header (401), never a guest', async () => {
    const { error, req } = await run({ authorization: '' }, ok);
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(req.user).toBeUndefined();
  });

  it('a good token sets req.user from the verifier', async () => {
    const { req, error } = await run({ authorization: 'Bearer abc' }, ok);
    expect(error).toBeUndefined();
    expect(req.user).toEqual({ id: 'uid-of-abc', email: null, displayName: 'X' });
  });

  it('a refused token passes the verifier\'s error on and sets no user', async () => {
    const boom = Object.assign(new Error('no'), { code: 'UNAUTHORIZED', status: 401 });
    const { req, error } = await run({ authorization: 'Bearer abc' }, async () => { throw boom; });
    expect(error).toBe(boom);
    expect(req.user).toBeUndefined();
  });

  it('with no verifier configured, a token is a 503 (and the verifier is never needed)', async () => {
    const { error } = await run({ authorization: 'Bearer abc' }, null);
    expect(error).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 });
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b', 'abc', 'Token abc'])('"%s" is a 401', async (authorization) => {
    const { error } = await run({ authorization }, ok);
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });
});

describe('requireAuth', () => {
  it('lets a signed-in request through and stops a guest with a 401', () => {
    const pass = vi.fn();
    requireAuth({ user: { id: 'u' } }, {}, pass);
    expect(pass).toHaveBeenCalledWith();
    const stop = vi.fn();
    requireAuth({}, {}, stop);
    expect(stop.mock.calls[0][0]).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });
});
