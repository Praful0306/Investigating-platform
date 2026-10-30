import { describe, expect, it } from 'vitest';
import axios, { AxiosError } from 'axios';
import { http, toApiError } from './http.js';

const withResponse = (status, data) => {
  const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, {}, { status, data, headers: {}, config: {} });
  return err;
};

describe('http client', () => {
  it('sends cookies, defaults to the same-origin /api and waits up to 90 s (cold starts)', () => {
    expect(http.defaults.withCredentials).toBe(true);
    expect(http.defaults.baseURL).toBe('/api');
    expect(http.defaults.timeout).toBe(90000);
  });
});

describe('toApiError', () => {
  it('flattens the server error envelope and keeps the status', () => {
    const e = toApiError(withResponse(409, { error: { code: 'NO_HINTS_LEFT', message: 'No hints left.', details: [] } }));
    expect(e).toEqual({ status: 409, code: 'NO_HINTS_LEFT', message: 'No hints left.', details: [] });
  });

  it('keeps validation details for field-level messages', () => {
    const details = [{ path: 'premise', message: 'Premise must be 10–300 characters.' }];
    const e = toApiError(withResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Premise must be 10–300 characters.', details } }));
    expect(e.details).toEqual(details);
  });

  it('a timeout becomes a friendly TIMEOUT error', () => {
    const e = toApiError(new AxiosError('timeout of 90000ms exceeded', 'ECONNABORTED'));
    expect(e).toMatchObject({ status: 0, code: 'TIMEOUT' });
    expect(e.message).toMatch(/too long|waking up/i);
  });

  it('no response at all becomes NETWORK', () => {
    const e = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(e).toMatchObject({ status: 0, code: 'NETWORK' });
    expect(e.message).toMatch(/Cannot reach the server/);
  });

  it('a cancelled request is its own code, so screens can ignore it', () => {
    const e = toApiError(new axios.CanceledError('canceled'));
    expect(e.code).toBe('CANCELED');
    expect(e.status).toBe(0);
  });

  it('an HTML error page from a proxy (no envelope) becomes a generic server error, not "network"', () => {
    const e = toApiError(withResponse(502, '<html>Bad Gateway</html>'));
    expect(e).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
    expect(e.message).not.toMatch(/html|Bad Gateway/i);
  });

  it('a 429 without an envelope is still RATE_LIMITED', () => {
    expect(toApiError(withResponse(429, 'Too Many Requests')).code).toBe('RATE_LIMITED');
  });

  it('an envelope-shaped body from anywhere else is not trusted blindly (non-string code/message)', () => {
    const e = toApiError(withResponse(500, { error: { code: { $x: 1 }, message: ['a'] } }));
    expect(typeof e.code).toBe('string');
    expect(typeof e.message).toBe('string');
  });

  it('is idempotent: an already-mapped error passes through unchanged', () => {
    const mapped = { status: 404, code: 'CASE_NOT_FOUND', message: 'Case not found.' };
    expect(toApiError(mapped)).toEqual(mapped);
  });

  it('never throws on junk', () => {
    for (const junk of [undefined, null, 'x', 5, {}, new Error('plain')]) expect(() => toApiError(junk)).not.toThrow();
    expect(toApiError(new Error('plain'))).toMatchObject({ status: 0, code: 'NETWORK' });
  });
});
