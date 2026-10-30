import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPair } from 'jose';
import { createTokenVerifier } from '../../src/services/firebase-token.js';
import { makeIdp, PROJECT } from '../helpers/firebase.js';

let idp;
let verify;
beforeAll(async () => {
  idp = await makeIdp();
  verify = createTokenVerifier({ projectId: PROJECT, jwks: idp.jwks });
});

const now = () => Math.floor(Date.now() / 1000);
const rejects401 = (p) => expect(p).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });

describe('createTokenVerifier: a good token', () => {
  it('returns the uid, email and name from the verified claims, and nothing else', async () => {
    const user = await verify(await idp.mint());
    expect(user).toEqual({ id: 'user-uid-1', email: 'detective@example.com', displayName: 'Dana Detective' });
  });

  it('falls back to the part of the email before the @ when the account has no name', async () => {
    const user = await verify(await idp.mint({ name: null, email: 'maya.rao@example.com' }));
    expect(user.displayName).toBe('maya.rao');
  });

  it('shortens a very long name to 60 characters', async () => {
    const user = await verify(await idp.mint({ name: 'N'.repeat(300) }));
    expect(user.displayName).toBe('N'.repeat(60));
  });

  it('copes with a token that has neither name nor email (email is then null, name generic)', async () => {
    const user = await verify(await idp.mint({ name: null, email: null }));
    expect(user).toEqual({ id: 'user-uid-1', email: null, displayName: 'Detective' });
  });

  it('accepts a token that was issued a moment in the future (small clock difference)', async () => {
    await expect(verify(await idp.mint({ iat: now() + 5, auth_time: now() + 5 }))).resolves.toMatchObject({ id: 'user-uid-1' });
  });
});

describe('createTokenVerifier: bad tokens are all a plain 401', () => {
  it.each([
    ['expired', () => idp.mint({ exp: now() - 120 })],
    ['wrong issuer', () => idp.mint({ iss: 'https://securetoken.google.com/some-other-project' })],
    ['issuer of another kind', () => idp.mint({ iss: 'https://accounts.google.com' })],
    ['wrong audience', () => idp.mint({ aud: 'some-other-project' })],
    ['no audience', () => idp.mint({ aud: null })],
    ['no subject', () => idp.mint({ sub: null })],
    ['empty subject', () => idp.mint({ sub: '' })],
    ['subject that is not a string', () => idp.mint({ sub: 12345 })],
    ['subject over 128 characters', () => idp.mint({ sub: 'x'.repeat(129) })],
    ['no expiry', () => idp.mint({ exp: null })],
    ['issued far in the future', () => idp.mint({ iat: now() + 3600 })],
    ['signed in the future (auth_time)', () => idp.mint({ auth_time: now() + 3600 })],
    ['no auth_time', () => idp.mint({ auth_time: null })],
    ['not yet valid (nbf)', () => idp.mint({ nbf: now() + 3600 })],
  ])('%s', async (_name, make) => {
    await rejects401(verify(await make()));
  });

  it('a token signed with another algorithm is refused even when the key set would allow it (only RS256 is trusted)', async () => {
    const lenient = createTokenVerifier({ projectId: PROJECT, jwks: idp.jwks512 });
    await rejects401(lenient(await idp.mint512()));
  });

  it('a validly signed token that is absurdly large is refused without being examined', async () => {
    const spy = vi.fn(idp.jwks);
    const guarded = createTokenVerifier({ projectId: PROJECT, jwks: spy });
    await rejects401(guarded(await idp.mint({ padding: 'x'.repeat(10_000) })));
    expect(spy).not.toHaveBeenCalled();
  });

  it('signed by a different key but claiming the right key id (forged)', async () => {
    const other = await generateKeyPair('RS256');
    await rejects401(verify(await idp.mint({}, { key: other.privateKey })));
  });

  it('a key id the server has never heard of', async () => {
    await rejects401(verify(await idp.mint({}, { kid: 'unknown-key' })));
  });

  it('"alg": "none" (no signature at all)', async () => {
    await rejects401(verify(idp.unsigned()));
  });

  it('HS256 signed with some secret (algorithm confusion)', async () => {
    const secret = new TextEncoder().encode('x'.repeat(64));
    await rejects401(verify(await idp.mint({}, { key: secret, alg: 'HS256' })));
  });

  it('a valid signature with the payload swapped for another user', async () => {
    const [h, , s] = (await idp.mint()).split('.');
    const forged = Buffer.from(JSON.stringify({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'admin', exp: now() + 3600, iat: now() - 5, auth_time: now() - 5 })).toString('base64url');
    await rejects401(verify(`${h}.${forged}.${s}`));
  });

  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['not a JWT', 'hello'],
    ['two parts', 'aaa.bbb'],
    ['four parts', 'a.b.c.d'],
    ['garbage parts', '!!!.???.***'],
    ['not a string', 12345],
    ['undefined', undefined],
    ['an object', { token: 'x' }],
    ['a huge token', `${'a'.repeat(10_000)}.${'b'.repeat(10)}.${'c'.repeat(10)}`],
  ])('%s', async (_name, token) => {
    await rejects401(verify(token));
  });

  it('never explains why: every rejection carries the same message', async () => {
    const messages = new Set();
    for (const make of [() => idp.mint({ exp: now() - 120 }), () => idp.mint({ aud: 'x' }), () => idp.mint({ sub: null })]) {
      try { await verify(await make()); } catch (e) { messages.add(e.message); }
    }
    expect(messages.size).toBe(1);
    expect([...messages][0]).not.toMatch(/exp|aud|sub|issuer|audience|signature/i);
  });
});

describe('createTokenVerifier: Google unreachable', () => {
  it('is a 503 AUTH_UNAVAILABLE, not a 401: it is not the player\'s fault', async () => {
    const down = createTokenVerifier({ projectId: PROJECT, jwks: async () => { throw new TypeError('fetch failed'); } });
    await expect(down(await idp.mint())).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 });
  });
});
