import { describe, expect, it } from 'vitest';
import { isEmail } from './validate.js';

describe('isEmail', () => {
  it.each(['dana@example.com', 'maya.rao+cases@mail.example.co.in', 'a@b.co', 'x_y-z@sub.domain.org'])('accepts %s', (v) => expect(isEmail(v)).toBe(true));

  it.each(['', ' ', 'dana', 'dana@', '@example.com', 'dana@example', 'dana @example.com', 'dana@exa mple.com', 'dana@@example.com', 'dana@example.', 'a@b@c.com'])(
    'rejects "%s"', (v) => expect(isEmail(v)).toBe(false));

  it('does not accept things that are not text', () => {
    for (const bad of [undefined, null, 42, {}, []]) expect(isEmail(bad)).toBe(false);
  });

  it('ignores spaces around it (the form trims)', () => {
    expect(isEmail('  dana@example.com  ')).toBe(true);
  });

  it('refuses an absurdly long address', () => {
    expect(isEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});
