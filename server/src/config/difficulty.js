export const DIFFICULTY = Object.freeze({
  easy: { suspects: 3, clues: 5, hints: 2, base: 100, minKeyClues: 2 },
  medium: { suspects: 4, clues: 7, hints: 3, base: 150, minKeyClues: 3 },
  hard: { suspects: 5, clues: 9, hints: 3, base: 200, minKeyClues: 3 },
});
export const CLUE_POINTS = 5;
export const HINT_PENALTY = 10;
