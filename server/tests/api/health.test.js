import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import * as connect from '../../src/db/connect.js';
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

  describe('when the database is down', () => {
    afterEach(() => vi.restoreAllMocks());
    const dbDown = () => vi.spyOn(connect, 'dbState').mockReturnValue('down');

    it('answers 503 with ok:false and db:down, so Render and a monitor can tell something is wrong', async () => {
      dbDown();
      const res = await request(app).get('/api/health').expect(503);
      expect(res.body).toMatchObject({ ok: false, db: 'down' });
      expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
    });

    it('is still a well-formed JSON answer with the usual headers (it never crashes or hangs)', async () => {
      dbDown();
      const res = await request(app).get('/api/health');
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('comes back to 200 as soon as the database is back', async () => {
      const spy = dbDown();
      await request(app).get('/api/health').expect(503);
      spy.mockRestore();
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body).toMatchObject({ ok: true, db: 'up' });
    });

    it('any state other than connected (disconnected, connecting, disconnecting) counts as down', () => {
      const spy = vi.spyOn(mongoose.connection, 'readyState', 'get');
      for (const state of [0, 2, 3, 99]) {
        spy.mockReturnValue(state);
        expect(connect.dbState()).toBe('down');
      }
      spy.mockReturnValue(1);
      expect(connect.dbState()).toBe('up');
      spy.mockRestore();
    });
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
