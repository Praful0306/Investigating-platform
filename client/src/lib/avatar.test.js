import { describe, expect, it } from 'vitest';
import { hueOf, initialsOf } from './avatar.js';

describe('initialsOf', () => {
  it.each([
    ['Arjun Rao', 'AR'], ['Cher', 'C'], ['  mary   ann lee ', 'ML'], ['Åsa Berg', 'ÅB'], ['李 小龍', '李小'], ['', '?'], ['   ', '?'],
  ])('"%s" -> %s', (name, expected) => expect(initialsOf(name)).toBe(expected));

  it('does not split an emoji or other character outside the basic plane in half', () => {
    expect(initialsOf('😀 Smith')).toBe('😀S');
  });

  it('never throws on odd input', () => {
    for (const bad of [undefined, null, 42]) expect(() => initialsOf(bad)).not.toThrow();
  });
});

const circular = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const randomName = (seed) => { let x = seed; const next = () => (x = (x * 1103515245 + 12345) & 0x7fffffff); return Array.from({ length: 4 + (next() % 8) }, () => String.fromCharCode(65 + (next() % 26))).join(''); };

describe('hueOf', () => {
  it('is always a whole number from 0 to 359, with or without a slot', () => {
    for (const name of ['Arjun Rao', '', 'x'.repeat(500), 'Åsa 😀', '李小龍']) {
      for (const slot of [undefined, 0, 1, 4, 7]) {
        const h = hueOf(name, slot);
        expect(Number.isInteger(h), `${name}/${slot}`).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });

  it('is stable: the same name (and slot) always gives the same colour', () => {
    expect(hueOf('Arjun Rao')).toBe(hueOf('Arjun Rao'));
    expect(hueOf('Arjun Rao', 2)).toBe(hueOf('Arjun Rao', 2));
  });

  it('is still seeded by the name: different names in the same slot differ', () => {
    const hues = new Set(['Arjun Rao', 'Meera Iyer', 'Kavya Nair', 'Nandini Bisht', 'Vikram Sood'].map((n) => hueOf(n, 1)));
    expect(hues.size).toBeGreaterThan(1);
  });

  it('suspects in the same case always have clearly different colours (at least 45 degrees apart), whatever their names', () => {
    for (let trial = 0; trial < 300; trial++) {
      const names = Array.from({ length: 5 }, (_, i) => randomName(trial * 7 + i));
      const hues = names.map((n, slot) => hueOf(n, slot));
      for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          expect(circular(hues[i], hues[j]), `${names[i]} vs ${names[j]}`).toBeGreaterThanOrEqual(45);
        }
      }
    }
  });

  it('even identical names in one case still get different colours', () => {
    const hues = [0, 1, 2, 3, 4].map((slot) => hueOf('Same Name', slot));
    expect(new Set(hues).size).toBe(5);
  });
});
