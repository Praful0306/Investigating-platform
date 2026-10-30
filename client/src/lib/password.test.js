import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password.js';

describe('passwordStrength', () => {
  it.each([
    ['', 0, 'Too short'],
    ['abc', 0, 'Too short'],
    ['1234567', 0, 'Too short'],
    ['password', 1, 'Okay'],
    ['abcdefgh', 1, 'Okay'],
    ['abcdefghijkl', 2, 'Good'],
    ['abcd1234', 2, 'Good'],
    ['Abcdefgh1!', 2, 'Good'],
    ['correct horse battery', 3, 'Strong'],
    ['abcdefgh1234!', 3, 'Strong'],
  ])('"%s" is level %i (%s)', (pw, level, label) => {
    expect(passwordStrength(pw)).toEqual({ level, label });
  });

  it('counts characters, not bytes (an emoji is one)', () => {
    expect(passwordStrength('😀😀😀😀😀😀😀😀').level).toBeGreaterThanOrEqual(1);
    expect(passwordStrength('😀😀😀').level).toBe(0);
  });

  it('never throws on odd input', () => {
    for (const bad of [undefined, null, 42, {}]) expect(passwordStrength(bad)).toEqual({ level: 0, label: 'Too short' });
  });

  it('the first acceptable length is level 1, so "long enough" and "okay" agree', () => {
    expect(passwordStrength('x'.repeat(8)).level).toBe(1);
    expect(passwordStrength('x'.repeat(7)).level).toBe(0);
  });
});
