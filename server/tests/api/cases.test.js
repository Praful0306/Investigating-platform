import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { makeApp } from '../helpers/app.js';
import { useMemoryDb } from '../helpers/db.js';
import { sampleCase } from '../helpers/fixtures.js';
import { Case } from '../../src/models/Case.js';
import { loadOwned } from '../../src/services/case.service.js';
import { mockProvider } from '../../src/services/ai/providers/mock.js';
import { computeScore } from '../../src/services/scoring.js';

useMemoryDb();

const PREMISE = 'A priceless sitar vanishes during a college music fest';
const GHOST_ID = 'f'.repeat(24);
const SECRET_BITS = ['solution', 'culpritId', 'keyClueIds', 'explanation', 'MOCK_SECRET_EXPLANATION', 'playerId', '"ai"'];
const COUNTS = { easy: [3, 5, 2], medium: [4, 7, 3], hard: [5, 9, 3] };

const app = makeApp();
const make = (a = request.agent(app), body = { premise: PREMISE, difficulty: 'easy' }) => a.post('/api/cases').send(body);

describe('create', () => {
  it.each(Object.entries(COUNTS))('%s -> 201 with the right counts and nothing discovered', async (difficulty, [s, c, h]) => {
    const res = await make(request.agent(app), { premise: PREMISE, difficulty }).expect(201);
    const k = res.body.case;
    expect(k).toMatchObject({ difficulty, premise: PREMISE, status: 'active' });
    expect(k.id).toMatch(/^[a-f\d]{24}$/);
    expect([k.suspects.length, k.clues.length, k.hints.total]).toEqual([s, c, h]);
    expect(k.clues.every((x) => x.discovered === false && x.description === null)).toBe(true);
    expect(k.hints).toMatchObject({ used: 0, revealed: [] });
    expect(k.progress).toEqual({ discoveredCount: 0, totalClues: c, hintsUsed: 0, hintsTotal: h });
    expect(new Date(k.createdAt).toString()).not.toBe('Invalid Date');
    expect(Object.keys(res.body)).toEqual(['case']);
  });

  it('never sends secrets back', async () => {
    const res = await make().expect(201);
    const all = JSON.stringify(res.body);
    for (const bit of SECRET_BITS) expect(all).not.toContain(bit);
    expect(all).not.toContain('MOCK_CLUE_1_TEXT'); // undiscovered clue text
    expect(all).not.toContain('MOCK_HINT_1_TEXT'); // unrevealed hint text
  });

  it('stores the case for this player, with the solution and AI meta kept server-side', async () => {
    const agent = request.agent(app);
    const res = await make(agent).expect(201);
    const pid = /mr_pid=([^;]+)/.exec(res.headers['set-cookie'].join(';'))[1];
    const doc = await Case.findById(res.body.case.id).select('+solution +ai');
    expect(doc.playerId).toBe(pid);
    expect(doc.userId).toBeNull();
    expect(doc.solution.culpritId).toBe('s2');
    expect(doc.ai).toMatchObject({ provider: 'mock', model: 'mock-1', attempts: 1 });
    expect(doc.progress.hintsUsed).toBe(0);
  });

  it('normalises the premise (control chars, repeated whitespace, edges)', async () => {
    const res = await make(request.agent(app), { premise: '  A   stolen\n trophy\tat the\u0000 final  ', difficulty: 'easy' }).expect(201);
    expect(res.body.case.premise).toBe('A stolen trophy at the final');
  });

  it('accepts 10 and 300 character premises', async () => {
    await make(request.agent(app), { premise: 'a'.repeat(10), difficulty: 'easy' }).expect(201);
    await make(request.agent(app), { premise: 'a'.repeat(300), difficulty: 'easy' }).expect(201);
  });

  it('hands the trimmed premise and the difficulty to the AI service', async () => {
    const provider = mockProvider();
    await make(request.agent(makeApp({ provider })), { premise: `  ${PREMISE}  `, difficulty: 'hard' }).expect(201);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].prompt).toContain(`"""${PREMISE}"""`);
    expect(provider.calls[0].prompt).toContain('Difficulty: hard.');
  });

  it('tolerates an optional turnstileToken string', async () => {
    await make(request.agent(app), { premise: PREMISE, difficulty: 'easy', turnstileToken: 'x'.repeat(100) }).expect(201);
  });

  describe('validation -> 400 VALIDATION_ERROR and nothing saved', () => {
    it.each([
      ['premise too short (9)', { premise: 'a'.repeat(9), difficulty: 'easy' }, /10.300/],
      ['premise only spaces', { premise: ' '.repeat(40), difficulty: 'easy' }, /10.300/],
      ['premise too long (301)', { premise: 'a'.repeat(301), difficulty: 'easy' }, /10.300/],
      ['premise missing', { difficulty: 'easy' }],
      ['premise is a number', { premise: 12345678901, difficulty: 'easy' }],
      ['premise is an operator object', { premise: { $gt: '' }, difficulty: 'easy' }],
      ['difficulty unknown', { premise: PREMISE, difficulty: 'extreme' }],
      ['difficulty missing', { premise: PREMISE }],
      ['difficulty is an operator object', { premise: PREMISE, difficulty: { $ne: null } }],
      ['extra field (score)', { premise: PREMISE, difficulty: 'easy', score: 999 }],
      ['extra field (playerId)', { premise: PREMISE, difficulty: 'easy', playerId: 'someone-else' }],
      ['turnstileToken not a string', { premise: PREMISE, difficulty: 'easy', turnstileToken: 5 }],
      ['turnstileToken too long', { premise: PREMISE, difficulty: 'easy', turnstileToken: 'x'.repeat(2049) }],
      ['body is an array', [PREMISE]],
    ])('%s', async (_name, body, message) => {
      const res = await make(request.agent(app), body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      if (message) expect(res.body.error.message).toMatch(message);
      expect(await Case.countDocuments()).toBe(0);
    });

    it('no body at all', async () => {
      const res = await request(app).post('/api/cases').expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('AI failures leave no case behind', () => {
    it('invalid-always -> 502 AI_GENERATION_FAILED', async () => {
      const res = await make(request.agent(makeApp({ mode: 'invalid-always' }))).expect(502);
      expect(res.body.error).toMatchObject({ code: 'AI_GENERATION_FAILED' });
      expect(await Case.countDocuments()).toBe(0);
    });

    it('unavailable -> 503 AI_UNAVAILABLE', async () => {
      const res = await make(request.agent(makeApp({ mode: 'unavailable' }))).expect(503);
      expect(res.body.error).toMatchObject({ code: 'AI_UNAVAILABLE' });
      expect(await Case.countDocuments()).toBe(0);
    });

    it('invalid-once is retried transparently -> 201', async () => {
      await make(request.agent(makeApp({ mode: 'invalid-once' }))).expect(201);
      expect(await Case.countDocuments()).toBe(1);
    });
  });
});

describe('get', () => {
  it('returns the same public case to its owner', async () => {
    const agent = request.agent(app);
    const created = (await make(agent).expect(201)).body.case;
    const res = await agent.get(`/api/cases/${created.id}`).expect(200);
    expect(res.body.case).toEqual(created);
    for (const bit of SECRET_BITS) expect(JSON.stringify(res.body)).not.toContain(bit);
  });

  it('works from a second client that carries the same mr_pid cookie', async () => {
    const created = await make();
    const pid = /mr_pid=([^;]+)/.exec(created.headers['set-cookie'].join(';'))[1];
    await request(app).get(`/api/cases/${created.body.case.id}`).set('Cookie', `mr_pid=${pid}`).expect(200);
  });

  it('another player -> 403 FORBIDDEN', async () => {
    const created = (await make().expect(201)).body.case;
    const res = await request.agent(app).get(`/api/cases/${created.id}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain(created.title);
  });

  it('a request with no cookie at all -> 403, not a crash', async () => {
    const created = (await make().expect(201)).body.case;
    await request(app).get(`/api/cases/${created.id}`).expect(403);
  });

  it.each([
    ['not hex', 'abc'],
    ['24 chars but not hex', 'z'.repeat(24)],
    ['23 hex chars', 'a'.repeat(23)],
    ['25 hex chars', 'a'.repeat(25)],
    ['operator-looking', encodeURIComponent('{"$ne":1}')],
  ])('bad id (%s) -> 400 INVALID_ID', async (_n, id) => {
    const res = await request(app).get(`/api/cases/${id}`).expect(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('unknown but valid id -> 404 CASE_NOT_FOUND', async () => {
    const res = await request(app).get(`/api/cases/${GHOST_ID}`).expect(404);
    expect(res.body.error.code).toBe('CASE_NOT_FOUND');
  });

  it('is read-only: getting a case changes nothing', async () => {
    const agent = request.agent(app);
    const { id } = (await make(agent)).body.case;
    const before = await Case.findById(id).lean();
    await agent.get(`/api/cases/${id}`).expect(200);
    const after = await Case.findById(id).lean();
    expect(after).toEqual(before);
  });
});

describe('get ownership by userId (service level, used once T-12 adds login)', () => {
  it('lets a logged-in user in through userId even from a different player cookie', async () => {
    const userId = '6720c1f0a1b2c3d4e5f60aaa';
    const doc = await Case.create({ ...sampleCase({ playerId: 'device-1' }), userId });
    const loaded = await loadOwned(String(doc._id), { playerId: 'device-2', user: { id: userId } });
    expect(String(loaded._id)).toBe(String(doc._id));
  });

  it('rejects a logged-in user with a different userId', async () => {
    const doc = await Case.create({ ...sampleCase({ playerId: 'device-1' }), userId: '6720c1f0a1b2c3d4e5f60aaa' });
    await expect(loadOwned(String(doc._id), { playerId: 'device-2', user: { id: '6720c1f0a1b2c3d4e5f60bbb' } }))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('a guest cannot match a case whose userId is null by sending user: undefined', async () => {
    const doc = await Case.create(sampleCase({ playerId: 'device-1' }));
    await expect(loadOwned(String(doc._id), { playerId: 'device-2', user: undefined })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('withSolution selects the solution; default does not', async () => {
    const doc = await Case.create(sampleCase({ playerId: 'p' }));
    const plain = await loadOwned(String(doc._id), { playerId: 'p' });
    const full = await loadOwned(String(doc._id), { playerId: 'p' }, { withSolution: true });
    expect(plain.solution).toBeUndefined();
    expect(full.solution.culpritId).toBe('s2');
  });
});

describe('get list (history)', () => {
  it('lists only my cases, newest first, as summaries without secrets', async () => {
    const agent = request.agent(app);
    const first = (await make(agent).expect(201)).body.case;
    const second = (await make(agent, { premise: PREMISE, difficulty: 'hard' }).expect(201)).body.case;
    await make(request.agent(app)).expect(201); // someone else's
    const res = await agent.get('/api/cases').expect(200);
    expect(res.body.cases.map((c) => c.id)).toEqual([second.id, first.id]);
    expect(Object.keys(res.body.cases[0]).sort()).toEqual(['createdAt', 'difficulty', 'id', 'score', 'status', 'title']);
    expect(res.body.cases[0]).toMatchObject({ difficulty: 'hard', status: 'active', score: null });
    for (const bit of SECRET_BITS) expect(JSON.stringify(res.body)).not.toContain(bit);
  });

  it('a brand-new visitor gets an empty list', async () => {
    const res = await request(app).get('/api/cases').expect(200);
    expect(res.body).toEqual({ cases: [] });
  });

  it('returns at most 50', async () => {
    const pid = '3b241101-e2bb-4255-8caf-4136c566a962';
    await Case.insertMany(Array.from({ length: 55 }, () => sampleCase({ playerId: pid })));
    const res = await request(app).get('/api/cases').set('Cookie', `mr_pid=${pid}`).expect(200);
    expect(res.body.cases).toHaveLength(50);
  });
});

// ---------------------------------------------------------------- gameplay (T-10)
const discover = (a, id, clueId) => a.post(`/api/cases/${id}/clues/${clueId}/discover`);
const hint = (a, id) => a.post(`/api/cases/${id}/hints`);
const accuse = (a, id, suspectId) => a.post(`/api/cases/${id}/accuse`).send({ suspectId });
const result = (a, id) => a.get(`/api/cases/${id}/result`);
const code = (res) => res.body.error?.code;

async function start(difficulty = 'easy') {
  const agent = request.agent(app);
  const k = (await make(agent, { premise: PREMISE, difficulty }).expect(201)).body.case;
  return { agent, id: k.id, k };
}
async function play({ difficulty, clues, hints, suspect }) {
  const { agent, id } = await start(difficulty);
  for (let i = 1; i <= clues; i++) await discover(agent, id, `c${i}`).expect(200);
  for (let i = 0; i < hints; i++) await hint(agent, id).expect(200);
  return { agent, id, res: await accuse(agent, id, suspect).expect(200) };
}
// Runs `sneak()` right before the next findOneAndUpdate executes: a deterministic "other request lands in between".
function interleaveOnce(sneak) {
  const original = Case.findOneAndUpdate;
  const spy = vi.spyOn(Case, 'findOneAndUpdate').mockImplementationOnce(function (...args) {
    const q = original.apply(this, args);
    const exec = q.exec.bind(q);
    q.exec = async (...a) => { await sneak(); return exec(...a); };
    return q;
  });
  return () => spy.mockRestore();
}

describe('discover', () => {
  it('reveals the clue text and updates progress', async () => {
    const { agent, id } = await start();
    const res = await discover(agent, id, 'c1').expect(200);
    expect(res.body).toEqual({
      clue: { id: 'c1', title: 'Rosin smudge', location: 'Green room door', discovered: true, description: expect.stringContaining('MOCK_CLUE_1_TEXT') },
      progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 0, hintsTotal: 2 },
      alreadyDiscovered: false,
    });
    expect(JSON.stringify(res.body)).not.toContain('MOCK_CLUE_2_TEXT'); // other clues stay hidden
  });

  it('is idempotent: again -> 200 alreadyDiscovered, count unchanged', async () => {
    const { agent, id } = await start();
    await discover(agent, id, 'c1').expect(200);
    const again = await discover(agent, id, 'c1').expect(200);
    expect(again.body.alreadyDiscovered).toBe(true);
    expect(again.body.progress.discoveredCount).toBe(1);
    expect(again.body.clue.description).toContain('MOCK_CLUE_1_TEXT');
    expect((await Case.findById(id)).progress.discoveredClueIds).toEqual(['c1']);
  });

  it('shows up in GET: discovered text visible, the rest still null', async () => {
    const { agent, id } = await start();
    await discover(agent, id, 'c2').expect(200);
    const k = (await agent.get(`/api/cases/${id}`).expect(200)).body.case;
    expect(k.clues.map((c) => c.discovered)).toEqual([false, true, false, false, false]);
    expect(k.clues[1].description).toContain('MOCK_CLUE_2_TEXT');
    expect(k.clues[0].description).toBeNull();
    expect(k.progress.discoveredCount).toBe(1);
  });

  it('5 parallel requests for one clue: all 200, exactly one is the new discovery, counted once', async () => {
    const { agent, id } = await start();
    const rs = await Promise.all(Array.from({ length: 5 }, () => discover(agent, id, 'c3')));
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(rs.filter((r) => r.body.alreadyDiscovered === false)).toHaveLength(1);
    expect((await Case.findById(id)).progress.discoveredClueIds).toEqual(['c3']);
  });

  it('every clue can be found; progress reaches the total', async () => {
    const { agent, id } = await start('medium');
    let last;
    for (let i = 1; i <= 7; i++) last = await discover(agent, id, `c${i}`).expect(200);
    expect(last.body.progress).toMatchObject({ discoveredCount: 7, totalClues: 7 });
  });

  it('unknown clue (valid format) -> 404 CLUE_NOT_FOUND; clue 99 on a hard case too', async () => {
    const { agent, id } = await start();
    expect(code(await discover(agent, id, 'c99').expect(404))).toBe('CLUE_NOT_FOUND');
    expect(code(await discover(agent, id, 'c6').expect(404))).toBe('CLUE_NOT_FOUND'); // easy has c1..c5
  });

  it.each(['c', 'c100', 'C1', 'x1', 'c1x', 'c-1', 'c001', '1'])('clueId "%s" -> 400 VALIDATION_ERROR', async (clueId) => {
    const { agent, id } = await start();
    expect(code(await discover(agent, id, encodeURIComponent(clueId)).expect(400))).toBe('VALIDATION_ERROR');
  });

  it('other player 403, bad case id 400 INVALID_ID, unknown case 404', async () => {
    const { id } = await start();
    expect(code(await discover(request.agent(app), id, 'c1').expect(403))).toBe('FORBIDDEN');
    expect(code(await discover(request.agent(app), 'nope', 'c1').expect(400))).toBe('INVALID_ID');
    expect(code(await discover(request.agent(app), GHOST_ID, 'c1').expect(404))).toBe('CASE_NOT_FOUND');
    expect((await Case.findById(id)).progress.discoveredClueIds).toEqual([]); // the 403 changed nothing
  });

  it('after the accusation -> 409 CASE_ALREADY_COMPLETED, even for an already-found clue', async () => {
    const { agent, id } = await start();
    await discover(agent, id, 'c1').expect(200);
    await accuse(agent, id, 's1').expect(200);
    expect(code(await discover(agent, id, 'c1').expect(409))).toBe('CASE_ALREADY_COMPLETED');
    expect(code(await discover(agent, id, 'c2').expect(409))).toBe('CASE_ALREADY_COMPLETED');
    expect((await Case.findById(id)).progress.discoveredClueIds).toEqual(['c1']);
  });
});

describe('hints', () => {
  it('reveals hints in order, one per request, until none are left', async () => {
    const { agent, id } = await start('hard'); // 3 hints
    for (let i = 0; i < 3; i++) {
      const res = await hint(agent, id).expect(200);
      expect(res.body.hint).toEqual({ index: i, text: expect.stringContaining(`MOCK_HINT_${i + 1}_TEXT`) });
      expect(res.body.progress).toMatchObject({ hintsUsed: i + 1, hintsTotal: 3 });
    }
    expect(code(await hint(agent, id).expect(409))).toBe('NO_HINTS_LEFT');
    expect((await Case.findById(id)).progress.hintsUsed).toBe(3);
  });

  it('GET shows only the hints already revealed', async () => {
    const { agent, id } = await start();
    await hint(agent, id).expect(200);
    const res = await agent.get(`/api/cases/${id}`).expect(200);
    expect(res.body.case.hints).toEqual({ total: 2, used: 1, revealed: [{ index: 0, text: expect.stringContaining('MOCK_HINT_1_TEXT') }] });
    expect(JSON.stringify(res.body)).not.toContain('MOCK_HINT_2_TEXT');
  });

  it('the client cannot pick which hint it gets', async () => {
    const { agent, id } = await start();
    const res = await hint(agent, id).send({ index: 1, hintIndex: 1 }).expect(200);
    expect(res.body.hint.index).toBe(0);
    expect(res.body.hint.text).toContain('MOCK_HINT_1_TEXT');
  });

  it('5 parallel requests on easy (2 hints): exactly 2 succeed, 3 get NO_HINTS_LEFT', async () => {
    const { agent, id } = await start('easy');
    const rs = await Promise.all(Array.from({ length: 5 }, () => hint(agent, id)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(2);
    const losers = rs.filter((r) => r.status === 409);
    expect(losers).toHaveLength(3);
    expect(losers.every((r) => code(r) === 'NO_HINTS_LEFT')).toBe(true);
    expect(rs.filter((r) => r.status === 200).map((r) => r.body.hint.index).sort()).toEqual([0, 1]); // no index handed out twice
    expect((await Case.findById(id)).progress.hintsUsed).toBe(2);
  });

  it('8 parallel requests on medium (3 hints): exactly 3 succeed', async () => {
    const { agent, id } = await start('medium');
    const rs = await Promise.all(Array.from({ length: 8 }, () => hint(agent, id)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(3);
    expect((await Case.findById(id)).progress.hintsUsed).toBe(3);
  });

  it('after the accusation -> 409 CASE_ALREADY_COMPLETED (also when none were left)', async () => {
    const { agent, id } = await start();
    await accuse(agent, id, 's2').expect(200);
    expect(code(await hint(agent, id).expect(409))).toBe('CASE_ALREADY_COMPLETED');
    const full = await start();
    await hint(full.agent, full.id); await hint(full.agent, full.id);
    await accuse(full.agent, full.id, 's2').expect(200);
    expect(code(await hint(full.agent, full.id).expect(409))).toBe('CASE_ALREADY_COMPLETED');
    expect((await Case.findById(id)).progress.hintsUsed).toBe(0);
  });

  it('other player 403, bad id 400, unknown 404', async () => {
    const { id } = await start();
    expect(code(await hint(request.agent(app), id).expect(403))).toBe('FORBIDDEN');
    expect(code(await hint(request.agent(app), 'zz').expect(400))).toBe('INVALID_ID');
    expect(code(await hint(request.agent(app), GHOST_ID).expect(404))).toBe('CASE_NOT_FOUND');
    expect((await Case.findById(id)).progress.hintsUsed).toBe(0);
  });
});

describe('result before the accusation', () => {
  it('-> 409 CASE_NOT_COMPLETED, and the body holds no secrets', async () => {
    const { agent, id } = await start();
    const res = await result(agent, id).expect(409);
    expect(code(res)).toBe('CASE_NOT_COMPLETED');
    for (const bit of [...SECRET_BITS, 'Arjun']) expect(JSON.stringify(res.body)).not.toContain(bit);
  });

  it('other player 403, bad id 400, unknown 404', async () => {
    const { id } = await start();
    expect(code(await result(request.agent(app), id).expect(403))).toBe('FORBIDDEN');
    expect(code(await result(request.agent(app), 'zz').expect(400))).toBe('INVALID_ID');
    expect(code(await result(request.agent(app), GHOST_ID).expect(404))).toBe('CASE_NOT_FOUND');
  });
});

describe('accuse', () => {
  it('correct accusation: verdict, culprit, explanation, key clues, score, status solved', async () => {
    const { agent, id } = await start();
    await discover(agent, id, 'c1').expect(200);
    await hint(agent, id).expect(200);
    const res = await accuse(agent, id, 's2').expect(200);
    const r = res.body.result;
    expect(Object.keys(res.body)).toEqual(['result']);
    expect(Object.keys(r).sort()).toEqual([
      'accused', 'caseId', 'completedAt', 'culprit', 'difficulty', 'explanation', 'keyClues', 'progress', 'score', 'status', 'title', 'verdict',
    ]);
    expect(r).toMatchObject({
      caseId: id, difficulty: 'easy', status: 'solved', verdict: 'correct',
      accused: { id: 's2', name: 'Arjun Rao' }, culprit: { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player' },
      score: { base: 100, clueBonus: 5, hintPenalty: 10, total: 95 },
      progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 1, hintsTotal: 2 },
    });
    expect(r.explanation).toContain('MOCK_SECRET_EXPLANATION');
    expect(r.keyClues).toEqual([{ id: 'c1', title: 'Rosin smudge', found: true }, { id: 'c3', title: 'Wet footprints', found: false }, { id: 'c4', title: 'Tuning fork', found: false }]);
    const doc = await Case.findById(id);
    expect(doc.status).toBe('solved');
    expect(doc.accusation).toMatchObject({ suspectId: 's2', correct: true });
    expect(doc.accusation.submittedAt).toBeInstanceOf(Date);
    expect(doc.completedAt).toBeInstanceOf(Date);
    expect(doc.score.total).toBe(95);
  });

  it('wrong accusation: incorrect, base 0, clue bonus and hint penalty still count, culprit revealed, status failed', async () => {
    const { agent, id } = await start('medium');
    for (const c of ['c1', 'c2', 'c3']) await discover(agent, id, c).expect(200);
    await hint(agent, id).expect(200);
    const r = (await accuse(agent, id, 's1').expect(200)).body.result;
    expect(r).toMatchObject({
      status: 'failed', verdict: 'incorrect', accused: { id: 's1', name: 'Meera Iyer' }, culprit: { id: 's2', name: 'Arjun Rao' },
      score: { base: 0, clueBonus: 15, hintPenalty: 10, total: 5 },
    });
    expect((await Case.findById(id)).status).toBe('failed');
  });

  it('the stored score is never below zero', async () => {
    const { res } = await play({ difficulty: 'medium', clues: 1, hints: 3, suspect: 's1' });
    expect(res.body.result.score).toEqual({ base: 0, clueBonus: 5, hintPenalty: 30, total: 0 });
  });

  it.each([
    ['A', 'easy', 3, 1, 's2', 105], ['B', 'medium', 7, 3, 's2', 155], ['C', 'hard', 9, 0, 's2', 245],
    ['D', 'hard', 0, 3, 's2', 170], ['E', 'easy', 3, 0, 's1', 15], ['F', 'medium', 1, 2, 's1', 0],
  ])('SPEC §8 case %s through the API: %s, %i clues, %i hints, accuse %s -> %i', async (_c, difficulty, clues, hints, suspect, total) => {
    const { res } = await play({ difficulty, clues, hints, suspect });
    expect(res.body.result.score.total).toBe(total);
    expect(res.body.result.score).toEqual(computeScore({ difficulty, correct: suspect === 's2', discoveredCount: clues, hintsUsed: hints }));
  });

  it('GET result returns the same payload as the accusation', async () => {
    const { agent, id, res } = await play({ difficulty: 'easy', clues: 2, hints: 1, suspect: 's2' });
    const again = await result(agent, id).expect(200);
    expect(again.body).toEqual(res.body);
  });

  it('after completion GET /cases/:id still works, shows status, and keeps secrets hidden', async () => {
    const { agent, id } = await play({ difficulty: 'easy', clues: 1, hints: 0, suspect: 's1' });
    const res = await agent.get(`/api/cases/${id}`).expect(200);
    expect(res.body.case.status).toBe('failed');
    for (const bit of [...SECRET_BITS, 'MOCK_CLUE_2_TEXT']) expect(JSON.stringify(res.body)).not.toContain(bit);
    const list = await agent.get('/api/cases').expect(200);
    expect(list.body.cases[0]).toMatchObject({ id, status: 'failed', score: 5 });
  });

  it('a second accusation -> 409 and nothing changes', async () => {
    const { agent, id } = await start();
    const first = await accuse(agent, id, 's1').expect(200);
    expect(code(await accuse(agent, id, 's2').expect(409))).toBe('CASE_ALREADY_COMPLETED');
    const doc = await Case.findById(id);
    expect(doc.accusation.suspectId).toBe('s1');
    expect(doc.status).toBe('failed');
    expect((await result(agent, id)).body).toEqual(first.body);
  });

  it('suspect that does not exist -> 404 SUSPECT_NOT_FOUND and the case stays active', async () => {
    const easy = await start('easy');
    const medium = await start('medium');
    expect(code(await accuse(easy.agent, easy.id, 's9').expect(404))).toBe('SUSPECT_NOT_FOUND');
    expect(code(await accuse(easy.agent, easy.id, 's4').expect(404))).toBe('SUSPECT_NOT_FOUND'); // easy has s1..s3
    expect(code(await accuse(medium.agent, medium.id, 's5').expect(404))).toBe('SUSPECT_NOT_FOUND'); // medium has s1..s4
    expect((await Case.findById(easy.id)).status).toBe('active');
    const hard = await start('hard');
    await accuse(hard.agent, hard.id, 's5').expect(200); // hard really has s5
  });

  it.each([
    ['missing', {}], ['wrong format', { suspectId: 'x1' }], ['two digits', { suspectId: 's10' }], ['uppercase', { suspectId: 'S1' }],
    ['number', { suspectId: 1 }], ['operator object', { suspectId: { $ne: null } }], ['empty', { suspectId: '' }],
    ['extra score field', { suspectId: 's2', score: 999 }], ['extra culpritId field', { suspectId: 's2', culpritId: 's2' }],
    ['array body', ['s2']],
  ])('invalid body (%s) -> 400 VALIDATION_ERROR and the case stays active', async (_n, body) => {
    const { agent, id } = await start();
    const res = await agent.post(`/api/cases/${id}/accuse`).send(body).expect(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
    expect((await Case.findById(id)).status).toBe('active');
  });

  it('no body at all -> 400', async () => {
    const { agent, id } = await start();
    expect(code(await agent.post(`/api/cases/${id}/accuse`).expect(400))).toBe('VALIDATION_ERROR');
  });

  it('other player 403, bad id 400, unknown 404; the owner is unaffected', async () => {
    const { agent, id } = await start();
    expect(code(await accuse(request.agent(app), id, 's2').expect(403))).toBe('FORBIDDEN');
    expect(code(await accuse(request.agent(app), 'zz', 's2').expect(400))).toBe('INVALID_ID');
    expect(code(await accuse(request.agent(app), GHOST_ID, 's2').expect(404))).toBe('CASE_NOT_FOUND');
    expect((await Case.findById(id)).status).toBe('active');
    await accuse(agent, id, 's2').expect(200);
  });

  describe('races', () => {
    it('5 simultaneous accusations: exactly one wins, the rest get 409, and the stored result is the winner', async () => {
      const { agent, id } = await start();
      const rs = await Promise.all(['s1', 's2', 's3', 's1', 's2'].map((s) => accuse(agent, id, s)));
      const winners = rs.filter((r) => r.status === 200);
      expect(winners).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409).every((r) => code(r) === 'CASE_ALREADY_COMPLETED')).toBe(true);
      const doc = await Case.findById(id);
      expect(doc.accusation.suspectId).toBe(winners[0].body.result.accused.id);
      expect(doc.score.total).toBe(winners[0].body.result.score.total);
    });

    it('a hint that lands between loading and saving is not lost: the accusation retries and scores it', async () => {
      const { agent, id } = await start();
      const restore = interleaveOnce(() => Case.updateOne({ _id: id }, { $inc: { 'progress.hintsUsed': 1 } }));
      const res = await accuse(agent, id, 's2');
      restore();
      expect(res.status).toBe(200);
      expect(res.body.result.progress.hintsUsed).toBe(1);
      expect(res.body.result.score).toEqual({ base: 100, clueBonus: 0, hintPenalty: 10, total: 90 });
      expect((await Case.findById(id)).score.total).toBe(90);
    });

    it('a clue found between loading and saving is not lost either', async () => {
      const { agent, id } = await start();
      const restore = interleaveOnce(() => Case.updateOne({ _id: id }, { $addToSet: { 'progress.discoveredClueIds': 'c2' } }));
      const res = await accuse(agent, id, 's1');
      restore();
      expect(res.status).toBe(200);
      expect(res.body.result.progress.discoveredCount).toBe(1);
      expect(res.body.result.score).toEqual({ base: 0, clueBonus: 5, hintPenalty: 0, total: 5 });
    });

    it('another accusation finishing between loading and saving -> this one gets 409 and cannot overwrite', async () => {
      const { agent, id } = await start();
      const winner = { status: 'solved', accusation: { suspectId: 's2', correct: true, submittedAt: new Date() }, score: { base: 100, clueBonus: 0, hintPenalty: 0, total: 100 }, completedAt: new Date() };
      const restore = interleaveOnce(() => Case.updateOne({ _id: id }, { $set: winner }));
      const res = await accuse(agent, id, 's1');
      restore();
      expect(res.status).toBe(409);
      expect(code(res)).toBe('CASE_ALREADY_COMPLETED');
      const doc = await Case.findById(id);
      expect(doc.accusation.suspectId).toBe('s2');
      expect(doc.score.total).toBe(100);
    });

    it('accusation mixed with hints and clue discoveries: no lost updates, score always matches the final state', async () => {
      for (let round = 0; round < 12; round++) {
        const { agent, id } = await start();
        const rs = await Promise.all([accuse(agent, id, 's2'), hint(agent, id), hint(agent, id), discover(agent, id, 'c1'), discover(agent, id, 'c2')]);
        for (const r of rs) expect([200, 409]).toContain(r.status);
        const doc = await Case.findById(id);
        const [, h1, h2, d1, d2] = rs;
        const hintsOk = [h1, h2].filter((r) => r.status === 200).length;
        const cluesOk = [d1, d2].filter((r) => r.status === 200 && r.body.alreadyDiscovered === false).length;
        expect(doc.progress.hintsUsed, `round ${round}`).toBe(hintsOk);
        expect(doc.progress.discoveredClueIds.length, `round ${round}`).toBe(cluesOk);
        expect(doc.score, `round ${round}`).toMatchObject({ base: 100, clueBonus: 5 * cluesOk, hintPenalty: 10 * hintsOk });
        expect(doc.status).toBe('solved');
      }
    });
  });
});
