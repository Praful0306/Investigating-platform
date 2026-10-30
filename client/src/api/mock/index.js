// In-memory stand-in for the whole backend (SPEC §5), so the frontend can be built and demoed with no server.
// Same function names, same return shapes, same error codes. State lives in sessionStorage so a page reload keeps the game.
// The score logic below mirrors the server on purpose; the real score always comes from the server in production.
import { CLUE_POINTS, DIFFICULTY, HINT_PENALTY } from '../../config/difficulty.js';
import { buildMockCase } from './fixtures.js';
import { toProgress, toPublic, toPublicClue, toResult, toSummary } from './serializers.js';

const KEY = 'mr-mock-v1';
export const MOCK_LATENCY = Object.freeze({ default: 800, create: 2500 });

let latencyOverride = null; // null = realistic delays; a number = fixed (tests use 0)
export const __setLatency = (ms) => { latencyOverride = ms; };

const wait = (kind) =>
  new Promise((resolve) => {
    const ms = latencyOverride ?? MOCK_LATENCY[kind] ?? MOCK_LATENCY.default;
    if (ms > 0) setTimeout(resolve, ms);
    else resolve();
  });

// ---- storage (never allowed to break the mock: private mode, quota, corrupt JSON) ----
function load() {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]');
    return new Map(Array.isArray(raw) ? raw.filter((d) => d && typeof d._id === 'string').map((d) => [d._id, d]) : []);
  } catch {
    return new Map();
  }
}
const docs = load();
function save() {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...docs.values()]));
  } catch {
    /* in-memory only */
  }
}
export function __reset() {
  docs.clear();
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
export const __getDoc = (id) => docs.get(id);

// ---- errors: plain { status, code, message }, exactly what api/http.js toApiError produces ----
const fail = (status, code, message) => { throw { status, code, message }; };
const notFound = () => fail(404, 'CASE_NOT_FOUND', 'Case not found.');
const closed = () => fail(409, 'CASE_ALREADY_COMPLETED', 'This case is already closed.');

const randomHex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
const checkId = (id) => { if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) fail(400, 'INVALID_ID', 'Invalid case id.'); };
const find = (id) => docs.get(id) ?? notFound();

// same normalisation as the server's sanitizePremise
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const cleanPremise = (text) => text.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().replace(/"{3,}/g, '"');

// ---- the API ----
export async function createCase({ premise, difficulty } = {}) {
  const text = typeof premise === 'string' ? cleanPremise(premise) : '';
  if (typeof premise !== 'string' || text.length < 10 || text.length > 300) fail(400, 'VALIDATION_ERROR', 'Premise must be 10–300 characters.');
  if (!DIFFICULTY[difficulty]) fail(400, 'VALIDATION_ERROR', 'Difficulty must be easy, medium or hard.');
  await wait('create');
  const doc = {
    _id: randomHex(12),
    ...buildMockCase(difficulty),
    premise: text,
    difficulty,
    progress: { discoveredClueIds: [], hintsUsed: 0 },
    status: 'active',
    accusation: null,
    score: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  docs.set(doc._id, doc);
  save();
  return toPublic(doc);
}

export async function getCase(id) {
  checkId(id);
  await wait();
  return toPublic(find(id));
}

export async function discoverClue(id, clueId) {
  checkId(id);
  if (typeof clueId !== 'string' || !/^c\d{1,2}$/.test(clueId)) fail(400, 'VALIDATION_ERROR', 'Invalid clue id');
  await wait();
  // everything from here is synchronous, so concurrent calls cannot interleave (like the server's guarded updates)
  const doc = find(id);
  const clue = doc.clues.find((c) => c.id === clueId) ?? fail(404, 'CLUE_NOT_FOUND', 'Clue not found.');
  if (doc.status !== 'active') closed();
  const already = doc.progress.discoveredClueIds.includes(clueId);
  if (!already) {
    doc.progress.discoveredClueIds.push(clueId);
    save();
  }
  return { clue: toPublicClue(clue, true), progress: toProgress(doc), alreadyDiscovered: already };
}

export async function requestHint(id) {
  checkId(id);
  await wait();
  const doc = find(id);
  if (doc.status !== 'active') closed();
  if (doc.progress.hintsUsed >= doc.hints.length) fail(409, 'NO_HINTS_LEFT', 'No hints left.');
  const index = doc.progress.hintsUsed;
  doc.progress.hintsUsed += 1;
  save();
  return { hint: { index, text: doc.hints[index] }, progress: toProgress(doc) };
}

export async function accuse(id, suspectId) {
  checkId(id);
  if (typeof suspectId !== 'string' || !/^s\d$/.test(suspectId)) fail(400, 'VALIDATION_ERROR', 'Invalid suspect id');
  await wait();
  const doc = find(id);
  if (doc.status !== 'active') closed();
  if (!doc.suspects.some((s) => s.id === suspectId)) fail(404, 'SUSPECT_NOT_FOUND', 'Suspect not found.');

  const correct = suspectId === doc.solution.culpritId;
  const clueBonus = CLUE_POINTS * doc.progress.discoveredClueIds.length;
  const hintPenalty = HINT_PENALTY * doc.progress.hintsUsed;
  const base = correct ? DIFFICULTY[doc.difficulty].points : 0;
  const submittedAt = new Date().toISOString();
  doc.status = correct ? 'solved' : 'failed';
  doc.accusation = { suspectId, correct, submittedAt };
  doc.score = { base, clueBonus, hintPenalty, total: Math.max(0, base + clueBonus - hintPenalty) };
  doc.completedAt = submittedAt;
  save();
  return toResult(doc);
}

export async function getResult(id) {
  checkId(id);
  await wait();
  const doc = find(id);
  if (doc.status === 'active') fail(409, 'CASE_NOT_COMPLETED', 'Accuse a suspect first to see the result.');
  return toResult(doc);
}

export async function listCases() {
  await wait();
  return [...docs.values()].reverse().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).map(toSummary).slice(0, 50);
}

export async function startSession() {
  await wait();
  return { user: { id: 'mock-user', email: null, displayName: 'Mock detective' }, claimed: 0 };
}

export async function health() {
  await wait();
  return { ok: true, db: 'up', time: new Date().toISOString() };
}
