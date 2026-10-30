// DISPLAY COPY of SPEC §7.1. The server file (server/src/config/difficulty.js) is the single source of truth;
// difficulty.test.js fails if these numbers ever drift from it.
export const DIFFICULTY_ORDER = Object.freeze(['easy', 'medium', 'hard']);

export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ label: 'Easy', suspects: 3, clues: 5, hints: 2, points: 100, blurb: 'A gentle first case. The key clues point fairly directly.' }),
  medium: Object.freeze({ label: 'Medium', suspects: 4, clues: 7, hints: 3, points: 150, blurb: 'More suspects, more noise. Read the alibis twice.' }),
  hard: Object.freeze({ label: 'Hard', suspects: 5, clues: 9, hints: 3, points: 200, blurb: 'Red herrings, and a culprit whose alibi looks airtight.' }),
});

export const CLUE_POINTS = 5;
export const HINT_PENALTY = 10;

// A PREVIEW only ("if you accuse correctly now"). The server computes the real score; this is never sent to it.
export function previewScore({ difficulty, discoveredCount, hintsUsed }) {
  const cfg = DIFFICULTY[difficulty];
  if (!cfg) return 0;
  return Math.max(0, cfg.points + CLUE_POINTS * discoveredCount - HINT_PENALTY * hintsUsed);
}
