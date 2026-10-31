import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { generateKeyPair } from 'jose';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';
import { makeIdp, PROJECT } from '../helpers/firebase.js';
import { Case } from '../../src/models/Case.js';
import { DEFAULT_LIMITS } from '../../src/middleware/rate-limit.js';
import { mockProvider } from '../../src/services/ai/providers/mock.js';
import { sampleCase } from '../helpers/fixtures.js';

useMemoryDb();

const PREMISE = 'A priceless sitar vanishes during a college music fest';
const BODY = { premise: PREMISE, difficulty: 'easy' };

let idp;
let app;
let alice; // tokens for two different people
let bob;
beforeAll(async () => {
  idp = await makeIdp();
  app = makeApp({ firebase: { projectId: PROJECT, jwks: idp.jwks } });
  alice = await idp.mint({ sub: 'alice-uid', email: 'alice@example.com', name: 'Alice Archer' });
  bob = await idp.mint({ sub: 'bob-uid', email: 'bob@example.com', name: 'Bob Banner' });
});

const bearer = (t) => `Bearer ${t}`;
const session = (agent, token) => agent.post('/api/auth/session').set('Authorization', bearer(token));
const create = (agent, token) => {
  const r = agent.post('/api/cases').send(BODY);
  return token ? r.set('Authorization', bearer(token)) : r;
};
const unauthorized = (res) => {
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('UNAUTHORIZED');
};

describe('POST /api/auth/session', () => {
  it('a valid token gives back who you are, taken from the token, and nothing else', async () => {
    const res = await session(request(app), alice).expect(200);
    expect(res.body).toEqual({ user: { id: 'alice-uid', email: 'alice@example.com', displayName: 'Alice Archer' }, claimed: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/picture|identities|sign_in_provider|firebase/);
  });

  it('no token: 401 UNAUTHORIZED', async () => {
    unauthorized(await request(app).post('/api/auth/session'));
  });

  it.each([
    ['not a bearer header', 'Basic abc'],
    ['bearer with nothing after it', 'Bearer'],
    ['bearer with two tokens', 'Bearer a b'],
    ['an empty header', ''],
    ['a token without the word Bearer', 'abc.def.ghi'],
  ])('%s: 401', async (_name, header) => {
    unauthorized(await request(app).post('/api/auth/session').set('Authorization', header));
  });

  it('the word "bearer" in any letter case is accepted (RFC 7235)', async () => {
    await request(app).post('/api/auth/session').set('Authorization', `bearer ${alice}`).expect(200);
  });

  it.each([
    ['expired', () => idp.mint({ exp: Math.floor(Date.now() / 1000) - 600 })],
    ['for another project', () => idp.mint({ aud: 'other', iss: 'https://securetoken.google.com/other' })],
    ['forged with another key', async () => idp.mint({}, { key: (await generateKeyPair('RS256')).privateKey })],
    ['unsigned', () => idp.unsigned()],
  ])('a %s token: 401', async (_name, make) => {
    unauthorized(await session(request(app), await make()));
  });

  it('the error never says why the token was refused', async () => {
    const res = await session(request(app), await idp.mint({ exp: Math.floor(Date.now() / 1000) - 600 }));
    expect(JSON.stringify(res.body)).not.toMatch(/expired|signature|audience|issuer/i);
  });

  it('a GET is not a way in (404, the route is POST only)', async () => {
    await request(app).get('/api/auth/session').set('Authorization', bearer(alice)).expect(404);
  });

  it('the token is never written to the logs', async () => {
    const lines = [];
    const logged = makeApp({ firebase: { projectId: PROJECT, jwks: idp.jwks }, logger: { info: (l) => lines.push(l), warn: (l) => lines.push(l), error: (l) => lines.push(l) } });
    await session(request(logged), alice).expect(200);
    await session(request(logged), 'garbage-token-value').expect(401);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(String(l)).not.toMatch(/garbage-token-value|eyJ/);
  });

  it('is rate limited per IP (300 / 15 min by default)', async () => {
    expect(DEFAULT_LIMITS.auth).toEqual({ windowMs: 15 * 60_000, limit: 300 });
    const limited = makeApp({ firebase: { projectId: PROJECT, jwks: idp.jwks }, limits: { auth: { limit: 2 } } });
    await session(request(limited), alice).expect(200);
    await session(request(limited), alice).expect(200);
    const res = await session(request(limited), alice);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('counts failed attempts too (garbage tokens use up the allowance)', async () => {
    const limited = makeApp({ firebase: { projectId: PROJECT, jwks: idp.jwks }, limits: { auth: { limit: 2 } } });
    await session(request(limited), 'bad').expect(401);
    await session(request(limited), 'bad').expect(401);
    await session(request(limited), alice).expect(429);
  });
});

describe('when sign-in is not configured on the server', () => {
  const bare = makeApp(); // no FIREBASE_PROJECT_ID

  it('a token is a 503 AUTH_UNAVAILABLE on the session route', async () => {
    const res = await session(request(bare), alice);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
  });

  it('a token on a game route is a 503 too (never quietly treated as a guest)', async () => {
    const res = await create(request(bare), alice);
    expect(res.status).toBe(503);
    expect(await Case.countDocuments()).toBe(0);
  });

  it('guests play exactly as before', async () => {
    await create(request(bare)).expect(201);
  });

  it('the health check ignores tokens entirely', async () => {
    await request(bare).get('/api/health').set('Authorization', 'Bearer rubbish').expect(200);
  });
});

describe('game routes with a token', () => {
  it('a case made while signed in is stored with the Firebase uid', async () => {
    const res = await create(request.agent(app), alice).expect(201);
    const doc = await Case.findById(res.body.case.id);
    expect(doc.userId).toBe('alice-uid');
  });

  it('the same person can open it from another browser (no cookie in common)', async () => {
    const made = await create(request.agent(app), alice).expect(201);
    await request.agent(app).get(`/api/cases/${made.body.case.id}`).set('Authorization', bearer(alice)).expect(200);
  });

  it('another signed-in person gets 403 on it', async () => {
    const made = await create(request.agent(app), alice).expect(201);
    const res = await request.agent(app).get(`/api/cases/${made.body.case.id}`).set('Authorization', bearer(bob));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a signed-out guest from another browser gets 403 on it', async () => {
    const made = await create(request.agent(app), alice).expect(201);
    await request.agent(app).get(`/api/cases/${made.body.case.id}`).expect(403);
  });

  it('a bad or expired token is a 401 on game routes, never guest access', async () => {
    const agent = request.agent(app);
    const made = await create(agent).expect(201); // a guest case this browser owns
    const expired = await idp.mint({ exp: Math.floor(Date.now() / 1000) - 600 });
    unauthorized(await agent.get(`/api/cases/${made.body.case.id}`).set('Authorization', bearer(expired)));
    unauthorized(await agent.get('/api/cases').set('Authorization', 'Bearer nonsense'));
  });

  it('an expired token creates nothing and never reaches the AI', async () => {
    const provider = mockProvider({ mode: 'valid' });
    const spy = vi.spyOn(provider, 'generate');
    const guarded = makeApp({ provider, firebase: { projectId: PROJECT, jwks: idp.jwks } });
    const expired = await idp.mint({ exp: Math.floor(Date.now() / 1000) - 600 });
    unauthorized(await create(request(guarded), expired));
    expect(await Case.countDocuments()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the create limit follows the account, not the browser', async () => {
    const limited = makeApp({ firebase: { projectId: PROJECT, jwks: idp.jwks }, limits: { create: { limit: 1 } } });
    await create(request.agent(limited), alice).expect(201);
    const second = await create(request.agent(limited), alice); // a different browser, same account
    expect(second.status).toBe(429);
    await create(request.agent(limited), bob).expect(201); // someone else is unaffected
  });
});

describe('claiming guest cases', () => {
  it('a guest case becomes the account\'s when the guest signs in; history then lists it from any browser', async () => {
    const guest = request.agent(app);
    const made = await create(guest).expect(201);
    const res = await session(guest, alice).expect(200);
    expect(res.body.claimed).toBe(1);
    expect((await Case.findById(made.body.case.id)).userId).toBe('alice-uid');

    const list = await request.agent(app).get('/api/cases').set('Authorization', bearer(alice)).expect(200);
    expect(list.body.cases.map((c) => c.id)).toEqual([made.body.case.id]);
  });

  it('claiming twice claims nothing the second time', async () => {
    const guest = request.agent(app);
    await create(guest).expect(201);
    expect((await session(guest, alice)).body.claimed).toBe(1);
    expect((await session(guest, alice)).body.claimed).toBe(0);
  });

  it('claims all of this browser\'s unowned cases at once, and only those', async () => {
    const guest = request.agent(app);
    await create(guest).expect(201);
    await create(guest).expect(201);
    await create(request.agent(app)).expect(201); // another browser's case
    expect((await session(guest, alice)).body.claimed).toBe(2);
    expect(await Case.countDocuments({ userId: 'alice-uid' })).toBe(2);
    expect(await Case.countDocuments({ userId: null })).toBe(1);
  });

  it('never takes a case that already belongs to someone else, even from the same browser', async () => {
    const shared = request.agent(app); // a family computer: Alice's case, then Bob signs in on it
    const made = await create(shared, alice).expect(201);
    expect((await session(shared, bob)).body.claimed).toBe(0);
    expect((await Case.findById(made.body.case.id)).userId).toBe('alice-uid');
  });

  it('needs this browser\'s own cookie: with none, nothing is claimed', async () => {
    await create(request.agent(app)).expect(201);
    expect((await session(request(app), alice)).body.claimed).toBe(0); // a fresh browser with no cookie
    expect(await Case.countDocuments({ userId: null })).toBe(1);
  });

  it('a cookie with a made-up player id claims nothing', async () => {
    await Case.create(sampleCase({ playerId: '3b241101-e2bb-4255-8caf-4136c566a962' }));
    const res = await session(request(app), alice).set('Cookie', 'mr_pid=00000000-0000-4000-8000-000000000000').expect(200);
    expect(res.body.claimed).toBe(0);
  });
});

describe('GET /api/cases (history)', () => {
  it('a guest sees only this browser\'s cases', async () => {
    const mine = request.agent(app);
    const a = await create(mine).expect(201);
    await create(request.agent(app)).expect(201);
    const list = await mine.get('/api/cases').expect(200);
    expect(list.body.cases.map((c) => c.id)).toEqual([a.body.case.id]);
  });

  it('a signed-in user sees their own cases, newest first, and never anyone else\'s', async () => {
    const first = await create(request.agent(app), alice).expect(201);
    await new Promise((r) => setTimeout(r, 15));
    const second = await create(request.agent(app), alice).expect(201);
    await create(request.agent(app), bob).expect(201);
    const list = await request.agent(app).get('/api/cases').set('Authorization', bearer(alice)).expect(200);
    expect(list.body.cases.map((c) => c.id)).toEqual([second.body.case.id, first.body.case.id]);
  });

  it('summaries carry no secrets and no owner ids', async () => {
    await create(request.agent(app), alice).expect(201);
    const list = await request.agent(app).get('/api/cases').set('Authorization', bearer(alice)).expect(200);
    const text = JSON.stringify(list.body);
    for (const bit of ['solution', 'culpritId', 'explanation', 'playerId', 'userId', 'alice-uid', 'premise']) expect(text).not.toContain(bit);
    expect(Object.keys(list.body.cases[0]).sort()).toEqual(['createdAt', 'difficulty', 'id', 'score', 'status', 'title']);
  });

  it('shows a finished case with its score', async () => {
    const agent = request.agent(app);
    const made = await create(agent, alice).expect(201);
    await agent.post(`/api/cases/${made.body.case.id}/accuse`).set('Authorization', bearer(alice)).send({ suspectId: 's1' }).expect(200);
    const list = await agent.get('/api/cases').set('Authorization', bearer(alice)).expect(200);
    expect(list.body.cases[0]).toMatchObject({ status: 'failed', score: 0 });
  });

  it('is limited to 50 cases', async () => {
    await Case.insertMany(Array.from({ length: 55 }, () => sampleCase({ playerId: 'p-bulk', userId: 'alice-uid' })));
    const list = await request.agent(app).get('/api/cases').set('Authorization', bearer(alice)).expect(200);
    expect(list.body.cases).toHaveLength(50);
  });

  it('a user id sent in the query string changes nothing (no operator or id injection)', async () => {
    await create(request.agent(app), bob).expect(201);
    const list = await request.agent(app).get('/api/cases?userId=bob-uid&userId[$ne]=x').set('Authorization', bearer(alice)).expect(200);
    expect(list.body.cases).toEqual([]);
  });
});
