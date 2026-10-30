// The security boundary (SPEC §9). Every field sent to the client is whitelisted here.
// Never `res.json(doc)`; never spread a document into a response.

export function toProgress(c) {
  return {
    discoveredCount: c.progress.discoveredClueIds.length,
    totalClues: c.clues.length,
    hintsUsed: c.progress.hintsUsed,
    hintsTotal: c.hints.length,
  };
}

export function toPublicClue(clue, discovered) {
  return {
    id: clue.id,
    title: clue.title,
    location: clue.location,
    discovered,
    description: discovered ? clue.description : null,
  };
}

export function toPublicCase(c) {
  const found = new Set(c.progress.discoveredClueIds);
  return {
    id: String(c._id),
    title: c.title,
    premise: c.premise,
    difficulty: c.difficulty,
    setting: c.setting,
    crime: c.crime,
    story: c.story,
    suspects: c.suspects.map(({ id, name, role, description, motive, alibi }) => ({ id, name, role, description, motive, alibi })),
    clues: c.clues.map((cl) => toPublicClue(cl, found.has(cl.id))),
    hints: {
      total: c.hints.length,
      used: c.progress.hintsUsed,
      revealed: c.hints.slice(0, c.progress.hintsUsed).map((text, index) => ({ index, text })),
    },
    progress: toProgress(c),
    status: c.status,
    createdAt: c.createdAt,
  };
}

export function toResult(c) {
  if (c.status === 'active') throw new Error('toResult called on active case');
  if (!c.solution) throw new Error('toResult needs .select("+solution")');
  const found = new Set(c.progress.discoveredClueIds);
  const byId = Object.fromEntries(c.suspects.map((s) => [s.id, s]));
  const culprit = byId[c.solution.culpritId];
  const accused = byId[c.accusation.suspectId];
  return {
    caseId: String(c._id),
    title: c.title,
    difficulty: c.difficulty,
    status: c.status,
    verdict: c.accusation.correct ? 'correct' : 'incorrect',
    accused: { id: accused.id, name: accused.name },
    culprit: { id: culprit.id, name: culprit.name, role: culprit.role },
    explanation: c.solution.explanation,
    keyClues: c.solution.keyClueIds.map((id) => ({
      id,
      title: c.clues.find((x) => x.id === id)?.title ?? id,
      found: found.has(id),
    })),
    score: c.score,
    progress: toProgress(c),
    completedAt: c.completedAt,
  };
}

export function toCaseSummary(c) {
  return {
    id: String(c._id),
    title: c.title,
    difficulty: c.difficulty,
    status: c.status,
    score: c.score?.total ?? null,
    createdAt: c.createdAt,
  };
}
