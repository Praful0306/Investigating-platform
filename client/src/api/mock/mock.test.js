import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as mock from './index.js';
import { buildMockCase, PUBLIC_CASE_EXAMPLE, RESULT_EXAMPLE } from './fixtures.js';
// The REAL server code is the referee: the mock must produce exactly what the server would (SPEC §5 contract).
import { toCaseSummary, toPublicCase, toResult } from '../../../../server/src/serializers/case.serializer.js';
import { computeScore } from '../../../../server/src/services/scoring.js';
import { validateGenerated } from '../../../../server/src/services/ai/validate.js';
import { DIFFICULTY as SERVER } from '../../../../server/src/config/difficulty.js';

const PREMISE = 'A stolen trophy at a college cricket final';
const GHOST = 'f'.repeat(24);
const json = (v) => JSON.parse(JSON.stringify(v));
const make = (difficulty = 'easy') => mock.createCase({ premise: PREMISE, difficulty });

beforeEach(() => {
  mock.__reset();
  mock.__setLatency(0);
});

describe('fixtures', () => {
  it('PUBLIC_CASE_EXAMPLE is the SPEC §5.3 example', () => {
    const c = PUBLIC_CASE_EXAMPLE;
    expect(c).toMatchObject({
      id: '6720c1f0a1b2c3d4e5f60718', title: 'The Silent Sitar', premise: 'A priceless sitar vanishes during a college music fest',
      difficulty: 'easy', setting: 'Ravindra Music College, Pune — festival night', status: 'active', createdAt: '2026-10-31T10:00:00.000Z',
      progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 1, hintsTotal: 2 },
    });
    expect(c.story.length).toBeGreaterThanOrEqual(300);
    expect(c.suspects[0]).toMatchObject({ id: 's1', name: 'Meera Iyer', role: 'Festival coordinator' });
    expect(c.clues[0]).toMatchObject({ id: 'c1', title: 'Rosin smudge', location: 'Green room door', discovered: true });
    expect(c.clues[0].description).toBeTruthy();
    expect(c.clues[1]).toEqual({ id: 'c2', title: 'Torn ticket', location: 'Back stairwell', discovered: false, description: null });
    expect(c.hints.total).toBe(2);
    expect(c.hints.used).toBe(1);
    expect(c.hints.revealed).toEqual([{ index: 0, text: expect.any(String) }]);
  });

  it('RESULT_EXAMPLE is the SPEC §5.4 example', () => {
    expect(RESULT_EXAMPLE).toMatchObject({
      caseId: '6720c1f0a1b2c3d4e5f60718', title: 'The Silent Sitar', difficulty: 'easy', status: 'solved', verdict: 'correct',
      accused: { id: 's2', name: 'Arjun Rao' }, culprit: { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player' },
      score: { base: 100, clueBonus: 15, hintPenalty: 10, total: 105 },
      progress: { discoveredCount: 3, totalClues: 5, hintsUsed: 1, hintsTotal: 2 },
      completedAt: '2026-10-31T10:12:00.000Z',
    });
    expect(RESULT_EXAMPLE.keyClues[0]).toEqual({ id: 'c1', title: 'Rosin smudge', found: true });
    expect(RESULT_EXAMPLE.explanation.length).toBeGreaterThan(50);
  });

  it.each(['easy', 'medium', 'hard'])('%s mock story obeys the server\'s fair-play validator (counts, ids, no culprit leaks)', (d) => {
    const r = validateGenerated(JSON.stringify(buildMockCase(d)), d);
    expect(r.errors ?? []).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.data.solution.culpritId).toBe('s2');
  });

  it('the three difficulties are three different stories', () => {
    const titles = ['easy', 'medium', 'hard'].map((d) => buildMockCase(d).title);
    expect(new Set(titles).size).toBe(3);
  });
});

describe('createCase', () => {
  it.each(['easy', 'medium', 'hard'])('%s: counts match the server table and nothing is revealed', async (d) => {
    const c = await make(d);
    expect([c.suspects.length, c.clues.length, c.hints.total]).toEqual([SERVER[d].suspects, SERVER[d].clues, SERVER[d].hints]);
    expect(c).toMatchObject({ difficulty: d, status: 'active', premise: PREMISE });
    expect(c.id).toMatch(/^[a-f\d]{24}$/);
    expect(c.clues.every((x) => !x.discovered && x.description === null)).toBe(true);
    expect(c.hints).toMatchObject({ used: 0, revealed: [] });
  });

  it('has exactly the SPEC §5.3 shape', async () => {
    const c = await make();
    expect(Object.keys(c).sort()).toEqual(Object.keys(PUBLIC_CASE_EXAMPLE).sort());
    expect(Object.keys(c.suspects[0]).sort()).toEqual(Object.keys(PUBLIC_CASE_EXAMPLE.suspects[0]).sort());
    expect(Object.keys(c.clues[0]).sort()).toEqual(Object.keys(PUBLIC_CASE_EXAMPLE.clues[0]).sort());
    expect(Object.keys(c.hints).sort()).toEqual(Object.keys(PUBLIC_CASE_EXAMPLE.hints).sort());
    expect(Object.keys(c.progress).sort()).toEqual(Object.keys(PUBLIC_CASE_EXAMPLE.progress).sort());
  });

  it('never exposes the solution, undiscovered clue text or unrevealed hints', async () => {
    const c = await make('hard');
    const full = mock.__getDoc(c.id);
    const text = JSON.stringify(c);
    for (const key of ['solution', 'culpritId', 'keyClueIds', 'explanation', 'playerId']) expect(text).not.toContain(key);
    expect(text).not.toContain(full.solution.explanation);
    for (const clue of full.clues) expect(text).not.toContain(clue.description);
    for (const h of full.hints) expect(text).not.toContain(h);
  });

  it('normalises the premise like the server (trim, collapse whitespace, control chars)', async () => {
    const c = await mock.createCase({ premise: '  A   stolen\n trophy\tat the\u0000 final  ', difficulty: 'easy' });
    expect(c.premise).toBe('A stolen trophy at the final');
  });

  it.each([
    ['too short', { premise: 'short', difficulty: 'easy' }],
    ['blank', { premise: ' '.repeat(30), difficulty: 'easy' }],
    ['too long', { premise: 'a'.repeat(301), difficulty: 'easy' }],
    ['missing premise', { difficulty: 'easy' }],
    ['non-string premise', { premise: 12345678901234, difficulty: 'easy' }],
    ['unknown difficulty', { premise: PREMISE, difficulty: 'extreme' }],
    ['missing difficulty', { premise: PREMISE }],
  ])('rejects %s like the server: 400 VALIDATION_ERROR', async (_n, body) => {
    await expect(mock.createCase(body)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(await mock.listCases()).toEqual([]);
  });

  it('the premise message is the server wording', async () => {
    await expect(mock.createCase({ premise: 'short', difficulty: 'easy' })).rejects.toMatchObject({ message: 'Premise must be 10–300 characters.' });
  });

  it('every case gets its own id', async () => {
    const ids = await Promise.all([make(), make(), make(), make()].map((p) => p.then((c) => c.id)));
    expect(new Set(ids).size).toBe(4);
  });

  it('what the caller gets back is a copy: changing it cannot corrupt the store', async () => {
    const c = await make();
    c.title = 'HACKED';
    c.clues[0].discovered = true;
    c.suspects.length = 0;
    const again = await mock.getCase(c.id);
    expect(again.title).not.toBe('HACKED');
    expect(again.clues[0].discovered).toBe(false);
    expect(again.suspects).toHaveLength(3);
  });
});

describe('getCase', () => {
  it('returns the same public case', async () => {
    const c = await make();
    expect(await mock.getCase(c.id)).toEqual(c);
  });
  it('400 INVALID_ID for a malformed id, 404 CASE_NOT_FOUND for an unknown one', async () => {
    await expect(mock.getCase('nope')).rejects.toMatchObject({ status: 400, code: 'INVALID_ID' });
    await expect(mock.getCase(GHOST)).rejects.toMatchObject({ status: 404, code: 'CASE_NOT_FOUND' });
  });
});

describe('discoverClue', () => {
  it('reveals the clue and bumps progress', async () => {
    const c = await make();
    const r = await mock.discoverClue(c.id, 'c1');
    expect(r).toEqual({
      clue: { id: 'c1', title: c.clues[0].title, location: c.clues[0].location, discovered: true, description: expect.any(String) },
      progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 0, hintsTotal: 2 },
      alreadyDiscovered: false,
    });
    const after = await mock.getCase(c.id);
    expect(after.clues[0]).toMatchObject({ discovered: true, description: r.clue.description });
    expect(after.clues[1].description).toBeNull();
  });

  it('is idempotent', async () => {
    const c = await make();
    await mock.discoverClue(c.id, 'c2');
    const again = await mock.discoverClue(c.id, 'c2');
    expect(again.alreadyDiscovered).toBe(true);
    expect(again.progress.discoveredCount).toBe(1);
  });

  it('5 parallel requests for one clue: exactly one is the discovery', async () => {
    const c = await make();
    const rs = await Promise.all(Array.from({ length: 5 }, () => mock.discoverClue(c.id, 'c3')));
    expect(rs.filter((r) => !r.alreadyDiscovered)).toHaveLength(1);
    expect((await mock.getCase(c.id)).progress.discoveredCount).toBe(1);
  });

  it('errors: unknown clue 404, malformed clue 400, unknown case 404, bad case id 400', async () => {
    const c = await make();
    await expect(mock.discoverClue(c.id, 'c99')).rejects.toMatchObject({ status: 404, code: 'CLUE_NOT_FOUND' });
    await expect(mock.discoverClue(c.id, 'x1')).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    await expect(mock.discoverClue(GHOST, 'c1')).rejects.toMatchObject({ status: 404, code: 'CASE_NOT_FOUND' });
    await expect(mock.discoverClue('nope', 'c1')).rejects.toMatchObject({ status: 400, code: 'INVALID_ID' });
  });
});

describe('requestHint', () => {
  it('reveals hints in order until none are left', async () => {
    const c = await make('hard');
    for (let i = 0; i < 3; i++) {
      const r = await mock.requestHint(c.id);
      expect(r.hint.index).toBe(i);
      expect(r.hint.text).toEqual(expect.any(String));
      expect(r.progress).toMatchObject({ hintsUsed: i + 1, hintsTotal: 3 });
    }
    await expect(mock.requestHint(c.id)).rejects.toMatchObject({ status: 409, code: 'NO_HINTS_LEFT' });
    expect((await mock.getCase(c.id)).hints.revealed).toHaveLength(3);
  });

  it('6 parallel requests on easy: exactly 2 succeed', async () => {
    const c = await make('easy');
    const rs = await Promise.allSettled(Array.from({ length: 6 }, () => mock.requestHint(c.id)));
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(rs.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'NO_HINTS_LEFT')).toBe(true);
  });
});

describe('accuse and getResult', () => {
  it('result is locked until the accusation', async () => {
    const c = await make();
    await expect(mock.getResult(c.id)).rejects.toMatchObject({ status: 409, code: 'CASE_NOT_COMPLETED' });
  });

  it('correct accusation: verdict, culprit, explanation, key clues, score', async () => {
    const c = await make();
    await mock.discoverClue(c.id, 'c1');
    await mock.requestHint(c.id);
    const r = await mock.accuse(c.id, 's2');
    expect(r).toMatchObject({
      caseId: c.id, difficulty: 'easy', status: 'solved', verdict: 'correct', accused: { id: 's2' }, culprit: { id: 's2' },
      score: { base: 100, clueBonus: 5, hintPenalty: 10, total: 95 },
    });
    expect(r.explanation.length).toBeGreaterThan(50);
    expect(r.keyClues.find((k) => k.id === 'c1').found).toBe(true);
    expect(Object.keys(r).sort()).toEqual(Object.keys(RESULT_EXAMPLE).sort());
    expect(await mock.getResult(c.id)).toEqual(r);
    expect((await mock.getCase(c.id)).status).toBe('solved');
  });

  it('wrong accusation: incorrect, base 0, culprit still revealed, status failed', async () => {
    const c = await make('medium');
    for (const id of ['c1', 'c2', 'c3']) await mock.discoverClue(c.id, id);
    await mock.requestHint(c.id);
    const r = await mock.accuse(c.id, 's1');
    expect(r).toMatchObject({ verdict: 'incorrect', status: 'failed', accused: { id: 's1' }, culprit: { id: 's2' }, score: { base: 0, clueBonus: 15, hintPenalty: 10, total: 5 } });
    expect((await mock.getCase(c.id)).status).toBe('failed');
  });

  it('one accusation only; discover and hint are closed afterwards', async () => {
    const c = await make();
    await mock.accuse(c.id, 's1');
    await expect(mock.accuse(c.id, 's2')).rejects.toMatchObject({ status: 409, code: 'CASE_ALREADY_COMPLETED' });
    await expect(mock.discoverClue(c.id, 'c1')).rejects.toMatchObject({ status: 409, code: 'CASE_ALREADY_COMPLETED' });
    await expect(mock.requestHint(c.id)).rejects.toMatchObject({ status: 409, code: 'CASE_ALREADY_COMPLETED' });
    expect((await mock.getResult(c.id)).accused.id).toBe('s1');
  });

  it('5 simultaneous accusations: exactly one wins', async () => {
    const c = await make();
    const rs = await Promise.allSettled(['s1', 's2', 's3', 's1', 's2'].map((s) => mock.accuse(c.id, s)));
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rs.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'CASE_ALREADY_COMPLETED')).toBe(true);
  });

  it('unknown suspect 404, malformed suspect 400 (case stays active)', async () => {
    const c = await make();
    await expect(mock.accuse(c.id, 's9')).rejects.toMatchObject({ status: 404, code: 'SUSPECT_NOT_FOUND' });
    await expect(mock.accuse(c.id, 's4')).rejects.toMatchObject({ status: 404, code: 'SUSPECT_NOT_FOUND' }); // easy has s1..s3
    await expect(mock.accuse(c.id, 'x')).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    await expect(mock.accuse(c.id, { $ne: null })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect((await mock.getCase(c.id)).status).toBe('active');
  });

  it.each([
    ['A', 'easy', 3, 1, 's2'], ['B', 'medium', 7, 3, 's2'], ['C', 'hard', 9, 0, 's2'],
    ['D', 'hard', 0, 3, 's2'], ['E', 'easy', 3, 0, 's1'], ['F', 'medium', 1, 2, 's1'],
  ])('SPEC §8 case %s scores exactly like the server', async (_n, difficulty, clues, hints, suspect) => {
    const c = await make(difficulty);
    for (let i = 1; i <= clues; i++) await mock.discoverClue(c.id, `c${i}`);
    for (let i = 0; i < hints; i++) await mock.requestHint(c.id);
    const r = await mock.accuse(c.id, suspect);
    expect(r.score).toEqual(computeScore({ difficulty, correct: suspect === 's2', discoveredCount: clues, hintsUsed: hints }));
  });
});

describe('the mock is indistinguishable from the real server shapes', () => {
  const publicOf = (id) => json(toPublicCase(mock.__getDoc(id)));

  it.each(['easy', 'medium', 'hard'])('%s: fresh, mid-game and finished states equal the server serializers', async (d) => {
    const c = await make(d);
    expect(json(await mock.getCase(c.id))).toEqual(publicOf(c.id));

    await mock.discoverClue(c.id, 'c2');
    await mock.discoverClue(c.id, 'c4');
    await mock.requestHint(c.id);
    expect(json(await mock.getCase(c.id))).toEqual(publicOf(c.id));

    for (let i = 1; i <= SERVER[d].clues; i++) await mock.discoverClue(c.id, `c${i}`);
    for (let i = 1; i < SERVER[d].hints; i++) await mock.requestHint(c.id);
    expect(json(await mock.getCase(c.id))).toEqual(publicOf(c.id));

    const result = await mock.accuse(c.id, 's3');
    expect(json(result)).toEqual(json(toResult(mock.__getDoc(c.id))));
    expect(json(await mock.getCase(c.id))).toEqual(publicOf(c.id));
  });

  it('listCases equals the server summaries, newest first', async () => {
    const a = await make('easy');
    await new Promise((r) => setTimeout(r, 5));
    const b = await make('hard');
    await mock.accuse(a.id, 's2');
    const list = await mock.listCases();
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(json(list)).toEqual(json([b, a].map((x) => toCaseSummary(mock.__getDoc(x.id)))));
    expect(Object.keys(list[0]).sort()).toEqual(['createdAt', 'difficulty', 'id', 'score', 'status', 'title']);
    expect(list.find((x) => x.id === a.id).score).toBe(100); // easy, correct, no clues, no hints
    expect(list.find((x) => x.id === b.id).score).toBeNull(); // still active
  });
});

describe('health', () => {
  it('matches GET /api/health', async () => {
    const h = await mock.health();
    expect(h).toMatchObject({ ok: true, db: 'up' });
    expect(new Date(h.time).toISOString()).toBe(h.time);
  });
});

describe('latency', () => {
  it('defaults to a realistic delay: 800 ms normally, 2.5 s for generating a case', async () => {
    expect(mock.MOCK_LATENCY).toEqual({ default: 800, create: 2500 });
    mock.__setLatency(null);
    vi.useFakeTimers();

    let created = false;
    mock.createCase({ premise: PREMISE, difficulty: 'easy' }).then(() => { created = true; });
    await vi.advanceTimersByTimeAsync(2499);
    expect(created).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(created).toBe(true);

    let healthy = false;
    mock.health().then(() => { healthy = true; });
    await vi.advanceTimersByTimeAsync(799);
    expect(healthy).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(healthy).toBe(true);
  });
});

describe('persistence across page reloads (sessionStorage)', () => {
  it('a case survives a reload of the module', async () => {
    const c = await make();
    await mock.discoverClue(c.id, 'c1');
    vi.resetModules();
    const fresh = await import('./index.js');
    fresh.__setLatency(0);
    const after = await fresh.getCase(c.id);
    expect(after.clues[0].discovered).toBe(true);
    expect(await fresh.listCases()).toHaveLength(1);
  });

  it('corrupt storage is ignored, not fatal', async () => {
    window.sessionStorage.setItem('mr-mock-v1', '{not json');
    vi.resetModules();
    const fresh = await import('./index.js');
    fresh.__setLatency(0);
    expect(await fresh.listCases()).toEqual([]);
    expect((await fresh.createCase({ premise: PREMISE, difficulty: 'easy' })).status).toBe('active');
  });

  it('storage that throws (private mode) does not break the mock', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const c = await make();
    expect((await mock.getCase(c.id)).id).toBe(c.id);
    setItem.mockRestore();
  });

  it('__reset forgets everything', async () => {
    await make();
    mock.__reset();
    expect(await mock.listCases()).toEqual([]);
    expect(window.sessionStorage.getItem('mr-mock-v1')).toBeNull();
  });
});
