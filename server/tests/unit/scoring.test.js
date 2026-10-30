import { describe, expect, it } from 'vitest';
import { computeScore } from '../../src/services/scoring.js';

// SPEC §8 table, cases A-F
describe('computeScore', () => {
  it.each([
    ['A', 'easy', true, 3, 1, { base: 100, clueBonus: 15, hintPenalty: 10, total: 105 }],
    ['B', 'medium', true, 7, 3, { base: 150, clueBonus: 35, hintPenalty: 30, total: 155 }],
    ['C', 'hard', true, 9, 0, { base: 200, clueBonus: 45, hintPenalty: 0, total: 245 }],
    ['D', 'hard', true, 0, 3, { base: 200, clueBonus: 0, hintPenalty: 30, total: 170 }],
    ['E', 'easy', false, 3, 0, { base: 0, clueBonus: 15, hintPenalty: 0, total: 15 }],
    ['F', 'medium', false, 1, 2, { base: 0, clueBonus: 5, hintPenalty: 20, total: 0 }],
  ])('case %s: %s correct=%s clues=%i hints=%i', (_id, difficulty, correct, discoveredCount, hintsUsed, expected) => {
    expect(computeScore({ difficulty, correct, discoveredCount, hintsUsed })).toEqual(expected);
  });

  it('never goes below 0', () => {
    expect(computeScore({ difficulty: 'easy', correct: false, discoveredCount: 0, hintsUsed: 2 }).total).toBe(0);
  });

  it('throws on unknown difficulty', () => {
    expect(() => computeScore({ difficulty: 'extreme', correct: true, discoveredCount: 0, hintsUsed: 0 })).toThrow(/Unknown difficulty/);
  });
});
