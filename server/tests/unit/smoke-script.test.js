import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import express from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';
import { runSmoke } from '../../scripts/smoke.mjs';

useMemoryDb();

const servers = [];
function serve(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}
afterAll(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

const quiet = { log() {}, write() {} };
const failedNames = (r) => r.checks.filter((c) => !c.ok).map((c) => c.name);

// the real app, with some behaviour changed on the way out, to prove the smoke test notices
function wrapped(tweak) {
  const outer = express();
  outer.use(tweak);
  outer.use(makeApp());
  return outer;
}

describe('scripts/smoke.mjs against a healthy app', () => {
  it.each(['easy', 'medium', 'hard'])('%s: every check passes', async (difficulty) => {
    const url = await serve(makeApp());
    const result = await runSmoke(url, { difficulty, ...quiet });
    expect(failedNames(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(15);
  }, 30_000);

  it('covers the things a deployment can get wrong (health, headers, 404 envelope, 415, ownership, one accusation, no leaks)', async () => {
    const url = await serve(makeApp());
    const names = (await runSmoke(url, { difficulty: 'easy', ...quiet })).checks.map((c) => c.name).join(' | ');
    for (const word of [/health/i, /security headers/i, /404/i, /415/i, /cookie/i, /another browser/i, /twice|second accusation/i, /secret|leak/i, /score/i]) {
      expect(names).toMatch(word);
    }
  }, 30_000);

  it('tolerates a trailing slash on the address', async () => {
    const url = await serve(makeApp());
    expect((await runSmoke(`${url}/`, { difficulty: 'easy', ...quiet })).ok).toBe(true);
  }, 30_000);

  it('does not take a second look at a case that is not its own (each run makes its own case)', async () => {
    const url = await serve(makeApp());
    const a = await runSmoke(url, { difficulty: 'easy', ...quiet });
    const b = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(a.ok && b.ok).toBe(true);
  }, 30_000);
});

describe('scripts/smoke.mjs notices problems', () => {
  it('fails when a response leaks the culprit', async () => {
    const url = await serve(wrapped((req, res, next) => {
      const json = res.json.bind(res);
      res.json = (body) => json(body?.case ? { ...body, case: { ...body.case, culpritId: 's2' } } : body);
      next();
    }));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/secret|leak/i);
  }, 30_000);

  it('fails when the security headers are missing', async () => {
    const url = await serve(wrapped((req, res, next) => {
      const set = res.setHeader.bind(res);
      res.setHeader = (name, value) => (/^x-content-type-options$/i.test(name) ? res : set(name, value));
      next();
    }));
    expect(failedNames(await runSmoke(url, { difficulty: 'easy', ...quiet })).join(' ')).toMatch(/security headers/i);
  }, 30_000);

  it('fails when the cookie is not HttpOnly', async () => {
    const url = await serve(wrapped((req, res, next) => {
      const set = res.setHeader.bind(res);
      res.setHeader = (name, value) => set(name, /^set-cookie$/i.test(name) ? [].concat(value).map((c) => c.replace(/;\s*HttpOnly/i, '')) : value);
      next();
    }));
    expect(failedNames(await runSmoke(url, { difficulty: 'easy', ...quiet })).join(' ')).toMatch(/cookie/i);
  }, 30_000);

  it('fails when the score breakdown is wrong even if the total looks right', async () => {
    const url = await serve(wrapped((req, res, next) => {
      if (req.method === 'POST' && /\/accuse$/.test(req.path)) {
        const json = res.json.bind(res);
        res.json = (b) => json(b?.result ? { result: { ...b.result, score: { ...b.result.score, clueBonus: 99 } } } : b);
      }
      next();
    }));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/score breakdown/i);
  }, 30_000);

  it('fails when a form-encoded POST is not refused with a 415', async () => {
    const url = await serve(wrapped((req, res, next) => (req.method === 'POST' && req.is('application/x-www-form-urlencoded') ? res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'x' } }) : next())));
    expect(failedNames(await runSmoke(url, { difficulty: 'easy', ...quiet })).join(' ')).toMatch(/415/);
  }, 30_000);

  it('fails when the server answers 500 to creating a case, and does not throw', async () => {
    const url = await serve(wrapped((req, res, next) => (req.method === 'POST' && req.path === '/api/cases' ? res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }) : next())));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/create/i);
  }, 30_000);

  it('fails when the app is up but the database is down', async () => {
    const url = await serve(wrapped((req, res, next) => (req.path === '/api/health' ? res.json({ ok: true, db: 'down', time: 'x' }) : next())));
    const result = await runSmoke(url, { difficulty: 'easy', waitSeconds: 1, ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/health/i);
  }, 30_000);

  it('fails when a stranger with no cookie is not refused with a 403', async () => {
    const url = await serve(wrapped((req, res, next) => {
      if (!req.headers.cookie) { // the stranger gets a different answer than "forbidden"
        const json = res.json.bind(res);
        res.json = (body) => { if (body?.error?.code === 'FORBIDDEN') res.status(404); return json(body); };
      }
      next();
    }));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/another browser/i);
  }, 30_000);

  it('fails when a second accusation is accepted', async () => {
    let accusations = 0;
    const url = await serve(wrapped((req, res, next) => {
      if (req.method === 'POST' && /\/accuse$/.test(req.path) && ++accusations === 2) return res.status(200).json({ result: { verdict: 'incorrect' } });
      return next();
    }));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/twice|second accusation/i);
  }, 30_000);

  it('fails when the score is not what the rules say', async () => {
    const url = await serve(wrapped((req, res, next) => {
      if (req.method === 'POST' && /\/accuse$/.test(req.path)) {
        const json = res.json.bind(res);
        res.json = (b) => json(b?.result ? { result: { ...b.result, score: { ...b.result.score, total: b.result.score.total + 7 } } } : b);
      }
      next();
    }));
    const result = await runSmoke(url, { difficulty: 'easy', ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/score total follows the rules/i);
  }, 30_000);

  it('fails clearly (and does not throw) when nothing is listening', async () => {
    const result = await runSmoke('http://127.0.0.1:9', { difficulty: 'easy', waitSeconds: 1, ...quiet });
    expect(result.ok).toBe(false);
    expect(failedNames(result).join(' ')).toMatch(/health/i);
  }, 30_000);

  it('rejects a difficulty it does not know', async () => {
    await expect(runSmoke('http://127.0.0.1:9', { difficulty: 'nightmare', ...quiet })).rejects.toThrow(/difficulty/i);
  });
});

describe('scripts/smoke.mjs as a command', () => {
  const run = (...argv) => spawnSync(process.execPath, ['scripts/smoke.mjs', ...argv], { encoding: 'utf8', timeout: 60_000 });

  it('prints usage and exits 1 without an address', () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage/i);
  });

  it('rejects an address that is not http(s)', () => {
    const r = run('ftp://example.com');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage|http/i);
  });

  it('exits 1 and says FAILED when the site is not healthy', () => {
    const r = run('http://127.0.0.1:9', 'easy', '--wait=1');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/FAILED/);
  });

  it('rejects a --wait that is not a number', () => {
    const r = run('http://127.0.0.1:9', 'easy', '--wait=soon');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--wait/);
  });

  it('exits 0 and prints a tick per check against a healthy app (run as a real child process)', async () => {
    const url = await serve(makeApp());
    const { code, out } = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['scripts/smoke.mjs', url, 'easy']);
      let text = '';
      child.stdout.on('data', (d) => { text += d; });
      child.on('close', (c) => resolve({ code: c, out: text }));
    });
    expect(code).toBe(0);
    expect(out.match(/✓/g).length).toBeGreaterThanOrEqual(15);
    expect(out).not.toMatch(/✗/);
    expect(out).not.toMatch(/MOCK_SECRET/); // the script never prints the solution
  }, 60_000);
});
