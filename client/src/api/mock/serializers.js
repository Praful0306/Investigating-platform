// What the server's serializers (server/src/serializers/case.serializer.js) would send, rebuilt for the mock.
// mock.test.js compares these field-for-field with the real server code, so the two cannot drift apart.

export function toProgress(doc) {
  return {
    discoveredCount: doc.progress.discoveredClueIds.length,
    totalClues: doc.clues.length,
    hintsUsed: doc.progress.hintsUsed,
    hintsTotal: doc.hints.length,
  };
}

export function toPublicClue(clue, discovered) {
  return { id: clue.id, title: clue.title, location: clue.location, discovered, description: discovered ? clue.description : null };
}

export function toPublic(doc) {
  const found = new Set(doc.progress.discoveredClueIds);
  return {
    id: String(doc._id),
    title: doc.title,
    premise: doc.premise,
    difficulty: doc.difficulty,
    setting: doc.setting,
    crime: doc.crime,
    story: doc.story,
    suspects: doc.suspects.map(({ id, name, role, description, motive, alibi }) => ({ id, name, role, description, motive, alibi })),
    clues: doc.clues.map((c) => toPublicClue(c, found.has(c.id))),
    hints: {
      total: doc.hints.length,
      used: doc.progress.hintsUsed,
      revealed: doc.hints.slice(0, doc.progress.hintsUsed).map((text, index) => ({ index, text })),
    },
    progress: toProgress(doc),
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export function toResult(doc) {
  const found = new Set(doc.progress.discoveredClueIds);
  const byId = Object.fromEntries(doc.suspects.map((s) => [s.id, s]));
  const culprit = byId[doc.solution.culpritId];
  const accused = byId[doc.accusation.suspectId];
  return {
    caseId: String(doc._id),
    title: doc.title,
    difficulty: doc.difficulty,
    status: doc.status,
    verdict: doc.accusation.correct ? 'correct' : 'incorrect',
    accused: { id: accused.id, name: accused.name },
    culprit: { id: culprit.id, name: culprit.name, role: culprit.role },
    explanation: doc.solution.explanation,
    keyClues: doc.solution.keyClueIds.map((id) => ({
      id,
      title: doc.clues.find((c) => c.id === id)?.title ?? id,
      found: found.has(id),
    })),
    score: doc.score,
    progress: toProgress(doc),
    completedAt: doc.completedAt,
  };
}

export function toSummary(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    difficulty: doc.difficulty,
    status: doc.status,
    score: doc.score?.total ?? null,
    createdAt: doc.createdAt,
  };
}
