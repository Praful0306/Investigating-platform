// Picks the sign-in service: the pretend one in mock mode, Firebase when its settings are present, otherwise none
// (the site then works for guests only). Both services are loaded on demand, so neither is in the first download,
// and a production build contains no mock at all.
const useMock = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';
const KEYS = { apiKey: 'VITE_FIREBASE_API_KEY', authDomain: 'VITE_FIREBASE_AUTH_DOMAIN', projectId: 'VITE_FIREBASE_PROJECT_ID', appId: 'VITE_FIREBASE_APP_ID' };

// The four values are public (they ship in every Firebase web app). Any missing one means "sign-in is not set up".
export function firebaseConfig(env) {
  const config = {};
  for (const [field, key] of Object.entries(KEYS)) {
    const value = typeof env?.[key] === 'string' ? env[key].trim() : '';
    if (!value) return null;
    config[field] = value;
  }
  return config;
}

export async function loadBackend({ env = import.meta.env } = {}) {
  if (useMock) return (await import('./mockBackend.js')).createMockBackend();
  const config = firebaseConfig(env);
  if (!config) return null;
  return (await import('./firebaseBackend.js')).createFirebaseBackend(config);
}
