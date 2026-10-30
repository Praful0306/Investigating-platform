import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { spawnSync } from 'node:child_process';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';
import { Case } from '../../src/models/Case.js';

useMemoryDb();

const PREMISE = 'A missing painting at the city museum';
const BODY = { premise: PREMISE, difficulty: 'hard' };
const FORBIDDEN_KEYS = ['solution', 'culpritId', 'keyClueIds', 'explanation', 'passwordHash', '"ai"', 'playerId'];
const code = (res) => res.body.error?.code;
const settle = () => new Promise((r) => setImmediate(r)); // let `res.on('finish')` handlers run

const app = makeApp();

// ------------------------------------------------------------------ S1, S2: nothing leaks before the accusation
describe('S1/S2: never leaks the solution before the accusation', () => {
  it('scans every response of a whole game up to (not including) the accusation', async () => {
    const agent = request.agent(app);
    const { body } = await agent.post('/api/cases').send(BODY).expect(201);
    const id = body.case.id;
    const responses = [body];
    const grab = async (p) => { const r = await p; responses.push(r.body); return r; };

    await grab(agent.get(`/api/cases/${id}`));
    await grab(agent.post(`/api/cases/${id}/clues/c1/discover`));
    await grab(agent.post(`/api/cases/${id}/clues/c1/discover`)); // idempotent repeat
    await grab(agent.post(`/api/cases/${id}/hints`));
    await grab(agent.get('/api/cases'));
    await grab(agent.get(`/api/cases/${id}/result`)); // 409 body
    await grab(request(app).get(`/api/cases/${id}`)); // 403 body (another player)
    await grab(agent.post(`/api/cases/${id}/clues/c99/discover`)); // 404 body
    await grab(agent.post(`/api/cases/${id}/accuse`).send({ suspectId: 'x1' })); // 400 body
    await grab(agent.post('/api/cases').type('form').send('premise=x')); // 415 body

    const all = JSON.stringify(responses);
    for (const k of FORBIDDEN_KEYS) expect(all, k).not.toContain(k);
    expect(all).not.toContain('MOCK_SECRET_EXPLANATION');

    const full = await Case.findById(id).select('+solution').lean();
    for (const clue of full.clues.slice(1)) expect(all, clue.id).not.toContain(clue.description); // undiscovered
    for (const h of full.hints.slice(1)) expect(all).not.toContain(h); // unrevealed
    expect(all).toContain(full.clues[0].description); // the one we found is there
    expect(all).toContain(full.hints[0]);
  });

  it('after the accusation only the Result reveals the explanation; keys like culpritId never appear', async () => {
    const agent = request.agent(app);
    const id = (await agent.post('/api/cases').send(BODY).expect(201)).body.case.id;
    const accuse = await agent.post(`/api/cases/${id}/accuse`).send({ suspectId: 's2' }).expect(200);
    const result = await agent.get(`/api/cases/${id}/result`).expect(200);
    const caseAfter = await agent.get(`/api/cases/${id}`).expect(200);
    const list = await agent.get('/api/cases').expect(200);
    for (const k of ['culpritId', 'keyClueIds', 'solution', 'playerId', '"ai"', 'passwordHash']) {
      expect(JSON.stringify([accuse.body, result.body, caseAfter.body, list.body]), k).not.toContain(k);
    }
    expect(JSON.stringify(result.body)).toContain('MOCK_SECRET_EXPLANATION'); // the intended reveal
    expect(JSON.stringify([caseAfter.body, list.body])).not.toContain('MOCK_SECRET_EXPLANATION');
  });
});

// ------------------------------------------------------------------ S3, S6: tampering and injection
describe('S3/S6: tampering and NoSQL-injection attempts are rejected', () => {
  const agentWithCase = async () => {
    const agent = request.agent(app);
    const id = (await agent.post('/api/cases').send(BODY).expect(201)).body.case.id;
    return { agent, id };
  };

  it.each([
    ['accuse with an operator object', { suspectId: { $ne: null } }],
    ['accuse with a regex-ish operator', { suspectId: { $regex: '.*' } }],
    ['accuse with a client-supplied score', { suspectId: 's1', score: 9999 }],
    ['accuse claiming to be correct', { suspectId: 's1', correct: true }],
    ['accuse with a status field', { suspectId: 's1', status: 'solved' }],
    ['accuse with __proto__', JSON.parse('{"suspectId":"s1","__proto__":{"admin":true}}')],
  ])('%s -> 400 and the case stays active', async (_n, payload) => {
    const { agent, id } = await agentWithCase();
    const res = await agent.post(`/api/cases/${id}/accuse`).send(payload).expect(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
    const doc = await Case.findById(id);
    expect([doc.status, doc.accusation, doc.score]).toEqual(['active', null, null]);
  });

  it.each([
    ['premise operator', { premise: { $gt: '' }, difficulty: 'easy' }],
    ['difficulty operator', { premise: PREMISE, difficulty: { $ne: 'easy' } }],
    ['client-supplied playerId', { premise: PREMISE, difficulty: 'easy', playerId: 'victim' }],
    ['client-supplied userId', { premise: PREMISE, difficulty: 'easy', userId: '6720c1f0a1b2c3d4e5f60aaa' }],
    ['client-supplied solution', { premise: PREMISE, difficulty: 'easy', solution: { culpritId: 's1' } }],
    ['__proto__ key', JSON.parse('{"premise":"A missing painting at the museum","difficulty":"easy","__proto__":{"x":1}}')],
  ])('create with %s -> 400 and nothing saved', async (_n, payload) => {
    await request(app).post('/api/cases').send(payload).expect(400);
    expect(await Case.countDocuments()).toBe(0);
  });

  it('operator-looking ids in the path or query never reach the database', async () => {
    const { agent, id } = await agentWithCase();
    await agent.get(`/api/cases/${encodeURIComponent('{"$ne":null}')}`).expect(400);
    await agent.get(`/api/cases/${encodeURIComponent(`${id}' || '1'=='1`)}`).expect(400);
    // a query string cannot widen the list to other players' cases
    await request.agent(app).post('/api/cases').send(BODY).expect(201);
    const list = await agent.get('/api/cases?playerId[$ne]=nobody&userId[$exists]=true').expect(200);
    expect(list.body.cases.map((c) => c.id)).toEqual([id]);
  });

  it('a mr_pid cookie that is not a UUID is replaced, not used', async () => {
    const { id } = await agentWithCase();
    for (const evil of [encodeURIComponent('{"$ne":null}'), 'x'.repeat(200), '*', '']) {
      const res = await request(app).get(`/api/cases/${id}`).set('Cookie', `mr_pid=${evil}`);
      expect(res.status, evil).toBe(403);
    }
  });
});

// ------------------------------------------------------------------ S5: ownership everywhere
describe('S5: another player cannot touch my case (every endpoint)', () => {
  it('403 on all of them and nothing changes', async () => {
    const owner = request.agent(app);
    const id = (await owner.post('/api/cases').send(BODY).expect(201)).body.case.id;
    const intruder = request.agent(app);
    const calls = [
      intruder.get(`/api/cases/${id}`),
      intruder.post(`/api/cases/${id}/clues/c1/discover`),
      intruder.post(`/api/cases/${id}/hints`),
      intruder.post(`/api/cases/${id}/accuse`).send({ suspectId: 's2' }),
      intruder.get(`/api/cases/${id}/result`),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403);
      expect(code(res)).toBe('FORBIDDEN');
    }
    const doc = await Case.findById(id).lean();
    expect([doc.status, doc.progress.hintsUsed, doc.progress.discoveredClueIds]).toEqual(['active', 0, []]);
    const list = await intruder.get('/api/cases').expect(200);
    expect(list.body.cases).toEqual([]);
  });
});

// ------------------------------------------------------------------ S13: content type
describe('S13: bodies must be application/json (415 otherwise)', () => {
  const noCase = async () => expect(await Case.countDocuments()).toBe(0);

  it('form-urlencoded POST -> 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(app).post('/api/cases').type('form').send({ premise: PREMISE, difficulty: 'easy' }).expect(415);
    expect(code(res)).toBe('UNSUPPORTED_MEDIA_TYPE');
    await noCase();
  });

  it('text/plain with JSON-looking content -> 415', async () => {
    const res = await request(app).post('/api/cases').set('content-type', 'text/plain').send(JSON.stringify({ premise: PREMISE, difficulty: 'easy' })).expect(415);
    expect(code(res)).toBe('UNSUPPORTED_MEDIA_TYPE');
    await noCase();
  });

  it('multipart -> 415', async () => {
    await request(app).post('/api/cases').field('premise', PREMISE).field('difficulty', 'easy').expect(415);
    await noCase();
  });

  it('the check happens before routing (unknown route + form body is still 415)', async () => {
    await request(app).post('/api/nope').type('form').send({ a: 1 }).expect(415);
  });

  it('application/json with a charset is fine', async () => {
    await request(app).post('/api/cases').set('content-type', 'application/json; charset=utf-8').send(JSON.stringify({ premise: PREMISE, difficulty: 'easy' })).expect(201);
  });

  it('bodiless POSTs (hints, discover) need no content type', async () => {
    const agent = request.agent(app);
    const id = (await agent.post('/api/cases').send(BODY).expect(201)).body.case.id;
    await agent.post(`/api/cases/${id}/hints`).expect(200);
    await agent.post(`/api/cases/${id}/clues/c1/discover`).expect(200);
  });

  it('JSON content type with an empty body on create is a 400, not a 415', async () => {
    const res = await request(app).post('/api/cases').set('content-type', 'application/json').expect(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
  });
});

// ------------------------------------------------------------------ S11: no stacks, no provider text, no values in logs
describe('S11: failures never leak internals', () => {
  const boomAi = (error) => ({ generateCase: async () => { throw error; } });

  it('an unexpected error -> generic 500 with no stack, message, or provider text', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const a = makeApp({ logger });
    // makeApp wires the mock ai; swap in one that throws for this app
    a.locals.ai = boomAi(new Error('db password is hunter2 and key AIza-not-real'));
    const res = await request(a).post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' }).expect(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|hunter2|AIza| at /);
    expect(res.text).not.toMatch(/node_modules|\.js:\d+/);
  });

  it('the server log for a 500 has the error name, a short message and stack frames, but not secret values', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const a = makeApp({ logger });
    const secretStory = 'S'.repeat(150);
    a.locals.ai = {
      // longer than the model's limit -> Mongoose ValidationError whose message contains the offending values
      generateCase: async () => ({
        data: {
          // Mongoose truncates long values itself, but quotes short ones in full (an invalid enum value here)
          status: 'SECRET_ENUM_VALUE',
          title: 'T'.repeat(101), setting: 's', crime: 'c', story: secretStory,
          suspects: [], clues: [], hints: [],
          solution: { culpritId: 's1', explanation: 'MOCK_SECRET_EXPLANATION in the log?', keyClueIds: [] },
        },
        meta: { provider: 'x', model: 'x', attempts: 1, latencyMs: 1 },
      }),
    };
    await request(a).post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' }).expect(500);
    await settle();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const logged = logger.error.mock.calls.flat().join(' ');
    expect(logged).toMatch(/ValidationError/);
    expect(logged).toMatch(/title/); // which fields, not their values
    expect(logged).toMatch(/status/);
    expect(logged).not.toContain('SECRET_ENUM_VALUE');
    expect(logged).not.toContain('T'.repeat(101));
    expect(logged).not.toContain(secretStory);
    expect(logged).not.toContain('MOCK_SECRET_EXPLANATION');
  });

  it('a long error message is truncated in the log', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const a = makeApp({ logger });
    a.locals.ai = boomAi(new Error(`start ${'x'.repeat(2000)} END_OF_MESSAGE`));
    await request(a).post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' }).expect(500);
    await settle();
    const logged = logger.error.mock.calls.flat().join(' ');
    expect(logged).toContain('start');
    expect(logged).not.toContain('END_OF_MESSAGE');
  });
});

// ------------------------------------------------------------------ helmet
describe('security headers (helmet)', () => {
  const check = (res) => {
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBeDefined();
  };

  it('are on successful responses', async () => check(await request(app).get('/api/health').expect(200)));
  it('are on 404s', async () => check(await request(app).get('/api/nope').expect(404)));
  it('are on validation errors', async () => check(await request(app).post('/api/cases').send({}).expect(400)));
  it('are on 415s', async () => check(await request(app).post('/api/cases').type('form').send('a=1').expect(415)));
  it('are on 429s', async () => {
    const limited = makeApp({ limits: { global: { limit: 1 } } });
    await request(limited).get('/api/health');
    check(await request(limited).get('/api/health').expect(429));
  });
});

// ------------------------------------------------------------------ CORS
describe('CORS allow-list', () => {
  const multi = makeApp({ clientUrl: 'https://a.example, https://b.example/ ,' });

  it('allows the default client origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows every origin of a comma list, ignoring spaces and trailing slashes', async () => {
    for (const o of ['https://a.example', 'https://b.example']) {
      const res = await request(multi).get('/api/health').set('Origin', o).expect(200);
      expect(res.headers['access-control-allow-origin'], o).toBe(o);
    }
  });

  it.each(['https://evil.example', 'http://localhost:5173.evil.example', 'https://a.example.evil.example', 'null', 'http://localhost:5174'])(
    'does not grant %s',
    async (o) => {
      const res = await request(multi).get('/api/health').set('Origin', o);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    },
  );

  it('answers a preflight from an allowed origin with 204 and the allowed method/headers', async () => {
    const res = await request(multi).options('/api/cases').set('Origin', 'https://a.example')
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type').expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://a.example');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('a preflight from a stranger gets no CORS headers', async () => {
    const res = await request(multi).options('/api/cases').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requests without an Origin (curl, health checks) still work', async () => {
    await request(multi).get('/api/health').expect(200);
  });
});

// ------------------------------------------------------------------ Turnstile
describe('Turnstile (only when TURNSTILE_SECRET is set)', () => {
  const okFetch = (success = true) => vi.fn(async () => new Response(JSON.stringify({ success }), { status: 200 }));
  const withTurnstile = (fetchImpl, extra = {}) => makeApp({ turnstile: { secret: 'test-secret-value', fetchImpl, ...extra } });
  const post = (a, body) => request(a).post('/api/cases').send(body);

  it('disabled when no secret: no token needed, Cloudflare never called', async () => {
    const f = okFetch();
    await post(makeApp({ turnstile: { secret: undefined, fetchImpl: f } }), { premise: PREMISE, difficulty: 'easy' }).expect(201);
    expect(f).not.toHaveBeenCalled();
  });

  it('enabled but no token -> 403 CAPTCHA_FAILED, no Cloudflare call, nothing saved', async () => {
    const f = okFetch();
    const res = await post(withTurnstile(f), { premise: PREMISE, difficulty: 'easy' }).expect(403);
    expect(code(res)).toBe('CAPTCHA_FAILED');
    expect(f).not.toHaveBeenCalled();
    expect(await Case.countDocuments()).toBe(0);
  });

  it('valid token -> 201, and siteverify is called as Cloudflare documents (form fields secret/response/remoteip)', async () => {
    const f = okFetch(true);
    await post(withTurnstile(f), { premise: PREMISE, difficulty: 'easy', turnstileToken: 'tok-123' }).set('X-Forwarded-For', '203.0.113.50').expect(201);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const form = init.body;
    expect(form.get('secret')).toBe('test-secret-value');
    expect(form.get('response')).toBe('tok-123');
    expect(form.get('remoteip')).toBe('203.0.113.50');
  });

  it.each([
    ['Cloudflare says success:false', () => okFetch(false)],
    ['Cloudflare answers with an HTTP error', () => vi.fn(async () => new Response('{"success":true}', { status: 500 }))],
    ['the reply is not JSON', () => vi.fn(async () => new Response('<html>', { status: 200 }))],
    ['the network is down', () => vi.fn(async () => { throw new TypeError('fetch failed'); })],
    ['success is a string, not true', () => vi.fn(async () => new Response('{"success":"true"}', { status: 200 }))],
  ])('fails closed when %s -> 403 CAPTCHA_FAILED and nothing saved', async (_n, makeFetch) => {
    const res = await post(withTurnstile(makeFetch()), { premise: PREMISE, difficulty: 'easy', turnstileToken: 'tok' }).expect(403);
    expect(code(res)).toBe('CAPTCHA_FAILED');
    expect(await Case.countDocuments()).toBe(0);
  });

  it('a hanging Cloudflare is cut off at the timeout -> 403', async () => {
    const hang = vi.fn((_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const t0 = Date.now();
    await post(withTurnstile(hang, { timeoutMs: 40 }), { premise: PREMISE, difficulty: 'easy', turnstileToken: 'tok' }).expect(403);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('an invalid body is rejected before Cloudflare is called, so the single-use token is not burned', async () => {
    const f = okFetch();
    const res = await post(withTurnstile(f), { premise: 'short', difficulty: 'easy', turnstileToken: 'tok' }).expect(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
    expect(f).not.toHaveBeenCalled();
  });

  it('only guards case creation: other routes need no token', async () => {
    const f = okFetch();
    const a = withTurnstile(f);
    const agent = request.agent(a);
    const id = (await agent.post('/api/cases').send({ premise: PREMISE, difficulty: 'easy', turnstileToken: 't' }).expect(201)).body.case.id;
    await agent.get(`/api/cases/${id}`).expect(200);
    await agent.post(`/api/cases/${id}/hints`).expect(200);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('the secret never appears in any response', async () => {
    const res = await post(withTurnstile(okFetch(false)), { premise: PREMISE, difficulty: 'easy', turnstileToken: 'tok' });
    expect(JSON.stringify(res.body) + JSON.stringify(res.headers)).not.toContain('test-secret-value');
  });
});

// ------------------------------------------------------------------ logs
describe('request log hygiene', () => {
  const logged = (logger) => logger.info.mock.calls.map((c) => c[0]);
  const fresh = () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() });

  it('writes exactly one line per request: method, path, status, ms, ip', async () => {
    const logger = fresh();
    const a = makeApp({ logger });
    await request(a).get('/api/health').set('X-Forwarded-For', '203.0.113.7');
    await settle();
    expect(logged(logger)).toHaveLength(1);
    expect(logged(logger)[0]).toMatch(/^GET \/api\/health 200 \d+ms ip=203\.0\.113\.7$/);
  });

  it('covers errors too (404, 415, 400, 429) with their real status', async () => {
    const logger = fresh();
    const a = makeApp({ logger, limits: { global: { limit: 4 } } });
    await request(a).get('/api/nope'); // 404
    await request(a).post('/api/cases').type('form').send('a=1'); // 415
    await request(a).post('/api/cases').send({}); // 400
    await request(a).get('/api/health'); // 200
    await request(a).get('/api/health'); // 429
    await settle();
    expect(logged(logger).map((l) => l.split(' ')[2])).toEqual(['404', '415', '400', '200', '429']);
  });

  it('drops the query string', async () => {
    const logger = fresh();
    await request(makeApp({ logger })).get('/api/cases?token=SECRET_IN_QUERY&x=1');
    await settle();
    expect(logged(logger)[0]).toMatch(/^GET \/api\/cases 200 /);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('SECRET_IN_QUERY');
  });

  it('never logs the premise, the body, cookies or auth headers', async () => {
    const logger = fresh();
    const a = makeApp({ logger });
    await request(a).post('/api/cases').set('Cookie', 'mr_pid=3b241101-e2bb-4255-8caf-4136c566a962; mr_token=JWT_SECRET_VALUE')
      .set('Authorization', 'Bearer BEARER_SECRET').send({ premise: `${PREMISE} PREMISE_MARKER`, difficulty: 'easy' }).expect(201);
    await settle();
    const all = JSON.stringify([logger.info.mock.calls, logger.error.mock.calls, logger.warn.mock.calls]);
    for (const bit of ['PREMISE_MARKER', PREMISE, '3b241101', 'JWT_SECRET_VALUE', 'BEARER_SECRET', 'MOCK_SECRET_EXPLANATION']) expect(all, bit).not.toContain(bit);
  });

  it('without a logger the app stays silent and works', async () => {
    await request(makeApp({ logger: null })).get('/api/health').expect(200);
  });
});

// ------------------------------------------------------------------ cookies
describe('cookie flags (read from a fresh process so NODE_ENV can differ)', () => {
  const flags = (env) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/middleware/player.js').then((m) => console.log(JSON.stringify(m.cookieOptions(5))))"], {
      encoding: 'utf8', env: { ...process.env, ...env },
    });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };

  it('development: httpOnly, SameSite=Lax, not Secure', () => {
    expect(flags({ NODE_ENV: 'development', CROSS_SITE_COOKIES: 'false' })).toEqual({ httpOnly: true, sameSite: 'lax', secure: false, maxAge: 5, path: '/' });
  });
  it('production: Secure is on', () => {
    expect(flags({ NODE_ENV: 'production', CROSS_SITE_COOKIES: 'false' })).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, maxAge: 5, path: '/' });
  });
  it('cross-site mode: SameSite=None always comes with Secure', () => {
    expect(flags({ NODE_ENV: 'production', CROSS_SITE_COOKIES: 'true' })).toMatchObject({ sameSite: 'none', secure: true, httpOnly: true });
    expect(flags({ NODE_ENV: 'development', CROSS_SITE_COOKIES: 'true' })).toMatchObject({ sameSite: 'none', secure: true });
  });
});
