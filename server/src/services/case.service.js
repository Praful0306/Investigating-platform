import { Case } from '../models/Case.js';
import { AppError } from '../utils/app-error.js';
import { computeScore } from './scoring.js';

export async function createCase({ ai, premise, difficulty, playerId, userId }) {
  // Generate first: if the AI fails nothing is saved.
  const { data, meta } = await ai.generateCase({ premise, difficulty });
  return Case.create({ ...data, premise, difficulty, playerId, userId: userId ?? null, ai: meta });
}

// A case is readable/playable only by the player cookie or the logged-in user that owns it (SPEC §5.1).
export async function loadOwned(id, { playerId, user }, { withSolution = false } = {}) {
  const query = Case.findById(id);
  const doc = await (withSolution ? query.select('+solution') : query);
  if (!doc) throw new AppError('CASE_NOT_FOUND', 404, 'Case not found.');
  const mine = doc.playerId === playerId || (user && doc.userId && String(doc.userId) === user.id);
  if (!mine) throw new AppError('FORBIDDEN', 403, 'This case belongs to another detective.');
  return doc;
}

export function listCases({ playerId, user }) {
  return Case.find(user ? { userId: user.id } : { playerId }).sort({ createdAt: -1 }).limit(50).lean();
}

// ---------------------------------------------------------------- gameplay
// Every state change is ONE guarded findOneAndUpdate (SPEC §9.7): never read-modify-save. When a guarded update
// matches nothing, the case is re-read to report the real reason.

const notFound = () => new AppError('CASE_NOT_FOUND', 404, 'Case not found.');
const closed = () => new AppError('CASE_ALREADY_COMPLETED', 409, 'This case is already closed.');

// Filtering on "clue not found yet" (instead of a bare $addToSet) tells us which request really discovered it.
export async function discoverClue(id, clueId, req) {
  const doc = await loadOwned(id, req);
  const clue = doc.clues.find((c) => c.id === clueId);
  if (!clue) throw new AppError('CLUE_NOT_FOUND', 404, 'Clue not found.');

  const updated = await Case.findOneAndUpdate(
    { _id: id, status: 'active', 'clues.id': clueId, 'progress.discoveredClueIds': { $ne: clueId } },
    { $addToSet: { 'progress.discoveredClueIds': clueId } },
    { new: true },
  );
  if (updated) return { doc: updated, clue, alreadyDiscovered: false };

  const now = await Case.findById(id);
  if (!now) throw notFound();
  if (now.status !== 'active') throw closed();
  return { doc: now, clue, alreadyDiscovered: true };
}

export async function takeHint(id, req) {
  const doc = await loadOwned(id, req);
  const updated = await Case.findOneAndUpdate(
    { _id: id, status: 'active', 'progress.hintsUsed': { $lt: doc.hints.length } },
    { $inc: { 'progress.hintsUsed': 1 } },
    { new: true },
  );
  if (updated) {
    const index = updated.progress.hintsUsed - 1;
    return { doc: updated, hint: { index, text: updated.hints[index] } };
  }

  const now = await Case.findById(id);
  if (!now) throw notFound();
  if (now.status !== 'active') throw closed();
  throw new AppError('NO_HINTS_LEFT', 409, 'No hints left.');
}

// Progress can only grow (at most clues + hints times), so a retry loop always ends; 15 > 9 + 3 + 1.
const MAX_ACCUSE_ATTEMPTS = 15;

export async function accuse(id, suspectId, req) {
  for (let attempt = 0; attempt < MAX_ACCUSE_ATTEMPTS; attempt++) {
    const doc = await loadOwned(id, req, { withSolution: true });
    if (doc.status !== 'active') throw closed();
    if (!doc.suspects.some((s) => s.id === suspectId)) throw new AppError('SUSPECT_NOT_FOUND', 404, 'Suspect not found.');

    const discoveredCount = doc.progress.discoveredClueIds.length;
    const hintsUsed = doc.progress.hintsUsed;
    const correct = suspectId === doc.solution.culpritId;
    const score = computeScore({ difficulty: doc.difficulty, correct, discoveredCount, hintsUsed });
    const submittedAt = new Date();

    // Guarded on the exact progress we scored: a hint or clue that slipped in meanwhile makes this miss, and we rescore.
    const updated = await Case.findOneAndUpdate(
      { _id: id, status: 'active', 'progress.hintsUsed': hintsUsed, 'progress.discoveredClueIds': { $size: discoveredCount } },
      { $set: { status: correct ? 'solved' : 'failed', accusation: { suspectId, correct, submittedAt }, score, completedAt: submittedAt } },
      { new: true },
    ).select('+solution');
    if (updated) return updated;
  }
  throw new Error(`accuse: progress kept changing for case ${id}`); // unreachable in practice
}

export async function getResult(id, req) {
  const doc = await loadOwned(id, req, { withSolution: true });
  if (doc.status === 'active') throw new AppError('CASE_NOT_COMPLETED', 409, 'Accuse a suspect first to see the result.');
  return doc;
}
