import { http, toApiError } from './http.js';

// With VITE_USE_MOCK=true (or `vite --mode mock`) every call is answered in memory by ./mock, with the same shapes.
// The mock is loaded lazily, so a normal production build never downloads it.
const useMock = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';
const mock = () => import('./mock/index.js');
const id = encodeURIComponent;

async function call(config) {
  try {
    return (await http.request(config)).data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createCase({ premise, difficulty, turnstileToken }) {
  if (useMock) return (await mock()).createCase({ premise, difficulty });
  const data = { premise, difficulty, ...(turnstileToken && { turnstileToken }) };
  return (await call({ method: 'post', url: '/cases', data })).case;
}

export async function getCase(caseId) {
  if (useMock) return (await mock()).getCase(caseId);
  return (await call({ method: 'get', url: `/cases/${id(caseId)}` })).case;
}

// -> { clue, progress, alreadyDiscovered }
export async function discoverClue(caseId, clueId) {
  if (useMock) return (await mock()).discoverClue(caseId, clueId);
  return call({ method: 'post', url: `/cases/${id(caseId)}/clues/${id(clueId)}/discover` });
}

// -> { hint: { index, text }, progress }
export async function requestHint(caseId) {
  if (useMock) return (await mock()).requestHint(caseId);
  return call({ method: 'post', url: `/cases/${id(caseId)}/hints` });
}

export async function accuse(caseId, suspectId) {
  if (useMock) return (await mock()).accuse(caseId, suspectId);
  return (await call({ method: 'post', url: `/cases/${id(caseId)}/accuse`, data: { suspectId } })).result;
}

export async function getResult(caseId) {
  if (useMock) return (await mock()).getResult(caseId);
  return (await call({ method: 'get', url: `/cases/${id(caseId)}/result` })).result;
}

export async function listCases() {
  if (useMock) return (await mock()).listCases();
  return (await call({ method: 'get', url: '/cases' })).cases;
}

export async function health() {
  if (useMock) return (await mock()).health();
  return call({ method: 'get', url: '/health' });
}
