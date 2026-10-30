import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Providers } from '../App.jsx';
import { setReducedMotion } from '../test/matchMedia.js';
import Accusation from './Accusation.jsx';

// Same approach as Investigation.test.jsx: the real mock game engine, wrapped in spies so one call can be made to fail.
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

// stands in for the results page: shows what the accusation page handed over
function ResultStub() {
  const { id } = useParams();
  const result = useLocation().state?.result;
  return <p>RESULT {id} {result ? `verdict:${result.verdict}` : 'no-state'}</p>;
}

async function open(prepare) {
  const created = await mock.createCase({ premise: PREMISE, difficulty: 'easy' });
  if (prepare) await prepare(created);
  render(
    <MemoryRouter initialEntries={[`/case/${created.id}/accuse`]}>
      <Providers>
        <Routes>
          <Route path="/case/:id/accuse" element={<Accusation />} />
          <Route path="/case/:id" element={<p>ROOM</p>} />
          <Route path="/case/:id/result" element={<ResultStub />} />
        </Routes>
      </Providers>
    </MemoryRouter>,
  );
  return created;
}
const loaded = () => screen.findByRole('heading', { level: 1, name: 'Make your accusation' });
const radio = (name) => screen.getByRole('radio', { name: new RegExp(name) });
const accuseButton = () => screen.getByRole('button', { name: /^accuse$/i });
const dialog = () => screen.findByRole('dialog');
const rejection = (code, status = 409) => Promise.reject({ status, code, message: 'x' });

beforeEach(() => {
  mock.__reset();
  mock.__setLatency(0);
  vi.clearAllMocks();
});

describe('Accusation: layout', () => {
  it('shows a skeleton while loading, then one h1 and the suspects as a radio group', async () => {
    await open();
    expect(screen.getByRole('status', { name: /loading case/i })).toBeInTheDocument();
    await loaded();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Make your accusation · AI Mystery Room');
    const group = screen.getByRole('radiogroup', { name: /suspects/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    for (const name of ['Meera Iyer', 'Arjun Rao', 'Kavya Nair']) expect(within(group).getByRole('radio', { name: new RegExp(name) })).toBeInTheDocument();
  });

  it('starts with nobody selected and the Accuse button disabled', async () => {
    await open();
    await loaded();
    for (const r of screen.getAllByRole('radio')) expect(r).not.toBeChecked();
    expect(accuseButton()).toBeDisabled();
    expect(screen.queryByText('Accused')).toBeNull();
  });

  it('gives each suspect their motive and alibi so the choice is informed', async () => {
    await open();
    await loaded();
    expect(screen.getByText(/owes a large sum to a collector/i)).toBeInTheDocument();
    expect(screen.getByText(/stepped out for chai/i)).toBeInTheDocument();
  });

  it('links back to the investigation', async () => {
    const created = await open();
    await loaded();
    expect(screen.getByRole('link', { name: /back to investigation/i })).toHaveAttribute('href', `/case/${created.id}`);
  });

  it('shows no solution, culprit id or explanation before the accusation', async () => {
    const created = await open();
    await loaded();
    const secret = mock.__getDoc(created.id);
    expect(document.body.textContent).not.toContain(secret.solution.explanation);
    expect(document.body.innerHTML).not.toContain('culpritId');
  });
});

describe('Accusation: choosing', () => {
  it('selecting a suspect checks them, stamps their card "Accused" and enables Accuse', async () => {
    await open();
    await loaded();
    await userEvent.click(radio('Arjun Rao'));
    expect(radio('Arjun Rao')).toBeChecked();
    expect(radio('Meera Iyer')).not.toBeChecked();
    expect(screen.getAllByText('Accused')).toHaveLength(1);
    expect(radio('Arjun Rao').closest('label')).toHaveTextContent('Accused');
    expect(accuseButton()).toBeEnabled();
  });

  it('only one suspect can be selected: choosing another moves the choice', async () => {
    await open();
    await loaded();
    await userEvent.click(radio('Arjun Rao'));
    await userEvent.click(radio('Kavya Nair'));
    expect(radio('Kavya Nair')).toBeChecked();
    expect(radio('Arjun Rao')).not.toBeChecked();
    expect(screen.getAllByText('Accused')).toHaveLength(1);
  });

  it('arrow keys move the selection from the keyboard', async () => {
    await open();
    await loaded();
    await userEvent.click(radio('Meera Iyer'));
    await userEvent.keyboard('{ArrowDown}');
    expect(radio('Arjun Rao')).toBeChecked();
    await userEvent.keyboard('{ArrowUp}');
    expect(radio('Meera Iyer')).toBeChecked();
  });

  it('the reasoning box is optional, labelled, limited to 300 characters and counted', async () => {
    await open();
    await loaded();
    const box = screen.getByRole('textbox', { name: /your reasoning/i });
    expect(box).toHaveAttribute('maxlength', '300');
    expect(screen.getByText('0 / 300')).toBeInTheDocument();
    await userEvent.type(box, 'The rosin gives it away');
    expect(screen.getByText('23 / 300')).toBeInTheDocument();
    expect(accuseButton()).toBeDisabled(); // reasoning alone never enables it
  });
});

describe('Accusation: confirming', () => {
  async function chooseAndAsk(name = 'Arjun Rao') {
    await userEvent.click(radio(name));
    await userEvent.click(accuseButton());
    return dialog();
  }

  it('asks once, by name: "You can accuse only once. Accuse {name}?"', async () => {
    await open();
    await loaded();
    const d = await chooseAndAsk();
    expect(within(d).getByText(/accuse arjun rao\?/i)).toBeInTheDocument();
    expect(within(d).getByText(/you can accuse only once/i)).toBeInTheDocument();
    expect(api.accuse).not.toHaveBeenCalled();
  });

  it('Cancel closes the dialog and sends nothing; the choice is kept', async () => {
    await open();
    await loaded();
    const d = await chooseAndAsk();
    await userEvent.click(within(d).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.accuse).not.toHaveBeenCalled();
    expect(radio('Arjun Rao')).toBeChecked();
  });

  it('Escape also closes the dialog without accusing', async () => {
    await open();
    await loaded();
    await chooseAndAsk();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.accuse).not.toHaveBeenCalled();
  });

  it('Confirm accuses that suspect and opens the result, carrying the answer along', async () => {
    const created = await open();
    await loaded();
    const d = await chooseAndAsk('Arjun Rao');
    await userEvent.click(within(d).getByRole('button', { name: /confirm|accuse arjun/i }));
    expect(await screen.findByText(`RESULT ${created.id} verdict:correct`)).toBeInTheDocument();
    expect(api.accuse).toHaveBeenCalledTimes(1);
    expect(api.accuse).toHaveBeenCalledWith(created.id, 's2');
  });

  it('a wrong accusation is accepted the same way', async () => {
    const created = await open();
    await loaded();
    const d = await chooseAndAsk('Meera Iyer');
    await userEvent.click(within(d).getByRole('button', { name: /confirm|accuse meera/i }));
    expect(await screen.findByText(`RESULT ${created.id} verdict:incorrect`)).toBeInTheDocument();
    expect(api.accuse).toHaveBeenCalledWith(created.id, 's1');
  });

  it('a second click while the first is still being answered sends nothing more', async () => {
    await open();
    await loaded();
    let finish;
    api.accuse.mockImplementationOnce((id, s) => new Promise((res) => { finish = () => res(mock.accuse(id, s)); }));
    const d = await chooseAndAsk();
    const confirm = within(d).getByRole('button', { name: /confirm/i });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(api.accuse).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText(/^RESULT/);
  });

  it('a double click on Confirm accuses once', async () => {
    await open();
    await loaded();
    const d = await chooseAndAsk();
    await userEvent.dblClick(within(d).getByRole('button', { name: /confirm|accuse arjun/i }));
    await screen.findByText(/^RESULT/);
    expect(api.accuse).toHaveBeenCalledTimes(1);
  });

  it('keeps the reasoning for the results page, and keeps nothing when it is empty', async () => {
    const created = await open();
    await loaded();
    await userEvent.type(screen.getByRole('textbox', { name: /your reasoning/i }), '  The rosin gives it away  ');
    const d = await chooseAndAsk();
    await userEvent.click(within(d).getByRole('button', { name: /confirm|accuse arjun/i }));
    await screen.findByText(/^RESULT/);
    expect(window.sessionStorage.getItem(`mr-reasoning:${created.id}`)).toBe('The rosin gives it away');
  });

  it('stores no reasoning when the box was left blank', async () => {
    const created = await open();
    await loaded();
    await userEvent.type(screen.getByRole('textbox', { name: /your reasoning/i }), '   ');
    const d = await chooseAndAsk();
    await userEvent.click(within(d).getByRole('button', { name: /confirm|accuse arjun/i }));
    await screen.findByText(/^RESULT/);
    expect(window.sessionStorage.getItem(`mr-reasoning:${created.id}`)).toBeNull();
  });

  it('never sends the reasoning to the server', async () => {
    await open();
    await loaded();
    await userEvent.type(screen.getByRole('textbox', { name: /your reasoning/i }), 'secret thoughts');
    const d = await chooseAndAsk();
    await userEvent.click(within(d).getByRole('button', { name: /confirm|accuse arjun/i }));
    await screen.findByText(/^RESULT/);
    expect(api.accuse.mock.calls[0]).toHaveLength(2);
    expect(JSON.stringify(api.accuse.mock.calls)).not.toContain('secret thoughts');
  });
});

describe('Accusation: when things go wrong', () => {
  it('"already completed" (another tab accused first) goes straight to the result, which fetches it itself', async () => {
    const created = await open();
    await loaded();
    api.accuse.mockImplementationOnce(() => rejection('CASE_ALREADY_COMPLETED'));
    await userEvent.click(radio('Arjun Rao'));
    await userEvent.click(accuseButton());
    await userEvent.click(within(await dialog()).getByRole('button', { name: /confirm|accuse arjun/i }));
    expect(await screen.findByText(`RESULT ${created.id} no-state`)).toBeInTheDocument();
  });

  it('any other failure shows a friendly toast, closes the dialog and leaves the player where they are', async () => {
    await open();
    await loaded();
    api.accuse.mockImplementationOnce(() => rejection('INTERNAL_ERROR', 500));
    await userEvent.click(radio('Arjun Rao'));
    await userEvent.click(accuseButton());
    await userEvent.click(within(await dialog()).getByRole('button', { name: /confirm|accuse arjun/i }));
    expect(await screen.findByText(/the server had a problem/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(radio('Arjun Rao')).toBeChecked();
    expect(screen.queryByText(/^RESULT/)).toBeNull();
    expect(accuseButton()).toBeEnabled(); // and they can try again
  });

  it('after a failure the player can confirm again, and the second try goes through', async () => {
    const created = await open();
    await loaded();
    api.accuse.mockImplementationOnce(() => rejection('INTERNAL_ERROR', 500));
    await userEvent.click(radio('Arjun Rao'));
    await userEvent.click(accuseButton());
    await userEvent.click(within(await dialog()).getByRole('button', { name: /confirm/i }));
    await screen.findByText(/the server had a problem/i);
    await userEvent.click(accuseButton());
    await userEvent.click(within(await dialog()).getByRole('button', { name: /confirm/i }));
    expect(await screen.findByText(`RESULT ${created.id} verdict:correct`)).toBeInTheDocument();
    expect(api.accuse).toHaveBeenCalledTimes(2);
  });

  it('with motion on, a closed case still redirects cleanly (nothing to animate while redirecting)', async () => {
    setReducedMotion(false);
    const created = await open(async (c) => { await mock.accuse(c.id, 's1'); });
    expect(await screen.findByText(`RESULT ${created.id} no-state`)).toBeInTheDocument();
  });

  it('a case that is already closed redirects to its result', async () => {
    const created = await open(async (c) => { await mock.accuse(c.id, 's1'); });
    expect(await screen.findByText(`RESULT ${created.id} no-state`)).toBeInTheDocument();
  });

  it.each([
    ['FORBIDDEN', 403, 'Not your case file'],
    ['CASE_NOT_FOUND', 404, 'Case not found'],
    ['INTERNAL_ERROR', 500, 'Could not open the case'],
  ])('%s while loading shows "%s" and still one h1', async (code, status, title) => {
    api.getCase.mockImplementationOnce(() => rejection(code, status));
    await open();
    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
