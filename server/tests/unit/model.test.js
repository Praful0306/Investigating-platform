import { describe, expect, it } from 'vitest';
import { Case } from '../../src/models/Case.js';
import { sampleCase, SECRET } from '../helpers/fixtures.js';
import { useMemoryDb } from '../helpers/db.js';

useMemoryDb();

describe('Case model', () => {
  it('hides solution and ai unless explicitly selected', async () => {
    const { _id } = await Case.create({ ...sampleCase(), ai: { provider: 'mock', model: 'm', attempts: 1, latencyMs: 5 } });
    const plain = await Case.findById(_id);
    expect(plain.solution).toBeUndefined();
    expect(plain.ai).toBeUndefined();
    const full = await Case.findById(_id).select('+solution +ai');
    expect(full.solution.culpritId).toBe('s2');
    expect(full.ai.provider).toBe('mock');
  });

  it('JSON.stringify never includes solution or ai, even when loaded', async () => {
    const { _id } = await Case.create({ ...sampleCase(), ai: { provider: 'mock', model: 'm', attempts: 1, latencyMs: 5 } });
    const full = await Case.findById(_id).select('+solution +ai');
    const json = JSON.stringify(full);
    expect(json).not.toContain('solution');
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain('"ai"');
  });

  it('applies defaults', async () => {
    const c = await Case.create(sampleCase());
    expect(c.status).toBe('active');
    expect(c.progress.discoveredClueIds).toEqual([]);
    expect(c.progress.hintsUsed).toBe(0);
    expect(c.accusation).toBeNull();
    expect(c.score).toBeNull();
    expect(c.userId).toBeNull();
  });

  it.each([
    ['difficulty extreme', { difficulty: 'extreme' }],
    ['premise too short', { premise: 'short' }],
    ['bad suspect id', { suspects: [{ ...sampleCase().suspects[0], id: 'x1' }] }],
    ['bad clue id', { clues: [{ ...sampleCase().clues[0], id: 'clue-1' }] }],
    ['missing playerId', { playerId: undefined }],
    ['missing solution', { solution: undefined }],
    ['bad status', { status: 'won' }],
  ])('rejects %s', async (_name, patch) => {
    await expect(new Case(sampleCase(patch)).validate()).rejects.toThrow();
  });
});

describe('Case.userId', () => {
  it('holds a Firebase uid as a plain string, and defaults to null for guests', async () => {
    const uid = 'xT3kLm9Qe2Zr8PvB0aYhWcNd5uG1';
    const owned = await Case.create({ ...sampleCase(), userId: uid });
    expect((await Case.findById(owned._id)).userId).toBe(uid);
    const guest = await Case.create(sampleCase());
    expect((await Case.findById(guest._id)).userId).toBeNull();
  });
});
