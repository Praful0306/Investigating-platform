import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { useAuth } from './useAuth.js';

vi.mock('../api/cases.js', () => ({ startSession: vi.fn() }));
vi.mock('../api/http.js', () => ({ setAuthTokenProvider: vi.fn() }));
const { startSession } = await import('../api/cases.js');
const { setAuthTokenProvider } = await import('../api/http.js');

const DANA = { id: 'u1', email: 'dana@example.com', displayName: 'Dana' };
const OMAR = { id: 'u2', email: 'omar@example.com', displayName: 'Omar' };

// a controllable sign-in service: `emit` plays the part of Firebase telling the app who is signed in
function fakeBackend(first = null) {
  const subs = new Set();
  const b = {
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
    getToken: vi.fn(async () => 'tok-1'),
  };
  return b;
}

const setup = (backend, { strict = false } = {}) => {
  const loader = vi.fn(async () => backend);
  const Wrap = ({ children }) => {
    const tree = <ToastProvider><AuthProvider loader={loader}>{children}</AuthProvider></ToastProvider>;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  return { loader, ...renderHook(() => useAuth(), { wrapper: Wrap }) };
};
const settled = (result, status) => waitFor(() => expect(result.current.status).toBe(status));

beforeEach(() => {
  vi.clearAllMocks();
  startSession.mockResolvedValue({ user: DANA, claimed: 0 });
});

describe('AuthProvider: status', () => {
  it('starts as "loading" and becomes "signedOut" when nobody is signed in', async () => {
    const { result } = setup(fakeBackend(null));
    expect(result.current).toMatchObject({ status: 'loading', user: null });
    await settled(result, 'signedOut');
    expect(result.current.user).toBeNull();
  });

  it('is "signedIn" with the user when the service already knows them (a reload)', async () => {
    const { result } = setup(fakeBackend(DANA));
    await settled(result, 'signedIn');
    expect(result.current.user).toEqual(DANA);
  });

  it('follows the service: signed in, then out', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await b.emit(DANA);
    expect(result.current).toMatchObject({ status: 'signedIn', user: DANA });
    await b.emit(null);
    expect(result.current).toMatchObject({ status: 'signedOut', user: null });
  });

  it('is "unavailable" when there is no sign-in service on this site', async () => {
    const { result } = setup(null);
    await settled(result, 'unavailable');
    expect(result.current.user).toBeNull();
    expect(startSession).not.toHaveBeenCalled();
  });

  it('is "unavailable" (and does not crash) when the service fails to load', async () => {
    const loader = vi.fn(async () => { throw new Error('chunk failed to load'); });
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }) => <ToastProvider><AuthProvider loader={loader}>{children}</AuthProvider></ToastProvider> });
    await settled(result, 'unavailable');
  });

  it('useAuth outside the provider is a clear error, not a silent signed-out', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});

describe('AuthProvider: the one-time claim of guest cases', () => {
  it('asks the server once when someone signs in', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await b.emit(DANA);
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1));
  });

  it('asks once on a reload too (the person is signed in from the start)', async () => {
    const { result } = setup(fakeBackend(DANA));
    await settled(result, 'signedIn');
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1));
  });

  it('does not ask again when the same person is announced again', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await b.emit(DANA);
    await b.emit({ ...DANA, displayName: 'Dana D.' });
    await b.emit(DANA);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different person, and again after signing out and back in', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await b.emit(DANA);
    await b.emit(OMAR);
    expect(startSession).toHaveBeenCalledTimes(2);
    await b.emit(null);
    await b.emit(OMAR);
    expect(startSession).toHaveBeenCalledTimes(3);
  });

  it('says so when earlier cases were added to the account (plural)', async () => {
    startSession.mockResolvedValue({ user: DANA, claimed: 3 });
    const b = fakeBackend(null);
    const view = render(<ToastProvider><AuthProvider loader={async () => b}><p>app</p></AuthProvider></ToastProvider>);
    await screen.findByText('app');
    await b.emit(DANA);
    expect(await screen.findByText(/3 cases you played as a guest/i)).toBeInTheDocument();
    view.unmount();
  });

  it('and in the singular for exactly one', async () => {
    startSession.mockResolvedValue({ user: DANA, claimed: 1 });
    const b = fakeBackend(null);
    render(<ToastProvider><AuthProvider loader={async () => b}><p>app</p></AuthProvider></ToastProvider>);
    await screen.findByText('app');
    await b.emit(DANA);
    expect(await screen.findByText(/1 case you played as a guest/i)).toBeInTheDocument();
  });

  it('says nothing when nothing was claimed', async () => {
    const b = fakeBackend(null);
    render(<ToastProvider><AuthProvider loader={async () => b}><p>app</p></AuthProvider></ToastProvider>);
    await screen.findByText('app');
    await b.emit(DANA);
    await waitFor(() => expect(startSession).toHaveBeenCalled());
    expect(screen.queryByText(/played as a guest/i)).toBeNull();
  });

  it('a failed claim is silent and leaves the person signed in', async () => {
    startSession.mockRejectedValue({ status: 500, code: 'INTERNAL_ERROR', message: 'x' });
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await b.emit(DANA);
    await waitFor(() => expect(startSession).toHaveBeenCalled());
    expect(result.current.status).toBe('signedIn');
  });
});

describe('AuthProvider: requests carry the token', () => {
  it('hands the API layer a function that returns the current token', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    const provider = setAuthTokenProvider.mock.calls.find(([fn]) => typeof fn === 'function')[0];
    expect(await provider()).toBe('tok-1');
    expect(b.getToken).toHaveBeenCalled();
  });

  it('registers the provider BEFORE the first claim (the claim itself needs the token)', async () => {
    const order = [];
    setAuthTokenProvider.mockImplementation((fn) => order.push(fn ? 'provider' : 'cleared'));
    startSession.mockImplementation(async () => { order.push('claim'); return { user: DANA, claimed: 0 }; });
    const { result } = setup(fakeBackend(DANA));
    await settled(result, 'signedIn');
    await waitFor(() => expect(startSession).toHaveBeenCalled());
    expect(order.indexOf('provider')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('provider')).toBeLessThan(order.indexOf('claim'));
    setAuthTokenProvider.mockReset();
  });

  it('clears the provider and unsubscribes when the app goes away', async () => {
    const b = fakeBackend(null);
    const { result, unmount } = setup(b);
    await settled(result, 'signedOut');
    expect(b.subs.size).toBe(1);
    unmount();
    expect(b.subs.size).toBe(0);
    expect(setAuthTokenProvider).toHaveBeenLastCalledWith(null);
  });

  it('under StrictMode (effects run twice) exactly one subscription is left', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b, { strict: true });
    await settled(result, 'signedOut');
    expect(b.subs.size).toBe(1);
  });
});

describe('AuthProvider: actions', () => {
  it.each([
    ['signIn', { email: 'dana@example.com', password: 'longenough1' }],
    ['signUp', { name: 'Dana', email: 'dana@example.com', password: 'longenough1' }],
  ])('%s passes the details to the service and returns the person', async (action, details) => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    let user;
    await act(async () => { user = await result.current[action](details); });
    expect(b[action]).toHaveBeenCalledWith(details);
    expect(user).toEqual(DANA);
  });

  it('signInWithGoogle and resetPassword delegate', async () => {
    const b = fakeBackend(null);
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(b.signInWithGoogle).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.resetPassword('dana@example.com'); });
    expect(b.resetPassword).toHaveBeenCalledWith('dana@example.com');
  });

  it('signUp shows the NAME the person just chose at once (the service announces them nameless first)', async () => {
    const b = fakeBackend(null);
    b.signUp.mockImplementation(async () => {
      b.subs.forEach((cb) => cb({ ...DANA, displayName: 'dana' })); // announced from the email first
      return DANA; // then the saved name
    });
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await act(async () => { await result.current.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' }); });
    expect(result.current.user.displayName).toBe('Dana');
  });

  it('signOut signs out and the status follows', async () => {
    const b = fakeBackend(DANA);
    b.signOut.mockImplementation(async () => { b.subs.forEach((cb) => cb(null)); });
    const { result } = setup(b);
    await settled(result, 'signedIn');
    await act(async () => { await result.current.signOut(); });
    expect(b.signOut).toHaveBeenCalledTimes(1);
    await settled(result, 'signedOut');
  });

  it('errors from the service reach the caller untouched (the form decides what to say)', async () => {
    const b = fakeBackend(null);
    b.signIn.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    const { result } = setup(b);
    await settled(result, 'signedOut');
    await expect(result.current.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(result.current.status).toBe('signedOut');
  });

  it('without a sign-in service, every action fails with a clear "unavailable" error', async () => {
    const { result } = setup(null);
    await settled(result, 'unavailable');
    for (const call of [() => result.current.signIn({}), () => result.current.signUp({}), () => result.current.signInWithGoogle(), () => result.current.signOut(), () => result.current.resetPassword('a@b.co')]) {
      await expect(call()).rejects.toMatchObject({ code: 'auth/unavailable' });
    }
  });
});
