import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';

useMemoryDb();
const app = makeApp();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pidFrom = (res) => /mr_pid=([^;]+)/.exec((res.headers['set-cookie'] ?? []).join(';'))?.[1];

describe('GET /api/health', () => {
  it('returns ok, db up and an ISO time', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.db).toBe('up');
    expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
  });

  it('issues an httpOnly mr_pid cookie to a new visitor', async () => {
    const res = await request(app).get('/api/health');
    expect(pidFrom(res)).toMatch(UUID_V4);
    const raw = res.headers['set-cookie'].join(';');
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
  });

  it('keeps a valid mr_pid cookie (no new Set-Cookie)', async () => {
    const pid = '3b241101-e2bb-4255-8caf-4136c566a962';
    const res = await request(app).get('/api/health').set('Cookie', `mr_pid=${pid}`);
    expect(pidFrom(res)).toBeUndefined();
  });

  it('replaces a malformed mr_pid cookie', async () => {
    const res = await request(app).get('/api/health').set('Cookie', 'mr_pid=not-a-uuid');
    expect(pidFrom(res)).toMatch(UUID_V4);
  });
});

describe('error envelope', () => {
  it('unknown route -> 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.error.message).toBe('Route not found');
  });

  it('malformed JSON body -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/nope').set('content-type', 'application/json').send('{bad').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('body over 10kb -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/nope').send({ x: 'a'.repeat(11000) }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
