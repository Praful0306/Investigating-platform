import { DIFFICULTY } from '../../config/difficulty.js';
import { GeneratedCaseSchema } from './schema.js';

const GIVEAWAY = /culprit|guilty|did it|the killer|the thief|confessed/i;
// A real HTML tag or comment: "<" must be followed by a letter, or "/" and a letter, or "!--". Ordinary text such as
// "<5 minutes" or "a<b and c>d" is not a tag and must survive (a bare /<[^>]*>/ deleted everything up to the next ">").
const TAG = /<\/?[A-Za-z][^<>]*>|<!--[\s\S]*?-->/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole-name match, any case, Unicode-aware: "Ann" must not match "annual", "Al" must not match "alibi".
const nameRe = (name, flags = 'iu') => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, flags);

// First name, unless it is so short (<= 2 chars) that only the full name is a safe thing to look for.
const needleFor = (fullName) => {
  const first = fullName.split(/\s+/)[0];
  return first.length <= 2 ? fullName : first;
};

// true if the name appears within 40 chars of a give-away word
function giveAway(story, needle) {
  for (const m of story.matchAll(nameRe(needle, 'giu'))) {
    const window = story.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    if (GIVEAWAY.test(window)) return true;
  }
  return false;
}

// Strip HTML tags and trim every string; record the paths of strings left empty.
function clean(value, empties, path = '') {
  if (typeof value === 'string') {
    const s = value.replace(TAG, '').trim();
    if (!s) empties.push(path);
    return s;
  }
  if (Array.isArray(value)) return value.map((v, i) => clean(v, empties, path ? `${path}.${i}` : String(i)));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, empties, path ? `${path}.${k}` : k)]));
  }
  return value;
}

const issues = (err) => err.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'output'}: ${i.message}`);

export function validateGenerated(raw, difficulty) {
  const cfg = DIFFICULTY[difficulty];
  const text = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Output was not valid JSON'] };
  }

  const first = GeneratedCaseSchema.safeParse(obj);
  if (!first.success) return { ok: false, errors: issues(first.error) };

  const empties = [];
  const stripped = clean(first.data, empties);
  if (empties.length) return { ok: false, errors: empties.slice(0, 8).map((p) => `${p}: empty after removing HTML`) };
  const second = GeneratedCaseSchema.safeParse(stripped); // stripping can shorten the story below its minimum
  if (!second.success) return { ok: false, errors: issues(second.error) };
  const c = second.data;

  const errors = [];
  const expect = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`).join(',');
  if (c.suspects.length !== cfg.suspects) errors.push(`Need exactly ${cfg.suspects} suspects`);
  if (c.clues.length !== cfg.clues) errors.push(`Need exactly ${cfg.clues} clues`);
  if (c.hints.length !== cfg.hints) errors.push(`Need exactly ${cfg.hints} hints`);
  if (c.suspects.map((s) => s.id).join(',') !== expect(cfg.suspects, 's')) errors.push(`Suspect ids must be ${expect(cfg.suspects, 's')}`);
  if (c.clues.map((s) => s.id).join(',') !== expect(cfg.clues, 'c')) errors.push(`Clue ids must be ${expect(cfg.clues, 'c')}`);

  const names = c.suspects.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) errors.push('Suspect names must be unique');

  const culprit = c.suspects.find((s) => s.id === c.solution.culpritId);
  if (!culprit) errors.push('solution.culpritId must be one of the suspect ids');

  const clueIds = new Set(c.clues.map((x) => x.id));
  const keys = [...new Set(c.solution.keyClueIds)];
  if (keys.length < cfg.minKeyClues) errors.push(`Need at least ${cfg.minKeyClues} distinct keyClueIds`);
  if (keys.some((k) => !clueIds.has(k))) errors.push('keyClueIds must reference existing clue ids');

  if (culprit) {
    const needle = needleFor(culprit.name);
    if (!nameRe(needle).test(c.solution.explanation)) errors.push('Explanation must name the culprit');
    if (c.hints.some((h) => nameRe(needle).test(h))) errors.push("Hints must not contain the culprit's name");
    if (giveAway(c.story, needle)) errors.push('Story must not reveal the culprit');
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, data: { ...c, solution: { ...c.solution, keyClueIds: keys } } };
}
