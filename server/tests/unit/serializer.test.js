import { describe, expect, it } from 'vitest';
import { toCaseSummary, toProgress, toPublicCase, toPublicClue, toResult } from '../../src/serializers/case.serializer.js';
import { sampleCase, SECRET } from '../helpers/fixtures.js';

const active = (extra = {}) => ({
  _id: '6720c1f0a1b2c3d4e5f60718',
  ...sampleCase(),
  progress: { discoveredClueIds: ['c1'], hintsUsed: 1 },
  status: 'active',
  accusation: null,
  score: null,
  userId: null,
  ai: { provider: 'mock', model: 'm', attempts: 1, latencyMs: 9 },
  internalNote: 'INTERNAL_LEAK',
  createdAt: new Date('2026-10-31T10:00:00.000Z'),
  ...extra,
});
const completed = (suspectId, correct) => active({
  status: correct ? 'solved' : 'failed',
  accusation: { suspectId, correct, submittedAt: new Date('2026-10-31T10:12:00.000Z') },
  score: { base: correct ? 100 : 0, clueBonus: 5, hintPenalty: 10, total: correct ? 95 : 0 },
  completedAt: new Date('2026-10-31T10:12:00.000Z'),
});

describe('toPublicCase', () => {
  const json = JSON.stringify(toPublicCase(active()));

  it.each([
    'solution', 'culpritId', 'keyClueIds', 'explanation', SECRET,
    'CLUE2_TEXT', 'CLUE3_TEXT', 'CLUE4_TEXT', 'CLUE5_TEXT', 'HINT2_TEXT',
    'playerId', 'userId', 'accusation', '"ai"', 'INTERNAL_LEAK', 'latencyMs',
  ])('never contains %s', (secret) => {
    expect(json).not.toContain(secret);
  });

  it('contains the discovered clue and the used hint', () => {
    expect(json).toContain('CLUE1_TEXT');
    expect(json).toContain('HINT1_TEXT');
  });

  it('matches the SPEC §5.3 shape', () => {
    const c = toPublicCase(active());
    expect(Object.keys(c).sort()).toEqual([
      'clues', 'createdAt', 'crime', 'difficulty', 'hints', 'id', 'premise', 'progress', 'setting', 'status', 'story', 'suspects', 'title',
    ]);
    expect(c.id).toBe('6720c1f0a1b2c3d4e5f60718');
    expect(Object.keys(c.suspects[0]).sort()).toEqual(['alibi', 'description', 'id', 'motive', 'name', 'role']);
    expect(c.clues[0]).toEqual({ id: 'c1', title: 'Rosin smudge', location: 'Green room door', discovered: true, description: 'CLUE1_TEXT rosin on the handle.' });
    expect(c.clues[1]).toEqual({ id: 'c2', title: 'Torn ticket', location: 'Back stairwell', discovered: false, description: null });
    expect(c.hints).toEqual({ total: 2, used: 1, revealed: [{ index: 0, text: 'HINT1_TEXT look at the door.' }] });
    expect(c.progress).toEqual({ discoveredCount: 1, totalClues: 5, hintsUsed: 1, hintsTotal: 2 });
  });

  it('reveals nothing extra at zero progress', () => {
    const c = toPublicCase(active({ progress: { discoveredClueIds: [], hintsUsed: 0 } }));
    expect(c.hints.revealed).toEqual([]);
    expect(c.clues.every((x) => !x.discovered && x.description === null)).toBe(true);
  });
});

describe('toPublicClue / toProgress', () => {
  it('hides description when undiscovered', () => {
    expect(toPublicClue(sampleCase().clues[1], false).description).toBeNull();
    expect(toPublicClue(sampleCase().clues[1], true).description).toContain('CLUE2_TEXT');
  });
  it('counts progress', () => {
    expect(toProgress(active())).toEqual({ discoveredCount: 1, totalClues: 5, hintsUsed: 1, hintsTotal: 2 });
  });
});

describe('toResult', () => {
  it('throws on an active case', () => {
    expect(() => toResult(active())).toThrow(/active/);
  });

  it('throws when the solution was not selected', () => {
    const c = completed('s2', true);
    delete c.solution;
    expect(() => toResult(c)).toThrow(/solution/);
  });

  it('correct verdict, with culprit, explanation and key clue found flags', () => {
    const r = toResult(completed('s2', true));
    expect(r).toMatchObject({
      caseId: '6720c1f0a1b2c3d4e5f60718', difficulty: 'easy', status: 'solved', verdict: 'correct',
      accused: { id: 's2', name: 'Arjun Rao' },
      culprit: { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player' },
      score: { base: 100, clueBonus: 5, hintPenalty: 10, total: 95 },
      progress: { discoveredCount: 1, totalClues: 5, hintsUsed: 1, hintsTotal: 2 },
    });
    expect(r.explanation).toContain(SECRET);
    expect(r.keyClues).toEqual([{ id: 'c1', title: 'Rosin smudge', found: true }, { id: 'c5', title: 'Receipt', found: false }]);
    expect(JSON.stringify(r)).not.toMatch(/playerId|culpritId|INTERNAL_LEAK|"ai"/);
  });

  it('incorrect verdict names both accused and real culprit', () => {
    const r = toResult(completed('s1', false));
    expect(r.verdict).toBe('incorrect');
    expect(r.status).toBe('failed');
    expect(r.accused.name).toBe('Meera Iyer');
    expect(r.culprit.name).toBe('Arjun Rao');
  });
});

describe('toCaseSummary', () => {
  it('returns only list fields', () => {
    expect(toCaseSummary(active())).toEqual({
      id: '6720c1f0a1b2c3d4e5f60718', title: 'The Silent Sitar', difficulty: 'easy', status: 'active', score: null,
      createdAt: new Date('2026-10-31T10:00:00.000Z'),
    });
    expect(toCaseSummary(completed('s2', true)).score).toBe(95);
  });
});
