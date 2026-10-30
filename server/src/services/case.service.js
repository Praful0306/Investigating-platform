import { Case } from '../models/Case.js';
import { AppError } from '../utils/app-error.js';

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
