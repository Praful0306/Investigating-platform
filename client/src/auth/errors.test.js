import { describe, expect, it } from 'vitest';
import { authMessage } from './errors.js';

describe('authMessage: Firebase error codes in plain words', () => {
  it.each([
    ['auth/invalid-credential', null, /don't match/i],
    ['auth/wrong-password', null, /don't match/i],
    ['auth/user-not-found', null, /don't match/i],
    ['auth/invalid-email', 'email', /email address/i],
    ['auth/email-already-in-use', 'email', /already exists/i],
    ['auth/weak-password', 'password', /8 characters/i],
    ['auth/too-many-requests', null, /too many attempts/i],
    ['auth/network-request-failed', null, /connection/i],
    ['auth/popup-blocked', null, /pop-ups/i],
    ['auth/user-disabled', null, /disabled/i],
    ['auth/operation-not-allowed', null, /isn't turned on/i],
    ['auth/account-exists-with-different-credential', 'email', /different sign-in method/i],
    ['auth/unavailable', null, /isn't set up/i],
  ])('%s -> field %s', (code, field, text) => {
    const out = authMessage({ code });
    expect(out.field).toBe(field);
    expect(out.message).toMatch(text);
    expect(out.silent).toBe(false);
  });

  it('wrong password, unknown email and bad credential all read the same (no hint which one was wrong)', () => {
    const a = authMessage({ code: 'auth/wrong-password' }).message;
    expect(authMessage({ code: 'auth/user-not-found' }).message).toBe(a);
    expect(authMessage({ code: 'auth/invalid-credential' }).message).toBe(a);
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('%s is silent: closing the Google window is not an error', (code) => {
    expect(authMessage({ code })).toEqual({ field: null, message: '', silent: true });
  });

  it.each([
    ['an unknown code', { code: 'auth/something-new' }],
    ['no code', {}],
    ['a plain Error', new Error('Firebase: Error (auth/internal-error). apiKey=AIzaSECRET')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('%s gets a generic sentence', (_name, err) => {
    const out = authMessage(err);
    expect(out).toMatchObject({ field: null, silent: false });
    expect(out.message).toBe('Something went wrong. Please try again.');
  });

  it('never shows raw codes or the SDK message', () => {
    for (const err of [{ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' }, new Error('Firebase: apiKey=AIzaSECRET')]) {
      expect(authMessage(err).message).not.toMatch(/auth\/|firebase|AIza/i);
    }
  });
});
