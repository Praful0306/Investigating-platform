// Live smoke test of a deployed site:  node scripts/smoke.mjs <https://address> [easy|medium|hard]
// Plays one whole case through the public API (create, clues, hint, accuse, result) and checks what a bad deploy gets
// wrong: database down, missing security headers, secrets in responses, a cookie that is not HttpOnly, someone else
// being able to open the case, a second accusation being accepted. It makes ONE case (one AI call), so run it a few
// times at most. Point it at the Vercel address (this goes through the /api rewrite) or at the API address directly.
import { pathToFileURL } from 'node:url';
import { CLUE_POINTS, DIFFICULTY, HINT_PENALTY } from '../src/config/difficulty.js';

const PREMISE = 'A priceless sitar vanishes during a college music fest';
// the fields that must never appear, as JSON keys, in anything sent before the accusation
const SECRET_KEY = /"(solution|culpritId|keyClueIds|explanation|playerId|passwordHash|ai)"\s*:/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke(baseUrl, { difficulty = 'easy', waitSeconds = 90, log = console.log } = {}) {
  const cfg = DIFFICULTY[difficulty];
  if (!cfg) throw new Error(`Unknown difficulty "${difficulty}": use easy, medium or hard.`);
  const base = String(baseUrl).replace(/\/+$/, '');
  const checks = [];
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok: Boolean(ok), detail });
    log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` (${detail})` : ''}`);
    return Boolean(ok);
  };

  async function call(method, path, { body, cookie, form, timeout = 30_000 } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let payload;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = 'a=1'; }
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    try {
      const res = await fetch(`${base}${path}`, { method, headers, body: payload, signal: AbortSignal.timeout(timeout) });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status, text, json, headers: res.headers, setCookie: res.headers.getSetCookie?.() ?? [] };
    } catch (err) {
      return { status: 0, text: '', json: null, headers: new Headers(), setCookie: [], error: err?.name === 'TimeoutError' ? 'timed out' : (err?.cause?.code ?? err?.message ?? 'failed') };
    }
  }

  const finish = () => ({ ok: checks.every((c) => c.ok), checks });

  // 1. health. A sleeping free instance can take about a minute to wake up, so keep asking for a while.
  const deadline = Date.now() + waitSeconds * 1000;
  let health;
  do {
    health = await call('get', '/api/health', { timeout: 15_000 });
    if (health.status === 200 && health.json?.db === 'up') break;
    await sleep(Math.min(3000, Math.max(0, deadline - Date.now())));
  } while (Date.now() < deadline);
  if (!check('health: answers 200 with the database up', health.status === 200 && health.json?.ok === true && health.json?.db === 'up', health.error ?? `status ${health.status}, db ${health.json?.db}`)) return finish();

  // 2. headers and error shapes
  const nosniff = health.headers.get('x-content-type-options') === 'nosniff';
  const noPoweredBy = !health.headers.has('x-powered-by');
  check('security headers: nosniff on, no x-powered-by', nosniff && noPoweredBy, `nosniff=${nosniff}, x-powered-by hidden=${noPoweredBy}`);
  const missing = await call('get', '/api/definitely-not-a-route');
  check('unknown API route: 404 JSON error, no stack trace', missing.status === 404 && missing.json?.error?.code === 'ROUTE_NOT_FOUND' && !/\bat .*\(/.test(missing.text), `status ${missing.status}`);
  const formPost = await call('post', '/api/cases', { form: true });
  check('form-encoded POST: 415 (bodies must be JSON)', formPost.status === 415, `status ${formPost.status}`);
  const injected = await call('post', '/api/cases', { body: { premise: { $gt: '' }, difficulty: difficulty } });
  check('injection body: 400, nothing created', injected.status === 400, `status ${injected.status}`);

  // 3. create a case (the one AI call)
  const created = await call('post', '/api/cases', { body: { premise: PREMISE, difficulty }, timeout: 120_000 });
  const c = created.json?.case;
  if (!check(`create case (${difficulty}): 201 with a case`, created.status === 201 && c?.id, created.error ?? `status ${created.status}: ${created.json?.error?.code ?? created.text.slice(0, 80)}`)) return finish();
  const idCookie = created.setCookie.find((s) => s.startsWith('mr_pid='));
  const httpsSite = base.startsWith('https://');
  check('guest cookie: issued, HttpOnly, SameSite, and Secure on https', Boolean(idCookie) && /HttpOnly/i.test(idCookie) && /SameSite=(Lax|None)/i.test(idCookie) && (!httpsSite || /Secure/i.test(idCookie)), idCookie ? idCookie.replace(/mr_pid=[^;]+/, 'mr_pid=…') : 'no mr_pid cookie');
  const cookie = idCookie?.split(';')[0];
  check(`counts match the ${difficulty} rules (${cfg.suspects} suspects, ${cfg.clues} clues, ${cfg.hints} hints)`, c.suspects?.length === cfg.suspects && c.clues?.length === cfg.clues && c.hints?.total === cfg.hints, `${c.suspects?.length}/${c.clues?.length}/${c.hints?.total}`);
  check('nothing is discovered yet and no clue text is sent', c.clues.every((k) => k.discovered === false && k.description === null) && c.hints.revealed.length === 0);

  // 4. play
  const seen = [created.text];
  const first = c.clues[0].id;
  const found = await call('post', `/api/cases/${c.id}/clues/${first}/discover`, { cookie });
  seen.push(found.text);
  check('discover a clue: 200, now revealed', found.status === 200 && found.json?.clue?.discovered === true && typeof found.json?.clue?.description === 'string' && found.json?.alreadyDiscovered === false, `status ${found.status}`);
  const again = await call('post', `/api/cases/${c.id}/clues/${first}/discover`, { cookie });
  seen.push(again.text);
  check('discover it again: 200, flagged already discovered, progress unchanged', again.status === 200 && again.json?.alreadyDiscovered === true && again.json?.progress?.discoveredCount === 1, `status ${again.status}`);
  const nothere = await call('post', `/api/cases/${c.id}/clues/c99/discover`, { cookie });
  check('discover a clue that does not exist: 404', nothere.status === 404 && nothere.json?.error?.code === 'CLUE_NOT_FOUND', `status ${nothere.status}`);
  const hint = await call('post', `/api/cases/${c.id}/hints`, { cookie });
  seen.push(hint.text);
  check('take a hint: 200, first hint revealed', hint.status === 200 && hint.json?.hint?.index === 0 && typeof hint.json?.hint?.text === 'string' && hint.json?.progress?.hintsUsed === 1, `status ${hint.status}`);
  const reopened = await call('get', `/api/cases/${c.id}`, { cookie });
  seen.push(reopened.text);
  check('reopen the case: progress kept (1 clue, 1 hint)', reopened.status === 200 && reopened.json?.case?.progress?.discoveredCount === 1 && reopened.json?.case?.progress?.hintsUsed === 1, `status ${reopened.status}`);
  check('no secrets leaked in any response before the accusation', seen.every((t) => !SECRET_KEY.test(t)), seen.map((t) => SECRET_KEY.exec(t)?.[1]).filter(Boolean).join(', '));

  const stranger = await call('get', `/api/cases/${c.id}`);
  check('another browser (no cookie) cannot open the case: 403', stranger.status === 403 && stranger.json?.error?.code === 'FORBIDDEN', `status ${stranger.status}`);

  // 5. accuse
  const culprit = c.suspects[0].id;
  const verdict = await call('post', `/api/cases/${c.id}/accuse`, { cookie, body: { suspectId: culprit } });
  const r = verdict.json?.result;
  if (!check('accuse: 200 with a verdict', verdict.status === 200 && (r?.verdict === 'correct' || r?.verdict === 'incorrect'), `status ${verdict.status}`)) return finish();
  const expected = Math.max(0, (r.verdict === 'correct' ? cfg.base : 0) + CLUE_POINTS * 1 - HINT_PENALTY * 1);
  check(`score total follows the rules (${r.verdict}, 1 clue, 1 hint = ${expected})`, r.score?.total === expected, `got ${r.score?.total}`);
  check(`score breakdown: base, +${CLUE_POINTS} per clue, -${HINT_PENALTY} per hint`, r.score?.base === (r.verdict === 'correct' ? cfg.base : 0) && r.score?.clueBonus === CLUE_POINTS && r.score?.hintPenalty === HINT_PENALTY, JSON.stringify(r.score));
  check('result carries the explanation and the culprit now', typeof r.explanation === 'string' && r.explanation.length > 20 && Boolean(r.culprit?.name) && Array.isArray(r.keyClues));
  const second = await call('post', `/api/cases/${c.id}/accuse`, { cookie, body: { suspectId: c.suspects[1].id } });
  check('accuse twice: the second accusation is refused with 409', second.status === 409 && second.json?.error?.code === 'CASE_ALREADY_COMPLETED', `status ${second.status}`);
  const result = await call('get', `/api/cases/${c.id}/result`, { cookie });
  check('GET result after closing: 200, same score', result.status === 200 && result.json?.result?.score?.total === expected, `status ${result.status}`);
  const late = await call('post', `/api/cases/${c.id}/hints`, { cookie });
  check('hint after closing: 409', late.status === 409 && late.json?.error?.code === 'CASE_ALREADY_COMPLETED', `status ${late.status}`);

  return finish();
}

// ---------------------------------------------------------------- command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const [url, difficulty = 'easy'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const waitFlag = flags.find((f) => f.startsWith('--wait='));
  const waitSeconds = waitFlag ? Number(waitFlag.slice(7)) : 90; // how long to keep asking while a sleeping free instance wakes up
  const usage = (why) => {
    console.error(`${why}\nUsage: node scripts/smoke.mjs <http(s)://address> [easy|medium|hard]`);
    process.exit(1);
  };
  if (!url || !/^https?:\/\//i.test(url)) usage('Give the address of the site, starting with http:// or https://');
  if (!DIFFICULTY[difficulty]) usage(`Unknown difficulty "${difficulty}".`);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) usage('--wait must be a number of seconds.');

  console.log(`Smoke test: ${url} (${difficulty})`);
  const { ok, checks } = await runSmoke(url, { difficulty, waitSeconds });
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n${passed}/${checks.length} checks passed${ok ? '' : ': FAILED'}`);
  process.exit(ok ? 0 : 1);
}
