import { CLUE_POINTS, DIFFICULTY, HINT_PENALTY } from '../config/difficulty.js';

// The only place a score is ever computed (SPEC §8). Never accept a score from the client.
export function computeScore({ difficulty, correct, discoveredCount, hintsUsed }) {
  const cfg = DIFFICULTY[difficulty];
  if (!cfg) throw new Error(`Unknown difficulty ${difficulty}`);
  const base = correct ? cfg.base : 0;
  const clueBonus = CLUE_POINTS * discoveredCount;
  const hintPenalty = HINT_PENALTY * hintsUsed;
  return { base, clueBonus, hintPenalty, total: Math.max(0, base + clueBonus - hintPenalty) };
}
