import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';
import { Case } from '../../src/models/Case.js';
import { DEFAULT_LIMITS, playerKey } from '../../src/middleware/rate-limit.js';

useMemoryDb();

const BODY = { premise: 'A stolen trophy at a college cricket final', difficulty: 'easy' };
const create = (agent, ip) => {
  const r = agent.post('/api/cases').send(BODY);
  return ip ? r.set('X-Forwarded-For', ip) : r;
};

describe('limits configuration', () => {
  it('defaults are the numbers in specs/03-security.md', () => {
    expect(DEFAULT_LIMITS.global).toEqual({ windowMs: 60_000, limit: 600 });
    expect(DEFAULT_LIMITS.create).toEqual({ windowMs: 10 * 60_000, limit: 5 });
    expect(DEFAULT_LIMITS.daily).toEqual({ windowMs: 24 * 60 * 60_000, limit: 120 });
    expect(DEFAULT_LIMITS.auth).toEqual({ windowMs: 15 * 60_000, limit: 300 });
  });

  it('the create limiter is keyed by the logged-in user, else by the player cookie', () => {
    expect(playerKey({ user: { id: 'u1' }, playerId: 'p1' })).toBe('u1');
    expect(playerKey({ playerId: 'p1' })).toBe('p1');
    expect(playerKey({ user: undefined, playerId: 'p2' })).toBe('p2');
  });
});

describe('create limiter (per player)', () => {
  it('allows `limit` cases, then 429 RATE_LIMITED in the error envelope with rate-limit headers', async () => {
    const agent = request.agent(makeApp({ limits: { create: { limit: 2 } } }));
    await create(agent).expect(201);
    await create(agent).expect(201);
    const res = await create(agent).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.message).toMatch(/wait/i);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers.ratelimit).toBeDefined();
    expect(res.headers['ratelimit-policy']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined(); // legacy headers are off
    expect(await Case.countDocuments()).toBe(2); // the blocked request never reached the AI or the database
  });

  it('is per player: another player is not affected', async () => {
    const app = makeApp({ limits: { create: { limit: 1 } } });
    const a = request.agent(app);
    const b = request.agent(app);
    await create(a).expect(201);
    await create(a).expect(429);
    await create(b).expect(201);
  });

  it('only limits creating cases: reading, hints and accusing still work for a blocked player', async () => {
    const agent = request.agent(makeApp({ limits: { create: { limit: 1 } } }));
    const id = (await create(agent).expect(201)).body.case.id;
    await create(agent).expect(429);
    await agent.get(`/api/cases/${id}`).expect(200);
    await agent.get('/api/cases').expect(200);
    await agent.post(`/api/cases/${id}/hints`).expect(200);
    await agent.post(`/api/cases/${id}/clues/c1/discover`).expect(200);
    await agent.post(`/api/cases/${id}/accuse`).send({ suspectId: 's1' }).expect(200);
  });

  it('requests that fail validation still count (the limiter runs first)', async () => {
    const agent = request.agent(makeApp({ limits: { create: { limit: 2 } } }));
    await agent.post('/api/cases').send({ premise: 'short', difficulty: 'easy' }).expect(400);
    await agent.post('/api/cases').send({ premise: 'short', difficulty: 'easy' }).expect(400);
    await agent.post('/api/cases').send(BODY).expect(429);
  });
});

describe('daily limiter (per IP, stops cookie-clearing)', () => {
  it('a fresh cookie every time does not help: the IP is capped', async () => {
    const app = makeApp({ limits: { daily: { limit: 3 } } });
    for (let i = 0; i < 3; i++) await create(request.agent(app)).expect(201);
    const res = await create(request.agent(app)).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.message).toMatch(/today|tomorrow|daily/i);
  });

  it('honours X-Forwarded-For (trust proxy): each real client IP has its own bucket', async () => {
    const app = makeApp({ limits: { daily: { limit: 1 } } });
    await create(request.agent(app), '203.0.113.5').expect(201);
    await create(request.agent(app), '203.0.113.5').expect(429);
    await create(request.agent(app), '203.0.113.6').expect(201);
  });

  it('an attacker cannot dodge the limit by faking extra X-Forwarded-For entries on the left', async () => {
    const app = makeApp({ limits: { daily: { limit: 1 } } });
    // with 1 trusted hop only the right-most entry counts
    await create(request.agent(app), '198.51.100.1, 203.0.113.9').expect(201);
    await create(request.agent(app), '198.51.100.2, 203.0.113.9').expect(429);
  });
});

describe('global limiter (per IP, all /api routes)', () => {
  it('429 after `limit` requests in the window, including health', async () => {
    const app = makeApp({ limits: { global: { limit: 4 } } });
    for (let i = 0; i < 4; i++) await request(app).get('/api/health').expect(200);
    const res = await request(app).get('/api/health').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect((await request(app).get('/api/cases')).status).toBe(429);
  });

  it('is applied before the body is parsed, so oversized or garbage bodies are cheap to refuse', async () => {
    const app = makeApp({ limits: { global: { limit: 1 } } });
    await request(app).get('/api/health').expect(200);
    const res = await request(app).post('/api/cases').set('content-type', 'application/json').send('{bad json').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not apply to non-/api paths (404 stays 404)', async () => {
    const app = makeApp({ limits: { global: { limit: 1 } } });
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(429);
    expect((await request(app).get('/elsewhere')).status).toBe(404);
  });

  it('CORS preflight requests are not counted', async () => {
    const app = makeApp({ limits: { global: { limit: 2 } } });
    for (let i = 0; i < 5; i++) {
      await request(app).options('/api/cases').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST').expect(204);
    }
    await request(app).get('/api/health').expect(200);
  });
});

describe('each makeApp gets fresh counters', () => {
  it('limits do not leak between app instances', async () => {
    const first = makeApp({ limits: { global: { limit: 1 } } });
    await request(first).get('/api/health').expect(200);
    await request(first).get('/api/health').expect(429);
    await request(makeApp({ limits: { global: { limit: 1 } } })).get('/api/health').expect(200);
  });
});
