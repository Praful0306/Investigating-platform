import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebaseBackend.js', () => ({ createFirebaseBackend: vi.fn(async (config) => ({ kind: 'firebase', config })) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = async () => import('./backend.js');
const FULL = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' };

describe('firebaseConfig', () => {
  it('reads the four public values from the environment', async () => {
    const { firebaseConfig } = await load();
    expect(firebaseConfig(FULL)).toEqual({ apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' });
  });

  it('trims the values', async () => {
    const { firebaseConfig } = await load();
    expect(firebaseConfig({ ...FULL, VITE_FIREBASE_API_KEY: '  k  ' }).apiKey).toBe('k');
  });

  it.each([
    ['nothing set', {}],
    ['one missing', { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_PROJECT_ID: 'p' }],
    ['empty values', { VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_AUTH_DOMAIN: '', VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_APP_ID: '' }],
    ['blank values', { ...FULL, VITE_FIREBASE_API_KEY: ' ' }],
    ['values that are not text', { ...FULL, VITE_FIREBASE_APP_ID: true }],
  ])('is null (sign-in off) when %s', async (_name, env) => {
    const { firebaseConfig } = await load();
    expect(firebaseConfig(env)).toBeNull();
  });
});

describe('loadBackend', () => {
  it('mock mode gives the pretend sign-in service', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');
    const { loadBackend } = await load();
    const backend = await loadBackend({ env: {} });
    expect(Object.keys(backend).sort()).toEqual(['getToken', 'resetPassword', 'signIn', 'signInWithGoogle', 'signOut', 'signUp', 'subscribe']);
    const fb = await import('./firebaseBackend.js');
    expect(fb.createFirebaseBackend).not.toHaveBeenCalled();
  });

  it('without the mock and without Firebase settings there is no sign-in (null)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { loadBackend } = await load();
    expect(await loadBackend({ env: {} })).toBeNull();
  });

  it('with Firebase settings it starts Firebase with exactly those settings', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { loadBackend } = await load();
    const backend = await loadBackend({ env: FULL });
    expect(backend).toEqual({ kind: 'firebase', config: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' } });
  });

  it('half-filled Firebase settings count as not set up (no half-working sign-in)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { loadBackend } = await load();
    expect(await loadBackend({ env: { ...FULL, VITE_FIREBASE_PROJECT_ID: '' } })).toBeNull();
  });
});
