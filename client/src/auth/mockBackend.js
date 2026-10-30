// A pretend sign-in service with the same shape as the Firebase one (see firebaseBackend.js), so the whole app can be
// run and tested without a Firebase project: `npm run dev:mock`. Accounts live in sessionStorage. This file is only
// ever loaded in mock mode, never in a production build.
const KEY = 'mr-mock-auth';
const DEMO = Object.freeze({ id: 'mock-google-demo', email: 'demo@example.com', displayName: 'Demo Detective' });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (code) => Object.assign(new Error(code), { code });
const pause = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

function read() {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(KEY));
    return { users: Array.isArray(data?.users) ? data.users : [], current: typeof data?.current === 'string' ? data.current : null };
  } catch {
    return { users: [], current: null };
  }
}
function write(state) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage blocked: the pretend account just lasts until the page reloads */ }
}

const publicUser = (u) => (u ? { id: u.id, email: u.email, displayName: u.displayName } : null);

export function createMockBackend({ latency = 600 } = {}) {
  const listeners = new Set();
  const current = () => {
    const { users, current: id } = read();
    return publicUser(users.find((u) => u.id === id));
  };
  const notify = () => listeners.forEach((fn) => fn(current()));

  function startSession(user) {
    const state = read();
    if (!state.users.some((u) => u.id === user.id)) state.users.push(user);
    state.current = user.id;
    write(state);
    notify();
    return publicUser(user);
  }

  return {
    subscribe(cb) {
      listeners.add(cb);
      queueMicrotask(() => { if (listeners.has(cb)) cb(current()); });
      return () => listeners.delete(cb);
    },

    async signUp({ name, email, password }) {
      await pause(latency);
      const mail = String(email).trim().toLowerCase();
      if (!EMAIL.test(mail)) throw fail('auth/invalid-email');
      if (String(password).length < 6) throw fail('auth/weak-password');
      if (read().users.some((u) => u.email === mail)) throw fail('auth/email-already-in-use');
      const id = `mock-${Math.random().toString(36).slice(2, 10)}`;
      return startSession({ id, email: mail, displayName: String(name).trim(), password });
    },

    async signIn({ email, password }) {
      await pause(latency);
      const mail = String(email).trim().toLowerCase();
      if (!EMAIL.test(mail)) throw fail('auth/invalid-email');
      const user = read().users.find((u) => u.email === mail);
      if (!user || user.password !== password) throw fail('auth/invalid-credential');
      return startSession(user);
    },

    async signInWithGoogle() {
      await pause(latency);
      return startSession({ ...DEMO });
    },

    async signOut() {
      const state = read();
      state.current = null;
      write(state);
      notify();
    },

    async resetPassword(email) {
      await pause(latency);
      if (!EMAIL.test(String(email).trim())) throw fail('auth/invalid-email');
    },

    async getToken() {
      const user = current();
      return user ? `mock-token:${user.id}` : null;
    },
  };
}
