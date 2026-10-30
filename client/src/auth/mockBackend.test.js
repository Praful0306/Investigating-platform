import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBackend } from './mockBackend.js';

const make = () => createMockBackend({ latency: 0 });
const lastOf = (fn) => fn.mock.calls.at(-1)?.[0];

beforeEach(() => window.sessionStorage.clear());

describe('mock auth backend', () => {
  it('starts signed out and tells a new subscriber so', async () => {
    const b = make();
    const seen = vi.fn();
    b.subscribe(seen);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(null));
  });

  it('signUp makes the account, signs in, and cleans up the name and email', async () => {
    const b = make();
    const seen = vi.fn();
    b.subscribe(seen);
    const user = await b.signUp({ name: '  Dana Detective ', email: '  Dana@Example.COM ', password: 'longenough1' });
    expect(user).toMatchObject({ email: 'dana@example.com', displayName: 'Dana Detective' });
    expect(user.id).toBeTruthy();
    expect(lastOf(seen)).toEqual(user);
  });

  it('refuses a second account with the same email, in any letter case', async () => {
    const b = make();
    await b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    await expect(b.signUp({ name: 'Other', email: 'DANA@example.com', password: 'longenough1' })).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
  });

  it('refuses a weak password and a malformed email, like Firebase does', async () => {
    const b = make();
    await expect(b.signUp({ name: 'Dana', email: 'dana@example.com', password: '123' })).rejects.toMatchObject({ code: 'auth/weak-password' });
    await expect(b.signUp({ name: 'Dana', email: 'not-an-email', password: 'longenough1' })).rejects.toMatchObject({ code: 'auth/invalid-email' });
    await expect(b.signIn({ email: 'nope', password: 'longenough1' })).rejects.toMatchObject({ code: 'auth/invalid-email' });
  });

  it('signIn works with the right password and says "invalid credential" for a wrong password or unknown email alike', async () => {
    const b = make();
    await b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    await b.signOut();
    await expect(b.signIn({ email: 'dana@example.com', password: 'wrongwrong' })).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    await expect(b.signIn({ email: 'ghost@example.com', password: 'longenough1' })).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    const user = await b.signIn({ email: 'DANA@example.com', password: 'longenough1' });
    expect(user.displayName).toBe('Dana');
  });

  it('a failed sign-in does not sign anyone in', async () => {
    const b = make();
    await b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    await b.signOut();
    const seen = vi.fn();
    b.subscribe(seen);
    await expect(b.signIn({ email: 'dana@example.com', password: 'bad-password' })).rejects.toBeTruthy();
    expect(await b.getToken()).toBeNull();
    expect(lastOf(seen) ?? null).toBeNull();
  });

  it('signOut tells subscribers and removes the token', async () => {
    const b = make();
    const seen = vi.fn();
    b.subscribe(seen);
    await b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    expect(await b.getToken()).toMatch(/^mock-token:/);
    await b.signOut();
    expect(lastOf(seen)).toBeNull();
    expect(await b.getToken()).toBeNull();
  });

  it('survives a page reload: a new backend on the same storage is still signed in', async () => {
    const first = make();
    const user = await first.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    const second = make();
    const seen = vi.fn();
    second.subscribe(seen);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(user));
    await second.signOut();
    const third = make();
    const seen3 = vi.fn();
    third.subscribe(seen3);
    await vi.waitFor(() => expect(seen3).toHaveBeenCalledWith(null));
  });

  it('Google sign-in gives the same demo person every time', async () => {
    const b = make();
    const a = await b.signInWithGoogle();
    await b.signOut();
    const again = await b.signInWithGoogle();
    expect(a).toMatchObject({ displayName: 'Demo Detective', email: 'demo@example.com' });
    expect(again.id).toBe(a.id);
  });

  it('password reset succeeds for any well-formed email (it does not reveal which accounts exist) and rejects a malformed one', async () => {
    const b = make();
    await expect(b.resetPassword('anyone@example.com')).resolves.toBeUndefined();
    await expect(b.resetPassword('nope')).rejects.toMatchObject({ code: 'auth/invalid-email' });
  });

  it('unsubscribe stops the notifications', async () => {
    const b = make();
    const seen = vi.fn();
    const stop = b.subscribe(seen);
    await vi.waitFor(() => expect(seen).toHaveBeenCalled());
    stop();
    const before = seen.mock.calls.length;
    await b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' });
    expect(seen.mock.calls.length).toBe(before);
  });

  it('corrupted storage is treated as empty rather than crashing', async () => {
    window.sessionStorage.setItem('mr-mock-auth', '{not json');
    const b = make();
    const seen = vi.fn();
    b.subscribe(seen);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(null));
    await expect(b.signUp({ name: 'Dana', email: 'dana@example.com', password: 'longenough1' })).resolves.toBeTruthy();
  });

  it('errors look like Firebase errors: a code, and no raw message needed', async () => {
    const b = make();
    const err = await b.signIn({ email: 'a@b.co', password: 'longenough1' }).catch((e) => e);
    expect(err.code).toBe('auth/invalid-credential');
  });
});
