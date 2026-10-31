import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';

useMemoryDb();

const PREMISE = 'A priceless sitar vanishes during a college music fest';
const noStore = (res) => expect(res.headers['cache-control']).toBe('no-store');

// Everything under /api is about one visitor's cases and cookie, so no shared cache (the hosting proxies in front of the
// API, a CDN rule added later, a browser) may keep any of it, whatever the answer was.
describe('Cache-Control: no-store on the whole API', () => {
  const app = makeApp();

  it('on the health check', async () => {
    noStore(await request(app).get('/api/health').expect(200));
  });

  it('on a created case (201) and on reading it back', async () => {
    const agent = request.agent(app);
    const made = await agent.post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' }).expect(201);
    noStore(made);
    noStore(await agent.get(`/api/cases/${made.body.case.id}`).expect(200));
    noStore(await agent.get('/api/cases').expect(200));
  });

  it('on the result and on the history list, which carry the most private data', async () => {
    const agent = request.agent(app);
    const made = await agent.post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' });
    const id = made.body.case.id;
    noStore(await agent.post(`/api/cases/${id}/accuse`).send({ suspectId: 's1' }).expect(200));
    noStore(await agent.get(`/api/cases/${id}/result`).expect(200));
  });

  it.each([
    ['404 for an unknown route', (a) => a.get('/api/nope'), 404],
    ['400 for a bad body', (a) => a.post('/api/cases').send({ premise: 'x' }), 400],
    ['400 for a bad id', (a) => a.get('/api/cases/not-an-id'), 400],
    ['403 for someone else\'s case', async (a) => { const m = await request(app).post('/api/cases').send({ premise: PREMISE, difficulty: 'easy' }); return a.get(`/api/cases/${m.body.case.id}`); }, 403],
    ['503 for a token when sign-in is not configured', (a) => a.get('/api/cases').set('Authorization', 'Bearer nonsense'), 503],
    ['415 for a form post', (a) => a.post('/api/cases').type('form').send('a=1'), 415],
  ])('on errors too: %s', async (_name, make, status) => {
    const res = await make(request(makeApp()));
    expect(res.status).toBe(status);
    noStore(res);
  });

  it('on a rate-limit refusal (429)', async () => {
    const limited = makeApp({ limits: { global: { limit: 1 } } });
    await request(limited).get('/api/health').expect(200);
    const res = await request(limited).get('/api/health');
    expect(res.status).toBe(429);
    noStore(res);
  });

  it('on the sign-in session call', async () => {
    noStore(await request(app).post('/api/auth/session'));
  });
});
