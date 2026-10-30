import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

export const DANA = { id: 'u1', email: 'dana@example.com', displayName: 'Dana Detective' };

// A controllable sign-in service. `first` is who it reports as signed in at the start (null = nobody); `emit` plays the
// part of the service announcing a change later.
export function fakeBackend(first = null) {
  const subs = new Set();
  return {
    subs,
    emit: (user) => act(() => subs.forEach((cb) => cb(user))),
    subscribe: vi.fn((cb) => {
      subs.add(cb);
      queueMicrotask(() => { if (subs.has(cb)) cb(first); });
      return () => subs.delete(cb);
    }),
    signIn: vi.fn(async () => DANA),
    signUp: vi.fn(async () => DANA),
    signInWithGoogle: vi.fn(async () => DANA),
    signOut: vi.fn(async () => {}),
    resetPassword: vi.fn(async () => {}),
    getToken: vi.fn(async () => 'tok'),
  };
}

export const authError = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

// Renders `routes` (<Route> elements) inside a router, the toast area and the auth provider.
// `backend: undefined` = no sign-in service on this site; pass fakeBackend() for a working one.
export function renderAuth(routes, { path = '/', backend = null } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider loader={async () => backend}>{routes}</AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
