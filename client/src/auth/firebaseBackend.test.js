import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real SDK is replaced by a stand-in that records calls: these tests check OUR wiring, not Firebase.
const state = vi.hoisted(() => ({ currentUser: null, listeners: [] }));
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
  initializeApp: vi.fn((cfg) => ({ cfg })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => state),
  onAuthStateChanged: vi.fn((_auth, cb) => { state.listeners.push(cb); return () => { state.listeners = state.listeners.filter((l) => l !== cb); }; }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class { constructor() { this.kind = 'google'; } },
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const app = await import('firebase/app');
const fb = await import('firebase/auth');
const { createFirebaseBackend } = await import('./firebaseBackend.js');

const CONFIG = { apiKey: 'k', authDomain: 'd.firebaseapp.com', projectId: 'p', appId: 'a' };
const fbUser = (over = {}) => ({ uid: 'u1', email: 'dana@example.com', displayName: 'Dana', getIdToken: vi.fn().mockResolvedValue('id-token-1'), ...over });

beforeEach(() => {
  vi.clearAllMocks();
  state.currentUser = null;
  state.listeners = [];
  app.getApps.mockReturnValue([]);
});

describe('createFirebaseBackend', () => {
  it('starts the app once with the config, and reuses it the second time', async () => {
    await createFirebaseBackend(CONFIG);
    expect(app.initializeApp).toHaveBeenCalledWith(CONFIG);
    app.getApps.mockReturnValue([{}]);
    await createFirebaseBackend(CONFIG);
    expect(app.initializeApp).toHaveBeenCalledTimes(1);
    expect(app.getApp).toHaveBeenCalled();
  });

  it('subscribe passes on a plain { id, email, displayName } (no SDK object), and null when signed out', async () => {
    const b = await createFirebaseBackend(CONFIG);
    const seen = vi.fn();
    b.subscribe(seen);
    state.listeners[0](fbUser({ photoURL: 'x', stsTokenManager: { refreshToken: 'SECRET' } }));
    expect(seen).toHaveBeenLastCalledWith({ id: 'u1', email: 'dana@example.com', displayName: 'Dana' });
    state.listeners[0](null);
    expect(seen).toHaveBeenLastCalledWith(null);
  });

  it('a user with no display name is shown by the first part of their email', async () => {
    const b = await createFirebaseBackend(CONFIG);
    const seen = vi.fn();
    b.subscribe(seen);
    state.listeners[0](fbUser({ displayName: null, email: 'maya.rao@example.com' }));
    expect(seen.mock.calls[0][0].displayName).toBe('maya.rao');
    state.listeners[0](fbUser({ displayName: null, email: null }));
    expect(seen.mock.calls[1][0].displayName).toBe('Detective');
  });

  it('unsubscribe really unsubscribes', async () => {
    const b = await createFirebaseBackend(CONFIG);
    const stop = b.subscribe(() => {});
    expect(state.listeners).toHaveLength(1);
    stop();
    expect(state.listeners).toHaveLength(0);
  });

  it('signIn calls Firebase with the email and password and returns the plain user', async () => {
    fb.signInWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    const b = await createFirebaseBackend(CONFIG);
    const user = await b.signIn({ email: 'dana@example.com', password: 'pw-pw-pw' });
    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(state, 'dana@example.com', 'pw-pw-pw');
    expect(user).toEqual({ id: 'u1', email: 'dana@example.com', displayName: 'Dana' });
  });

  it('signUp creates the account, then saves the name on it, and returns the user WITH that name', async () => {
    const created = fbUser({ displayName: null });
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user: created });
    fb.updateProfile.mockImplementation(async (u, { displayName }) => { u.displayName = displayName; });
    const b = await createFirebaseBackend(CONFIG);
    const user = await b.signUp({ name: 'Dana Detective', email: 'dana@example.com', password: 'pw-pw-pw' });
    expect(fb.createUserWithEmailAndPassword).toHaveBeenCalledWith(state, 'dana@example.com', 'pw-pw-pw');
    expect(fb.updateProfile).toHaveBeenCalledWith(created, { displayName: 'Dana Detective' });
    expect(user.displayName).toBe('Dana Detective');
  });

  it('signUp still succeeds when saving the name fails (the account exists; the name is a nicety)', async () => {
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user: fbUser({ displayName: null }) });
    fb.updateProfile.mockRejectedValue(new Error('offline'));
    const b = await createFirebaseBackend(CONFIG);
    await expect(b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'pw-pw-pw' })).resolves.toMatchObject({ id: 'u1' });
  });

  it('a failed signUp never saves a name', async () => {
    fb.createUserWithEmailAndPassword.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));
    const b = await createFirebaseBackend(CONFIG);
    await expect(b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'pw-pw-pw' })).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(fb.updateProfile).not.toHaveBeenCalled();
  });

  it('signInWithGoogle opens the Google popup', async () => {
    fb.signInWithPopup.mockResolvedValue({ user: fbUser() });
    const b = await createFirebaseBackend(CONFIG);
    await b.signInWithGoogle();
    expect(fb.signInWithPopup.mock.calls[0][1]).toMatchObject({ kind: 'google' });
  });

  it('signOut and resetPassword call Firebase', async () => {
    const b = await createFirebaseBackend(CONFIG);
    await b.signOut();
    expect(fb.signOut).toHaveBeenCalledWith(state);
    await b.resetPassword('dana@example.com');
    expect(fb.sendPasswordResetEmail).toHaveBeenCalledWith(state, 'dana@example.com');
  });

  it('getToken is the current user\'s ID token, or null when signed out', async () => {
    const b = await createFirebaseBackend(CONFIG);
    expect(await b.getToken()).toBeNull();
    state.currentUser = fbUser();
    expect(await b.getToken()).toBe('id-token-1');
  });

  it('getToken never fails a request: if the token cannot be fetched it is null', async () => {
    const b = await createFirebaseBackend(CONFIG);
    state.currentUser = fbUser({ getIdToken: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(await b.getToken()).toBeNull();
  });
});
