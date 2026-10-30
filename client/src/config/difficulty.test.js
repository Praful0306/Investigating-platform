import { describe, expect, it } from 'vitest';
import { CLUE_POINTS, DIFFICULTY, DIFFICULTY_ORDER, HINT_PENALTY, previewScore } from './difficulty.js';
// The server file is the single source of truth (SPEC §7.1). This copy is for display only, and this test keeps it honest.
import { CLUE_POINTS as SERVER_CLUE_POINTS, DIFFICULTY as SERVER, HINT_PENALTY as SERVER_HINT_PENALTY } from '../../../server/src/config/difficulty.js';
import { computeScore } from '../../../server/src/services/scoring.js';

describe('client difficulty copy', () => {
  it('lists easy, medium, hard in that order', () => {
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'medium', 'hard']);
  });

  it.each(['easy', 'medium', 'hard'])('%s matches the server table (suspects, clues, hints, points)', (d) => {
    expect(DIFFICULTY[d]).toMatchObject({
      suspects: SERVER[d].suspects,
      clues: SERVER[d].clues,
      hints: SERVER[d].hints,
      points: SERVER[d].base,
    });
    expect(DIFFICULTY[d].label).toBe(d[0].toUpperCase() + d.slice(1));
    expect(DIFFICULTY[d].blurb.length).toBeGreaterThan(10);
  });

  it('scoring constants match the server', () => {
    expect(CLUE_POINTS).toBe(SERVER_CLUE_POINTS);
    expect(HINT_PENALTY).toBe(SERVER_HINT_PENALTY);
  });
});

describe('previewScore (display only, "if you accuse correctly now")', () => {
  it.each([
    ['easy', 3, 1], ['medium', 7, 3], ['hard', 9, 0], ['hard', 0, 3], ['easy', 0, 0], ['medium', 1, 3],
  ])('%s with %i clues and %i hints equals the server score for a correct accusation', (difficulty, discoveredCount, hintsUsed) => {
    const server = computeScore({ difficulty, correct: true, discoveredCount, hintsUsed }).total;
    expect(previewScore({ difficulty, discoveredCount, hintsUsed })).toBe(server);
  });

  it('is never negative', () => {
    expect(previewScore({ difficulty: 'easy', discoveredCount: 0, hintsUsed: 50 })).toBe(0);
  });

  it('copes with an unknown difficulty by returning 0', () => {
    expect(previewScore({ difficulty: 'extreme', discoveredCount: 1, hintsUsed: 0 })).toBe(0);
  });
});
