import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Providers } from '../App.jsx';
import Results from './Results.jsx';

vi.mock('../api/cases.js', async () => {
  const m = await import('../api/mock/index.js');
  m.__setLatency(0);
  return {
    createCase: vi.fn(m.createCase), getCase: vi.fn(m.getCase), discoverClue: vi.fn(m.discoverClue),
    requestHint: vi.fn(m.requestHint), accuse: vi.fn(m.accuse), getResult: vi.fn(m.getResult),
    listCases: vi.fn(m.listCases), health: vi.fn(m.health),
  };
});
const api = await import('../api/cases.js');
const mock = await import('../api/mock/index.js');

const PREMISE = 'A priceless sitar vanishes during a college music fest';

// plays a case up to the accusation: `clues` clues found, `hints` hints used, then `suspect` accused
async function play({ difficulty = 'easy', clues = 0, hints = 0, suspect = 's2' } = {}) {
  const created = await mock.createCase({ premise: PREMISE, difficulty });
  for (let i = 1; i <= clues; i++) await mock.discoverClue(created.id, `c${i}`);
  for (let i = 0; i < hints; i++) await mock.requestHint(created.id);
  const result = suspect ? await mock.accuse(created.id, suspect) : null;
  return { created, result };
}

function show(created, state) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/case/${created.id}/result`, state }]}>
      <Providers>
        <Routes>
          <Route path="/case/:id/result" element={<Results />} />
          <Route path="/case/:id" element={<p>ROOM</p>} />
          <Route path="/create" element={<p>CREATE PAGE</p>} />
        </Routes>
      </Providers>
    </MemoryRouter>,
  );
}

const loaded = () => screen.findByRole('heading', { level: 1 });
const row = (name) => screen.getByRole('row', { name: new RegExp(name, 'i') });
const rowValue = (name) => within(row(name)).getByRole('cell').textContent;
const region = (name) => screen.getByRole('region', { name: new RegExp(name, 'i') });

beforeEach(() => {
  mock.__reset();
  mock.__setLatency(0);
  vi.clearAllMocks();
});
afterEach(() => {
  delete navigator.share;
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('Results: the verdict', () => {
  it('a correct accusation: "Case closed — you got it!", the SOLVED stamp, the case title and difficulty', async () => {
    const { created } = await play();
    show(created);
    expect(await loaded()).toHaveTextContent('Case closed — you got it!');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Case result · AI Mystery Room');
    expect(document.querySelector('[data-stamp]')).toHaveTextContent('Solved');
    expect(document.querySelector('[data-stamp]')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByText('The Silent Sitar')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toHaveAttribute('data-tone', 'easy');
  });

  it('a wrong accusation: "The culprit got away." and the UNSOLVED stamp', async () => {
    const { created } = await play({ suspect: 's1' });
    show(created);
    expect(await loaded()).toHaveTextContent('The culprit got away.');
    expect(document.querySelector('[data-stamp]')).toHaveTextContent('Unsolved');
    expect(document.querySelector('[data-stamp]')).toHaveAttribute('data-tone', 'danger');
  });

  it('the accused card is green when right and red when wrong; the culprit card is always green', async () => {
    const right = await play({ suspect: 's2' });
    show(right.created);
    await loaded();
    expect(region('you accused')).toHaveClass('border-moss/50');
    expect(region('the culprit')).toHaveClass('border-moss/50');
  });

  it('wrong: the accused card is red', async () => {
    const { created } = await play({ suspect: 's1' });
    show(created);
    await loaded();
    expect(region('you accused')).toHaveClass('border-blood/50');
    expect(region('the culprit')).toHaveClass('border-moss/50');
  });

  it('the stamp is decoration: the h1 carries the verdict for screen readers', async () => {
    const { created } = await play();
    show(created);
    await loaded();
    expect(document.querySelector('[data-stamp]')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Results: accused versus culprit', () => {
  it('right: both cards name the same suspect', async () => {
    const { created } = await play({ suspect: 's2' });
    show(created);
    await loaded();
    expect(within(region('you accused')).getByText('Arjun Rao')).toBeInTheDocument();
    const culprit = within(region('the culprit'));
    expect(culprit.getByText('Arjun Rao')).toBeInTheDocument();
    expect(culprit.getByText(/visiting tabla player/i)).toBeInTheDocument();
  });

  it('wrong: the accused card and the real culprit card show different people', async () => {
    const { created } = await play({ suspect: 's1' });
    show(created);
    await loaded();
    const accused = within(region('you accused'));
    expect(accused.getByText('Meera Iyer')).toBeInTheDocument();
    expect(accused.queryByText('Arjun Rao')).toBeNull();
    const culprit = within(region('the culprit'));
    expect(culprit.getByText('Arjun Rao')).toBeInTheDocument();
    expect(culprit.queryByText('Meera Iyer')).toBeNull();
  });
});

describe('Results: explanation and key clues', () => {
  it('shows the explanation text the server revealed', async () => {
    const { created, result } = await play();
    show(created);
    await loaded();
    expect(screen.getByText(result.explanation)).toBeInTheDocument();
  });

  it('lists every key clue marked Found or Missed, in words, matching what the player found', async () => {
    const { created, result } = await play({ clues: 2 });
    show(created);
    await loaded();
    const list = within(region('key clues'));
    expect(list.getAllByRole('listitem')).toHaveLength(result.keyClues.length);
    for (const k of result.keyClues) {
      const item = list.getByText(k.title).closest('li');
      expect(item).toHaveTextContent(k.found ? 'Found' : 'Missed');
      expect(item).not.toHaveTextContent(k.found ? 'Missed' : 'Found');
    }
    expect(result.keyClues.some((k) => k.found)).toBe(true);
    expect(result.keyClues.some((k) => !k.found)).toBe(true);
  });
});

describe('Results: score breakdown', () => {
  it('easy, correct, 3 clues, 1 hint = 100 + 15 - 10 = 105', async () => {
    const { created } = await play({ clues: 3, hints: 1 });
    show(created);
    await loaded();
    expect(screen.getByRole('table', { name: /score breakdown/i })).toBeInTheDocument();
    expect(rowValue('base')).toBe('100');
    expect(rowValue('clues')).toBe('+15');
    expect(rowValue('hints')).toBe('−10');
    expect(rowValue('total')).toBe('105');
  });

  it('shows how the clue and hint amounts come about (3 × 5, 1 × 10)', async () => {
    const { created } = await play({ clues: 3, hints: 1 });
    show(created);
    await loaded();
    expect(row('clues')).toHaveTextContent('3 × 5');
    expect(row('hints')).toHaveTextContent('1 × 10');
  });

  it('wrong accusation: base 0, but clues still count (easy, 3 clues, 0 hints = 15)', async () => {
    const { created } = await play({ clues: 3, suspect: 's1' });
    show(created);
    await loaded();
    expect(rowValue('base')).toBe('0');
    expect(rowValue('clues')).toBe('+15');
    expect(rowValue('hints')).toBe('0'); // nothing taken off, so no minus sign
    expect(rowValue('total')).toBe('15');
  });

  it('the total never goes below zero (medium, wrong, 1 clue, 2 hints = 0)', async () => {
    const { created } = await play({ difficulty: 'medium', clues: 1, hints: 2, suspect: 's1' });
    show(created);
    await loaded();
    expect(rowValue('base')).toBe('0');
    expect(rowValue('clues')).toBe('+5');
    expect(rowValue('hints')).toBe('−20');
    expect(rowValue('total')).toBe('0');
  });

  it('shows the server score exactly, whatever the numbers add up to on screen (never recomputed)', async () => {
    const { created, result } = await play({ clues: 1 });
    show(created, { result: { ...result, score: { base: 100, clueBonus: 5, hintPenalty: 0, total: 777 } } });
    await loaded();
    expect(rowValue('total')).toBe('777');
  });
});

describe('Results: where the data comes from', () => {
  it('uses the result carried from the accusation page, without asking the server again', async () => {
    const { created, result } = await play();
    show(created, { result });
    await loaded();
    expect(api.getResult).not.toHaveBeenCalled();
  });

  it('ignores a carried result that belongs to another case and fetches its own', async () => {
    const { created } = await play({ suspect: 's2' });
    const other = await play({ suspect: 's1' });
    show(created, { result: other.result });
    expect(await loaded()).toHaveTextContent('Case closed — you got it!');
    expect(api.getResult).toHaveBeenCalledWith(created.id);
  });

  it('opened directly (a reload, a shared link): shows a skeleton, then fetches the result', async () => {
    const { created } = await play();
    show(created);
    expect(screen.getByRole('status', { name: /loading result/i })).toBeInTheDocument();
    await loaded();
    expect(api.getResult).toHaveBeenCalledTimes(1);
    expect(api.getResult).toHaveBeenCalledWith(created.id);
  });

  it('a case that has not been accused yet sends the player back to the investigation', async () => {
    const { created } = await play({ suspect: null });
    show(created);
    expect(await screen.findByText('ROOM')).toBeInTheDocument();
  });

  it.each([
    ['FORBIDDEN', 403, 'Not your case file'],
    ['CASE_NOT_FOUND', 404, 'Case not found'],
    ['INTERNAL_ERROR', 500, 'Could not open the case'],
  ])('%s shows "%s" and still one h1', async (code, status, title) => {
    const { created } = await play();
    api.getResult.mockImplementationOnce(() => Promise.reject({ status, code, message: 'x' }));
    show(created);
    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('Results: reasoning, actions and sharing', () => {
  it('shows the player\'s own reasoning when they wrote some', async () => {
    const { created } = await play();
    window.sessionStorage.setItem(`mr-reasoning:${created.id}`, 'The rosin gives it away');
    show(created);
    await loaded();
    expect(within(region('your reasoning')).getByText('The rosin gives it away')).toBeInTheDocument();
  });

  it('shows no reasoning section when there is none, and never another case\'s', async () => {
    const { created } = await play();
    window.sessionStorage.setItem('mr-reasoning:ffffffffffffffffffffffff', 'someone else');
    show(created);
    await loaded();
    expect(screen.queryByText(/your reasoning/i)).toBeNull();
    expect(screen.queryByText('someone else')).toBeNull();
  });

  it('reasoning is shown as plain text, never as markup', async () => {
    const { created } = await play();
    window.sessionStorage.setItem(`mr-reasoning:${created.id}`, '<img src=x onerror=alert(1)>');
    show(created);
    await loaded();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });

  it('"New mystery" starts a new case', async () => {
    const { created } = await play();
    show(created);
    await loaded();
    expect(screen.getByRole('link', { name: /new mystery/i })).toHaveAttribute('href', '/create');
  });

  it('Share uses the device share sheet when there is one, with the title and score', async () => {
    const { created } = await play({ clues: 3, hints: 1 });
    const share = vi.fn().mockResolvedValue(undefined);
    navigator.share = share;
    show(created);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].text).toBe("I solved 'The Silent Sitar' on AI Mystery Room — 105 pts");
  });

  it('Share copies the text and says so when there is no share sheet', async () => {
    const { created } = await play({ clues: 3, hints: 1 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    show(created);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(writeText).toHaveBeenCalledWith("I solved 'The Silent Sitar' on AI Mystery Room — 105 pts");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it('a lost case is shared honestly: not "solved"', async () => {
    const { created } = await play({ clues: 3, suspect: 's1' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    show(created);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(writeText.mock.calls[0][0]).toBe("I couldn't crack 'The Silent Sitar' on AI Mystery Room — 15 pts");
  });

  it('cancelling the share sheet is not an error', async () => {
    const { created } = await play();
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    show(created);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.queryByText(/couldn't share|didn't work|went wrong/i)).toBeNull();
  });

  it('when neither sharing nor copying is possible it says so instead of failing silently', async () => {
    const { created } = await play();
    show(created);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(await screen.findByText(/couldn't share|could not share|can't share/i)).toBeInTheDocument();
  });
});
