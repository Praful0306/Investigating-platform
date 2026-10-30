# 05 — Test & verification spec

Principle: **every task has a command that proves it works.** AI tools must run it and show the output.
Development and tests use `AI_PROVIDERS=mock` and an in-memory MongoDB, so they cost zero Gemini quota and need no internet.

## 1. Test pyramid
| Layer | Tool | Location | Runs in |
|---|---|---|---|
| Unit (server) | Vitest | `server/tests/unit` | < 5 s |
| API (server) | Vitest + Supertest + mongodb-memory-server | `server/tests/api` | < 30 s |
| Component (client) | Vitest + Testing Library + jsdom | `client/src/**/*.test.jsx` | < 15 s |
| E2E | Playwright (Chromium) | `client/e2e` | < 2 min |
| Live AI check | `server/scripts/try-ai.mjs` | manual, few runs | ~30 s |
| Production smoke | `server/scripts/smoke.mjs` | manual after deploy | ~60 s |

## 2. Server setup
`server/vitest.config.js`
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', setupFiles: ['tests/helpers/setup.js'], hookTimeout: 60000, testTimeout: 30000, fileParallelism: false } });
```
`tests/helpers/setup.js`: set `process.env.NODE_ENV='test'`, `AI_PROVIDERS='mock'`; start `MongoMemoryServer` in `beforeAll`, `connectDB(uri)`; `afterEach` delete all collections; `afterAll` disconnect + stop.
`tests/helpers/app.js`: `makeApp({ mode = 'valid', limits })` → `createApp({ ai: createAiService([mockProvider({ mode })]), limits })`.
First run of mongodb-memory-server downloads a MongoDB binary (~100 MB) — do it once on day 0.

## 3. Required server tests (the checklist graders care about)
| File | Covers | SPEC AC |
|---|---|---|
| `unit/scoring.test.js` | cases A–F, min 0, unknown difficulty | AC4 |
| `unit/validate.test.js` | valid ×3 difficulties, each semantic rule fails correctly, fenced JSON ok, non-JSON fails | AC1, AC6 |
| `unit/ai-service.test.js` | retry with feedback, 3-attempt cap, fallback provider, 502 vs 503 | AC6 |
| `unit/serializer.test.js` | no secrets in public case, toResult guard | AC3 |
| `unit/model.test.js` | `select:false` on solution, toJSON strips, enum validation | AC3 |
| `api/health.test.js` | 200, cookie issued | — |
| `api/cases.test.js` | full lifecycle, idempotent discover, hint limits, one accusation, wrong accusation, 404/400/409s, concurrency, no save on AI failure | AC1, AC2, AC4, AC5 |
| `api/security.test.js` | leak scan, injection bodies, 403 ownership, 415, no stack | AC3, AC8 |
| `api/rate-limit.test.js` | create limiter returns 429 envelope with low test limits | — |
| `api/auth.test.js` (Tier 2) | ID-token verification (valid, expired, wrong issuer/audience/alg, forged), session + claim, history, ownership | — |

## 4. Client tests
`client/src/test/setup.js`: `import '@testing-library/jest-dom/vitest'`; mock `matchMedia` (reduced motion true → animations skipped in tests).
Tests use `VITE_USE_MOCK` mock API (or `vi.mock('../api/cases')`).
- `CreateMystery.test.jsx`: Generate disabled for 5-char premise; chip fills premise; submit calls `createCase` with trimmed premise + difficulty; error banner shows friendly message for `AI_GENERATION_FAILED`.
- `Investigation.test.jsx`: renders suspects/clues counts; Examine reveals description and progress `1/5`; hint confirm → hint text visible; button disabled after last hint; redirect when status solved.
- `Accusation.test.jsx`: Accuse disabled until selection; confirm modal; calls `accuse` with selected id.
- `Results.test.jsx`: correct → "SOLVED", culprit name, score total; incorrect → "UNSOLVED".

## 5. E2E — `client/e2e/flow.spec.js`
`playwright.config.js` `webServer`: start server with `AI_PROVIDERS=mock NODE_ENV=test` and an in-memory DB script (`server/scripts/dev-memory.mjs`, which boots MongoMemoryServer and then the app), plus `npm run dev` for the client; `baseURL: http://localhost:5173`.
Scenarios:
1. Easy full flow: home → start → chip → Generate → room shows 3 suspects/5 clues → examine 2 clues → 1 hint → accuse `s2` card → result "SOLVED", total 100+10−10 = **100**.
2. Wrong accusation on medium → "UNSOLVED", base 0.
3. Reload `/case/:id` after accusation → lands on result.
4. Network check: during scenario 1, collect every `/api/` response body; none contains `MOCK_SECRET_EXPLANATION` before the accuse request.
5. Mobile viewport 375×812: sticky Accuse bar visible, flow works.
```bash
cd client && npx playwright install chromium   # once
npx playwright test
```

## 6. Production smoke — `server/scripts/smoke.mjs`
Node 20+, no deps. Usage: `node server/scripts/smoke.mjs https://your-app.vercel.app [difficulty]`.
```js
const base = process.argv[2].replace(/\/$/, ''); const difficulty = process.argv[3] || 'easy';
let cookie = '';
async function call(method, path, body) {
  const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(cookie && { cookie }) }, body: body && JSON.stringify(body) });
  const set = r.headers.getSetCookie?.() ?? []; if (set.length) cookie = set.map(c => c.split(';')[0]).join('; ');
  const json = await r.json().catch(() => ({})); return { status: r.status, json, text: JSON.stringify(json) };
}
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('PASS', m); };
const h = await call('GET', '/health'); ok(h.status === 200 && h.json.db === 'up', 'health + db');
const t0 = Date.now();
const c = await call('POST', '/cases', { premise: 'A stolen trophy at a college cricket final', difficulty });
ok(c.status === 201, `create ${difficulty} (${Date.now() - t0} ms)`);
const id = c.json.case.id; const leakFree = s => !/solution|culpritId|keyClueIds|explanation/.test(s);
ok(leakFree(c.text), 'create response leak-free');
const g = await call('GET', `/cases/${id}`); ok(g.status === 200 && leakFree(g.text), 'get leak-free');
const d = await call('POST', `/cases/${id}/clues/c1/discover`); ok(d.status === 200 && d.json.clue.description, 'discover');
const hi = await call('POST', `/cases/${id}/hints`); ok(hi.status === 200 && hi.json.hint.text, 'hint');
const early = await call('GET', `/cases/${id}/result`); ok(early.status === 409, 'result locked before accuse');
const a = await call('POST', `/cases/${id}/accuse`, { suspectId: 's1' }); ok(a.status === 200 && a.json.result.culprit, 'accuse');
const s = a.json.result.score; ok(s.total === Math.max(0, s.base + 5 - 10), 'score formula');
const again = await call('POST', `/cases/${id}/accuse`, { suspectId: 's1' }); ok(again.status === 409, 'single accusation');
const other = await fetch(base + `/api/cases/${id}`); ok(other.status === 403, 'other player blocked');
console.log('SMOKE OK');
```
Run it for `easy`, `medium`, `hard` after each production deploy (3 Gemini calls).

## 7. Manual QA script (T-22, ~30 min, record results in README)
For each difficulty: generate with a fresh premise → read story (no culprit giveaway) → counts right → examine all clues → use all hints → try extra hint (disabled) → accuse → result explanation is consistent with clues → score matches formula → New mystery works. Also: phone (real device), slow network (DevTools "Fast 3G"), backend asleep (first load), invalid premise, refresh on every page, back button after accusation.

## 8. CI (optional, 10 min, recommended)
`.github/workflows/ci.yml`: on push/PR → Node 22 → `npm ci` in server and client → `npm test` (server) → `npm run lint && npm test && npm run build` (client) → secret grep from `03-security.md` §5. No real API keys in CI.
