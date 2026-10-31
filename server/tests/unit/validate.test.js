import { describe, expect, it } from 'vitest';
import { validateGenerated } from '../../src/services/ai/validate.js';
import { buildMockCase } from '../../src/services/ai/providers/mock.js';
import { DIFFICULTY } from '../../src/config/difficulty.js';

const base = (d = 'easy') => structuredClone(buildMockCase(DIFFICULTY[d]));
const run = (obj, d = 'easy') => validateGenerated(JSON.stringify(obj), d);
const errorsOf = (obj, d) => {
  const r = run(obj, d);
  expect(r.ok, 'expected validation to fail').toBe(false);
  return r.errors.join(' | ');
};
// rename the culprit (s2) consistently in suspects + explanation
const withCulprit = (name, d = 'easy') => {
  const c = base(d);
  c.suspects[1].name = name;
  c.solution.explanation = c.solution.explanation.replace('Arjun Rao', name);
  return c;
};

describe('valid output', () => {
  it.each(['easy', 'medium', 'hard'])('%s passes with correct counts', (d) => {
    const r = run(base(d), d);
    expect(r.ok).toBe(true);
    const cfg = DIFFICULTY[d];
    expect(r.data.suspects).toHaveLength(cfg.suspects);
    expect(r.data.clues).toHaveLength(cfg.clues);
    expect(r.data.hints).toHaveLength(cfg.hints);
  });

  it.each([
    ['```json fence', (s) => '```json\n' + s + '\n```'],
    ['plain fence', (s) => '```\n' + s + '\n```'],
    ['fence with trailing newline', (s) => '```json\n' + s + '\n```\n'],
    ['surrounding whitespace', (s) => `  \n${s}\n  `],
  ])('accepts %s', (_n, wrap) => {
    expect(validateGenerated(wrap(JSON.stringify(base())), 'easy').ok).toBe(true);
  });

  it('drops unknown keys and de-duplicates keyClueIds', () => {
    const c = base();
    c.extra = 'x';
    c.suspects[0].secret = 'y';
    c.solution.keyClueIds = ['c1', 'c3', 'c3', 'c4'];
    const r = run(c);
    expect(r.ok).toBe(true);
    expect(r.data.extra).toBeUndefined();
    expect(r.data.suspects[0].secret).toBeUndefined();
    expect(r.data.solution.keyClueIds).toEqual(['c1', 'c3', 'c4']);
  });

  it('strips HTML tags and trims', () => {
    const c = base();
    c.title = '  <b>The</b> Mock <script>alert(1)</script>Case ';
    const r = run(c);
    expect(r.ok).toBe(true);
    expect(r.data.title).toBe('The Mock alert(1)Case');
  });

  it('keeps ordinary text that merely contains < and > signs (only real HTML tags are removed)', () => {
    const c = base();
    c.clues[0].description = 'The timer read <5 minutes before nine and > 3 minutes after; also 3 < 4 and 9>2.';
    const r = run(c);
    expect(r.ok).toBe(true);
    expect(r.data.clues[0].description).toBe('The timer read <5 minutes before nine and > 3 minutes after; also 3 < 4 and 9>2.');
  });

  it.each([
    ['a closing tag', 'x</b>y', 'xy'],
    ['a tag with attributes', 'x<a href="https://e.com" onclick=alert(1)>y</a>z', 'xyz'],
    ['a self-closing tag', 'x<br/>y', 'xy'],
    ['an uppercase tag', 'x<SCRIPT>y</SCRIPT>z', 'xyz'],
    ['a comment', 'x<!-- hidden -->y', 'xy'],
    ['an image with an event handler', 'x<img src=x onerror=alert(1)>y', 'xy'],
    ['a tag split across lines', 'x<div\nclass="a">y</div>z', 'xyz'],
  ])('still removes %s', (_name, input, expected) => {
    const c = base();
    c.clues[1].title = input;
    const r = run(c);
    expect(r.ok).toBe(true);
    expect(r.data.clues[1].title).toBe(expected);
  });

  it('does not eat text between a stray < and a later real tag', () => {
    const c = base();
    c.clues[2].description = 'Seen at 9 <10 m away <b>clearly</b>.';
    const r = run(c);
    expect(r.data.clues[2].description).toBe('Seen at 9 <10 m away clearly.');
  });
});

describe('not JSON / wrong shape', () => {
  it.each([['plain text', 'sorry, I cannot'], ['empty', ''], ['undefined', undefined], ['truncated', '{"title":']])('%s -> not valid JSON', (_n, raw) => {
    expect(validateGenerated(raw, 'easy')).toEqual({ ok: false, errors: ['Output was not valid JSON'] });
  });

  it('wrong top-level type and empty object fail with at most 8 readable errors', () => {
    for (const raw of ['[]', '{}', '"x"', 'null']) {
      const r = validateGenerated(raw, 'easy');
      expect(r.ok).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.errors.length).toBeLessThanOrEqual(8);
    }
  });
});

describe('structural (zod) rules', () => {
  it('story shorter than 300 chars', () => {
    const c = base(); c.story = 'Too short.';
    expect(errorsOf(c)).toMatch(/story/);
  });
  it('story longer than 2500 chars', () => {
    const c = base(); c.story = 'x'.repeat(2501);
    expect(errorsOf(c)).toMatch(/story/);
  });
  it('explanation shorter than 120 chars', () => {
    const c = base(); c.solution.explanation = 'Arjun did it.';
    expect(errorsOf(c)).toMatch(/explanation/);
  });
  it('field over its max length (suspect name 61 chars)', () => {
    const c = base(); c.suspects[0].name = 'N'.repeat(61);
    expect(errorsOf(c)).toMatch(/suspects\.0\.name/);
  });
  it('missing and non-string fields', () => {
    const c = base(); delete c.crime; c.hints[0] = 5;
    expect(errorsOf(c)).toMatch(/crime/);
  });
  it('a string that is empty after tag stripping is rejected', () => {
    const c = base(); c.clues[0].title = '<b></b>';
    expect(errorsOf(c)).toMatch(/empty/i);
  });
});

describe('semantic rules', () => {
  it('wrong counts', () => {
    const s = base(); s.suspects.pop();
    const cl = base(); cl.clues.pop();
    const h = base(); h.hints.pop();
    expect(errorsOf(s)).toMatch(/Need exactly 3 suspects/);
    expect(errorsOf(cl)).toMatch(/Need exactly 5 clues/);
    expect(errorsOf(h)).toMatch(/Need exactly 2 hints/);
  });

  it('counts depend on the difficulty asked for', () => {
    expect(errorsOf(base('easy'), 'hard')).toMatch(/Need exactly 5 suspects/);
  });

  it('bad or out-of-order ids', () => {
    const s = base(); s.suspects[0].id = 'x1';
    const c = base(); [c.clues[0].id, c.clues[1].id] = ['c2', 'c1'];
    const d = base(); d.clues[1].id = 'c1';
    expect(errorsOf(s)).toMatch(/Suspect ids must be s1,s2,s3/);
    expect(errorsOf(c)).toMatch(/Clue ids must be c1,c2,c3,c4,c5/);
    expect(errorsOf(d)).toMatch(/Clue ids must be/);
  });

  it('duplicate suspect names, case-insensitive', () => {
    const c = base(); c.suspects[2].name = c.suspects[0].name.toUpperCase();
    expect(errorsOf(c)).toMatch(/names must be unique/);
  });

  it('culpritId not among suspects', () => {
    const c = base(); c.solution.culpritId = 's9';
    expect(errorsOf(c)).toMatch(/culpritId must be one of the suspect ids/);
  });

  it('keyClueIds unknown, or too few distinct', () => {
    const u = base(); u.solution.keyClueIds = ['c1', 'c99'];
    const f = base(); f.solution.keyClueIds = ['c1', 'c1', 'c1'];
    const m = base('medium'); m.solution.keyClueIds = ['c1', 'c2'];
    expect(errorsOf(u)).toMatch(/keyClueIds must reference existing clue ids/);
    expect(errorsOf(f)).toMatch(/at least 2 distinct keyClueIds/);
    expect(errorsOf(m, 'medium')).toMatch(/at least 3 distinct keyClueIds/);
  });

  it('explanation must name the culprit', () => {
    const c = base();
    c.solution.explanation = 'The rosin on the handle and the pawn receipt together prove exactly who took the instrument from the room. '.repeat(2);
    expect(errorsOf(c)).toMatch(/Explanation must name the culprit/);
  });

  describe('hints must not name the culprit', () => {
    it('first name, any case', () => {
      const c = base(); c.hints[0] = 'Ask ARJUN where he was.';
      expect(errorsOf(c)).toMatch(/Hints must not contain/);
    });
    it('full name', () => {
      const c = base(); c.hints[1] = 'Look into Arjun Rao.';
      expect(errorsOf(c)).toMatch(/Hints must not contain/);
    });
    it('does NOT trip on a longer word containing the name (Ann vs annual)', () => {
      const c = withCulprit('Ann Lee');
      c.hints[0] = 'The annual fest ledger looks off.';
      expect(run(c).ok).toBe(true);
    });
    it('still catches the name next to punctuation', () => {
      const c = withCulprit('Ann Lee');
      c.hints[0] = 'Everyone trusts Ann.';
      expect(errorsOf(c)).toMatch(/Hints must not contain/);
    });
    it('very short first name uses the full name (Al vs alibi)', () => {
      const ok = withCulprit('Al Rao'); ok.hints[0] = 'Test every alibi against the ticket stub.';
      const bad = withCulprit('Al Rao'); bad.hints[0] = 'Al Rao was seen near the door.';
      expect(run(ok).ok).toBe(true);
      expect(errorsOf(bad)).toMatch(/Hints must not contain/);
    });
    it('handles non-ASCII names', () => {
      const ok = withCulprit('Åsa Berg'); ok.hints[0] = 'Check the Åsabo ledger.';
      const bad = withCulprit('Åsa Berg'); bad.hints[0] = 'Åsa has no alibi.';
      expect(run(ok).ok).toBe(true);
      expect(errorsOf(bad)).toMatch(/Hints must not contain/);
    });
  });

  describe('story must not give the culprit away', () => {
    const filler = ' The corridor lights flickered as the crowd drifted toward the exits.';
    it('name right before a give-away word', () => {
      const c = base(); c.story += ' Arjun Rao is the culprit.';
      expect(errorsOf(c)).toMatch(/Story must not reveal the culprit/);
    });
    it('give-away word right before the name', () => {
      const c = base(); c.story += ' Everyone agreed the thief was surely Arjun.';
      expect(errorsOf(c)).toMatch(/Story must not reveal the culprit/);
    });
    it.each(['guilty', 'did it', 'the killer', 'confessed'])('catches "%s"', (w) => {
      const c = base(); c.story += ` Arjun ${w}.`;
      expect(errorsOf(c)).toMatch(/Story must not reveal the culprit/);
    });
    it('allows the name when a give-away word is far away (> 40 chars)', () => {
      const c = base(); c.story += ` Arjun waved from the stage.${filler.repeat(3)} Somewhere a culprit hides.`;
      expect(run(c).ok).toBe(true);
    });
    it('allows a give-away word far BEFORE the name (> 40 chars)', () => {
      const c = base(); c.story += ` Somewhere a culprit hides.${filler.repeat(3)} Arjun waved from the stage.`;
      expect(run(c).ok).toBe(true);
    });
    it('catches a give-away word 20 chars away on either side', () => {
      const after = base(); after.story += ' Arjun, said the crowd, did it';
      const before = base(); before.story += ' The guilty one, we think, is Arjun';
      expect(errorsOf(after)).toMatch(/Story must not reveal/);
      expect(errorsOf(before)).toMatch(/Story must not reveal/);
    });
    it('allows a give-away word that is not near the name at all', () => {
      const c = base(); c.story += ' The police suspect a culprit among the guests.';
      expect(run(c).ok).toBe(true);
    });
  });

  it('collects every problem so the retry prompt can fix them all', () => {
    const c = base(); c.suspects.pop(); c.hints.pop(); c.solution.culpritId = 's9';
    const e = errorsOf(c);
    expect(e).toMatch(/Need exactly 3 suspects/);
    expect(e).toMatch(/Need exactly 2 hints/);
    expect(e).toMatch(/culpritId must be one of/);
  });
});
