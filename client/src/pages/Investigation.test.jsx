import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { Providers } from '../App.jsx';
import { setReducedMotion } from '../test/matchMedia.js';
import Investigation from './Investigation.jsx';

// The page talks to the real mock game engine (proven identical to the server in api/mock/mock.test.js), wrapped in
// spies so individual tests can make one call fail.
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
const Stub = ({ label }) => <p>{label} {useParams().id}</p>;

async function open(difficulty = 'easy', prepare) {
  const created = await mock.createCase({ premise: PREMISE, difficulty });
  if (prepare) await prepare(created);
  render(
    <MemoryRouter initialEntries={[`/case/${created.id}`]}>
      <Providers>
        <Routes>
          <Route path="/case/:id" element={<Investigation />} />
          <Route path="/case/:id/accuse" element={<Stub label="ACCUSE" />} />
          <Route path="/case/:id/result" element={<Stub label="RESULT" />} />
          <Route path="/create" element={<p>CREATE PAGE</p>} />
        </Routes>
      </Providers>
    </MemoryRouter>,
  );
  return created;
}
const loaded = () => screen.findByRole('heading', { level: 1, name: 'The Silent Sitar' });
const stat = (label) => screen.getByText(label).nextElementSibling;
const scoreEl = () => stat('Score if correct now').querySelector('[data-score]');
const examineButtons = () => screen.getAllByRole('button', { name: /examine clue/i });
const toasts = () => screen.getByRole('region', { name: /notifications/i });

beforeEach(() => {
  mock.__reset();
  mock.__setLatency(0);
  vi.clearAllMocks();
});

describe('loading and layout', () => {
  it('shows a skeleton while the case loads, then the case', async () => {
    await open();
    expect(screen.getByRole('status', { name: /loading case/i })).toBeInTheDocument();
    await loaded();
    expect(screen.queryByRole('status', { name: /loading case/i })).toBeNull();
  });

  it('shows the header: title, difficulty, setting, progress, hints and score preview', async () => {
    await open();
    await loaded();
    expect(screen.getByText('Easy')).toHaveAttribute('data-tone', 'easy');
    expect(screen.getByText(/Ravindra Music College/)).toBeInTheDocument();
    expect(stat('Hints used')).toHaveTextContent('0 / 2');
    expect(scoreEl()).toHaveTextContent(/^100$/);
    await waitFor(() => expect(document.title).toBe('The Silent Sitar · AI Mystery Room'));
  });

  it('shows the story, 3 suspects and 5 face-down clues, and no clue text', async () => {
    const created = await open();
    await loaded();
    expect(screen.getByRole('heading', { level: 2, name: /the case file/i })).toBeInTheDocument();
    const suspects = screen.getByRole('region', { name: /suspects/i });
    expect(within(suspects).getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(within(suspects).getByText('Arjun Rao')).toBeInTheDocument();
    const evidence = screen.getByRole('region', { name: /evidence/i });
    expect(within(evidence).getAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(examineButtons()).toHaveLength(5);
    const secret = mock.__getDoc(created.id);
    for (const clue of secret.clues) expect(document.body.textContent).not.toContain(clue.description);
    expect(document.body.textContent).not.toContain(secret.solution.explanation);
  });

  it('has exactly one h1 and never skips a heading level', async () => {
    await open();
    await loaded();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('links to the accusation page from the header and from the sticky phone bar', async () => {
    const created = await open();
    await loaded();
    const links = screen.getAllByRole('link', { name: /make an accusation/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((a) => expect(a).toHaveAttribute('href', `/case/${created.id}/accuse`));
    expect(document.querySelector('[data-accuse-bar]')).not.toBeNull();
  });

  it('a case that is already part-way through shows its clues face up and its hints revealed', async () => {
    await open('easy', async (c) => {
      await mock.discoverClue(c.id, 'c1');
      await mock.requestHint(c.id);
    });
    await loaded();
    expect(screen.getByText(/fresh amber smear of rosin/i)).toBeInTheDocument();
    expect(examineButtons()).toHaveLength(4);
    expect(screen.getByText('Hint 1 of 2')).toBeInTheDocument();
    expect(stat('Hints used')).toHaveTextContent('1 / 2');
    expect(scoreEl()).toHaveTextContent(/^95$/);
  });
});

describe('examining clues', () => {
  it('Examine reveals the clue, updates progress and the score preview, and says "+5 clue found"', async () => {
    await open();
    await loaded();
    await userEvent.click(examineButtons()[0]);
    expect(await screen.findByText(/fresh amber smear of rosin/i)).toBeInTheDocument();
    expect(api.discoverClue).toHaveBeenCalledTimes(1);
    expect(api.discoverClue).toHaveBeenCalledWith(expect.any(String), 'c1');
    expect(examineButtons()).toHaveLength(4);
    expect(screen.getAllByRole('progressbar', { name: /clues found/i })[0]).toHaveAttribute('aria-valuenow', '1');
    expect(scoreEl()).toHaveTextContent(/^105$/);
    expect(toasts()).toHaveTextContent('+5 clue found');
    expect(toasts()).toHaveTextContent('Rosin smudge');
    expect(api.getCase).toHaveBeenCalledTimes(1); // updated from the reply, no refetch
  });

  it('examining a clue the server already had open reveals it without a "+5" toast', async () => {
    const created = await open();
    await loaded();
    await mock.discoverClue(created.id, 'c1'); // found elsewhere (another tab): this page still shows it sealed
    await userEvent.click(examineButtons()[0]);
    expect(await screen.findByText(/fresh amber smear of rosin/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('+5 clue found');
  });

  it('a double click examines once', async () => {
    await open();
    await loaded();
    await userEvent.dblClick(examineButtons()[1]);
    await screen.findByText(/stamped 7:12/i);
    expect(api.discoverClue).toHaveBeenCalledTimes(1);
  });

  it('every clue can be examined, one after another', async () => {
    await open();
    await loaded();
    for (let i = 0; i < 5; i++) {
      await userEvent.click(examineButtons()[0]);
      await waitFor(() => expect(screen.getAllByRole('progressbar', { name: /clues found/i })[0]).toHaveAttribute('aria-valuenow', String(i + 1)));
    }
    expect(screen.queryByRole('button', { name: /examine clue/i })).toBeNull();
    expect(scoreEl()).toHaveTextContent(/^125$/);
  });

  it('a failed examine shows an error toast, keeps the card face down and lets you try again', async () => {
    await open();
    await loaded();
    api.discoverClue.mockRejectedValueOnce({ status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' });
    await userEvent.click(examineButtons()[0]);
    await waitFor(() => expect(toasts()).toHaveTextContent('Cannot reach the server'));
    expect(toasts().querySelector('[data-tone="error"]')).not.toBeNull();
    expect(examineButtons()).toHaveLength(5);
    await userEvent.click(examineButtons()[0]);
    expect(await screen.findByText(/fresh amber smear of rosin/i)).toBeInTheDocument();
  });

  it('if the case was closed meanwhile (accused elsewhere), examining sends you to the result', async () => {
    const created = await open();
    await loaded();
    await mock.accuse(created.id, 's1'); // closed behind the page's back
    await userEvent.click(examineButtons()[0]);
    expect(await screen.findByText(`RESULT ${created.id}`)).toBeInTheDocument();
  });
});

describe('hints', () => {
  const takeHint = async (n) => {
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(`reveal hint ${n}`, 'i') }));
  };

  it('confirm first, then the hint appears, the counts move and the score preview drops by 10', async () => {
    await open();
    await loaded();
    await takeHint(1);
    expect(await screen.findByText('Hint 1 of 2')).toBeInTheDocument();
    expect(screen.getByText(/stick of rosin/i)).toBeInTheDocument();
    expect(api.requestHint).toHaveBeenCalledTimes(1);
    expect(stat('Hints used')).toHaveTextContent('1 / 2');
    expect(scoreEl()).toHaveTextContent(/^90$/);
    expect(toasts()).toHaveTextContent('Hint 1 revealed');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling the confirmation costs nothing', async () => {
    await open();
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));
    expect(api.requestHint).not.toHaveBeenCalled();
    expect(stat('Hints used')).toHaveTextContent('0 / 2');
  });

  it('after the last hint the button is disabled and says so', async () => {
    await open();
    await loaded();
    await takeHint(1);
    await screen.findByText('Hint 1 of 2');
    await takeHint(2);
    await screen.findByText('Hint 2 of 2');
    expect(screen.getByRole('button', { name: /no hints left/i })).toBeDisabled();
    expect(scoreEl()).toHaveTextContent(/^80$/);
  });

  it('a server refusal shows a friendly toast and re-syncs the case', async () => {
    await open();
    await loaded();
    api.requestHint.mockRejectedValueOnce({ status: 409, code: 'NO_HINTS_LEFT', message: 'raw server text' });
    await takeHint(1);
    await waitFor(() => expect(toasts()).toHaveTextContent('There are no hints left for this case.'));
    expect(toasts()).not.toHaveTextContent('raw server text');
    await waitFor(() => expect(api.getCase).toHaveBeenCalledTimes(2));
  });

  it('if the case was closed meanwhile, asking for a hint sends you to the result', async () => {
    const created = await open();
    await loaded();
    await mock.accuse(created.id, 's2');
    await takeHint(1);
    expect(await screen.findByText(`RESULT ${created.id}`)).toBeInTheDocument();
  });
});

describe('redirects and errors', () => {
  it.each(['s1', 's2'])('a case that is already closed (accused %s) goes straight to the result page', async (suspect) => {
    const created = await open('easy', (c) => mock.accuse(c.id, suspect));
    expect(await screen.findByText(`RESULT ${created.id}`)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'The Silent Sitar' })).toBeNull();
  });

  it('with motion on, a closed case still redirects cleanly (nothing to animate while redirecting)', async () => {
    setReducedMotion(false);
    const created = await open('easy', (c) => mock.accuse(c.id, 's1'));
    expect(await screen.findByText(`RESULT ${created.id}`)).toBeInTheDocument();
  });

  it.each([
    ['CASE_NOT_FOUND', 404, 'Case not found', "We couldn't find that case."],
    ['INVALID_ID', 400, 'Case not found', "That case link doesn't look right."],
    ['FORBIDDEN', 403, 'Not your case file', 'This case file belongs to another detective.'],
  ])('%s: a full-page message with a way to start a new mystery, and no retry button', async (code, status, title, text) => {
    api.getCase.mockRejectedValueOnce({ status, code, message: 'raw' });
    await open();
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: /start a new mystery/i }));
    expect(await screen.findByText('CREATE PAGE')).toBeInTheDocument();
  });

  it('a network failure can be retried, and retrying opens the case', async () => {
    api.getCase.mockRejectedValueOnce({ status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' });
    await open();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach the server');
    await userEvent.click(within(alert).getByRole('button', { name: /try again/i }));
    await loaded();
    expect(api.getCase).toHaveBeenCalledTimes(2);
  });
});
