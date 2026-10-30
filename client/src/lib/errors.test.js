import { describe, expect, it } from 'vitest';
import { friendlyMessage, isRetryable } from './errors.js';

describe('friendlyMessage', () => {
  it.each([
    ['RATE_LIMITED', "You've opened a lot of cases. Take a breather and try again in a few minutes."],
    ['AI_GENERATION_FAILED', 'Our mystery writer tangled the plot. Try again — it usually works on the next try.'],
    ['AI_UNAVAILABLE', 'The mystery writer is busy. Try again in a minute.'],
    ['FORBIDDEN', 'This case file belongs to another detective.'],
    ['CASE_NOT_FOUND', "We couldn't find that case."],
  ])('%s -> the wording from specs/04-frontend.md §3', (code, text) => {
    expect(friendlyMessage({ code, message: 'raw server text' })).toBe(text);
  });

  it('falls back to the server message for codes without special wording', () => {
    expect(friendlyMessage({ code: 'VALIDATION_ERROR', message: 'Premise must be 10–300 characters.' })).toBe('Premise must be 10–300 characters.');
    expect(friendlyMessage({ code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' }))
      .toBe('Cannot reach the server. Check your connection and try again.');
  });

  it('has a human sentence for every error code in SPEC §5.2', () => {
    const codes = [
      'VALIDATION_ERROR', 'INVALID_ID', 'UNAUTHORIZED', 'FORBIDDEN', 'CAPTCHA_FAILED', 'CASE_NOT_FOUND', 'CLUE_NOT_FOUND',
      'SUSPECT_NOT_FOUND', 'ROUTE_NOT_FOUND', 'CASE_ALREADY_COMPLETED', 'NO_HINTS_LEFT', 'CASE_NOT_COMPLETED', 'EMAIL_TAKEN',
      'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED', 'AI_GENERATION_FAILED', 'AI_UNAVAILABLE', 'INTERNAL_ERROR',
    ];
    for (const code of codes) {
      const text = friendlyMessage({ code });
      expect(text, code).toMatch(/\S{3,}/);
      expect(text, code).not.toMatch(/undefined|\[object/);
      expect(text, code).not.toMatch(/[A-Z]{4,}_[A-Z]+/); // never shows the raw code to a player
    }
  });

  it('never throws and always returns a sentence, whatever it is given', () => {
    for (const bad of [undefined, null, {}, 'oops', 42, new Error('boom')]) {
      const text = friendlyMessage(bad);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(5);
    }
  });

  it('shows no stack-like text from an Error', () => {
    expect(friendlyMessage(new Error('at node_modules/x.js:1'))).not.toMatch(/node_modules/);
  });
});

describe('isRetryable', () => {
  it.each(['NETWORK', 'TIMEOUT', 'AI_GENERATION_FAILED', 'AI_UNAVAILABLE', 'INTERNAL_ERROR'])('%s -> a retry may help', (code) => {
    expect(isRetryable({ code })).toBe(true);
  });
  it.each(['RATE_LIMITED', 'FORBIDDEN', 'CASE_NOT_FOUND', 'VALIDATION_ERROR', 'CASE_ALREADY_COMPLETED', 'CANCELED', undefined])(
    '%s -> retrying will not help',
    (code) => expect(isRetryable({ code })).toBe(false),
  );
  it('is false for junk input', () => {
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });
});
