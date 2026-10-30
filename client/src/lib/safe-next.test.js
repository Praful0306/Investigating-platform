import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next.js';

describe('safeNext (where to go after signing in)', () => {
  it.each([
    ['/history', '/history'],
    ['/case/6720c1f0a1b2c3d4e5f60718', '/case/6720c1f0a1b2c3d4e5f60718'],
    ['/case/6720c1f0a1b2c3d4e5f60718/result?x=1#top', '/case/6720c1f0a1b2c3d4e5f60718/result?x=1#top'],
    ['/', '/'],
  ])('keeps the site path %s', (input, expected) => expect(safeNext(input)).toBe(expected));

  it.each([
    ['another site', 'https://evil.example/phish'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['backslash further in', '/history\\..\\evil'],
    ['encoded slash trick', '/%2F%2Fevil.example'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,hi'],
    ['no leading slash', 'history'],
    ['newline in it', '/history\nSet-Cookie: x=1'],
    ['tab in it', '/his\ttory'],
    ['empty', ''],
    ['whitespace', '   '],
    ['not a string', 42],
    ['null', null],
    ['undefined', undefined],
    ['an array', ['/history']],
    ['very long', `/${'a'.repeat(300)}`],
  ])('falls back to home for %s', (_name, input) => expect(safeNext(input)).toBe('/'));

  it('never sends someone back to the sign-in or sign-up page (a loop)', () => {
    expect(safeNext('/login')).toBe('/');
    expect(safeNext('/login?next=/history')).toBe('/');
    expect(safeNext('/register')).toBe('/');
    expect(safeNext('/registered-cases')).toBe('/registered-cases'); // only the real routes are excluded
  });

  it('uses the fallback you give it', () => {
    expect(safeNext('https://evil.example', '/history')).toBe('/history');
  });
});
