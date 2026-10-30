import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { DANA, fakeBackend, renderAuth } from '../test/auth.jsx';
import History from './History.jsx';

vi.mock('../api/cases.js', () => ({ listCases: vi.fn(), startSession: vi.fn().mockResolvedValue({ claimed: 0 }) }));
const { listCases } = await import('../api/cases.js');

const CASES = [
  { id: 'a'.repeat(24), title: 'The Silent Sitar', difficulty: 'easy', status: 'solved', score: 105, createdAt: '2026-10-31T10:00:00.000Z' },
  { id: 'b'.repeat(24), title: 'Vanishing Violin', difficulty: 'hard', status: 'failed', score: 0, createdAt: '2026-10-30T09:00:00.000Z' },
  { id: 'c'.repeat(24), title: 'The Midnight Ledger', difficulty: 'medium', status: 'active', score: null, createdAt: '2026-10-29T08:00:00.000Z' },
];

const routes = (
  <Routes>
    <Route path="/history" element={<History />} />
  </Routes>
);
const open = (backend = fakeBackend(null)) => {
  renderAuth(routes, { path: '/history', backend });
  return backend;
};
const loaded = () => screen.findByRole('heading', { level: 1, name: 'My cases' });
const item = (title) => screen.getByRole('link', { name: new RegExp(title) }).closest('li');
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  listCases.mockResolvedValue(CASES);
});

describe('History: the page', () => {
  it('has one h1 and a matching title', async () => {
    open();
    await loaded();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('My cases · AI Mystery Room');
  });

  it('shows a skeleton while the list loads', async () => {
    listCases.mockReturnValue(new Promise(() => {}));
    open();
    expect(await screen.findByRole('status', { name: /loading your cases/i })).toBeInTheDocument();
  });

  it('waits for the sign-in service before asking for the list (so the right account is asked)', async () => {
    open();
    expect(listCases).not.toHaveBeenCalled(); // the service is still starting
    await loaded();
    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(1));
  });
});

describe('History: the list', () => {
  it('shows every case in the order the server gave (newest first)', async () => {
    open();
    await screen.findByText('The Silent Sitar');
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names.findIndex((t) => /Silent Sitar/.test(t))).toBeLessThan(names.findIndex((t) => /Vanishing Violin/.test(t)));
    expect(names.findIndex((t) => /Vanishing Violin/.test(t))).toBeLessThan(names.findIndex((t) => /Midnight Ledger/.test(t)));
  });

  it('shows the difficulty and the state of each case in words', async () => {
    open();
    await screen.findByText('The Silent Sitar');
    expect(within(item('Silent Sitar')).getByText('Easy')).toHaveAttribute('data-tone', 'easy');
    expect(within(item('Silent Sitar')).getByText('Solved')).toHaveAttribute('data-tone', 'success');
    expect(within(item('Vanishing Violin')).getByText('Hard')).toHaveAttribute('data-tone', 'hard');
    expect(within(item('Vanishing Violin')).getByText('Unsolved')).toHaveAttribute('data-tone', 'danger');
    expect(within(item('Midnight Ledger')).getByText('Medium')).toHaveAttribute('data-tone', 'medium');
    expect(within(item('Midnight Ledger')).getByText('Active')).toBeInTheDocument();
  });

  it('shows the score of a finished case, including a real 0, and "Continue" for one still open', async () => {
    open();
    await screen.findByText('The Silent Sitar');
    expect(within(item('Silent Sitar')).getByText('105 pts')).toBeInTheDocument();
    expect(within(item('Vanishing Violin')).getByText('0 pts')).toBeInTheDocument();
    expect(within(item('Midnight Ledger')).queryByText(/pts/)).toBeNull();
    expect(within(item('Midnight Ledger')).getByText(/continue/i)).toBeInTheDocument();
  });

  it('an open case links to its room, a finished one to its result', async () => {
    open();
    await screen.findByText('The Silent Sitar');
    expect(screen.getByRole('link', { name: /Midnight Ledger/ })).toHaveAttribute('href', `/case/${'c'.repeat(24)}`);
    expect(screen.getByRole('link', { name: /Silent Sitar/ })).toHaveAttribute('href', `/case/${'a'.repeat(24)}/result`);
    expect(screen.getByRole('link', { name: /Vanishing Violin/ })).toHaveAttribute('href', `/case/${'b'.repeat(24)}/result`);
  });

  it('shows the date, readable, with the exact time for machines', async () => {
    open();
    await screen.findByText('The Silent Sitar');
    const time = within(item('Silent Sitar')).getByText(/2026/).closest('time');
    expect(time).toHaveAttribute('datetime', '2026-10-31T10:00:00.000Z');
  });

  it('copes with a bad date and unknown values without crashing', async () => {
    listCases.mockResolvedValue([{ id: 'd'.repeat(24), title: 'Odd one', difficulty: 'weird', status: 'strange', score: null, createdAt: 'not a date' }]);
    open();
    expect(await screen.findByText('Odd one')).toBeInTheDocument();
  });

  it('titles are shown as plain text, never as markup', async () => {
    listCases.mockResolvedValue([{ ...CASES[0], title: '<img src=x onerror=alert(1)>' }]);
    open();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows all 50 when there are 50', async () => {
    listCases.mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ ...CASES[0], id: i.toString(16).padStart(24, '0'), title: `Case number ${i}` })));
    open();
    await screen.findByText('Case number 0');
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
  });
});

describe('History: nothing yet, and trouble', () => {
  it('an empty list invites the first mystery', async () => {
    listCases.mockResolvedValue([]);
    open();
    expect(await screen.findByText(/no cases yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start your first mystery/i })).toHaveAttribute('href', '/create');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('a failed load is explained and can be retried', async () => {
    listCases.mockRejectedValueOnce({ status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server|connection/i);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('The Silent Sitar')).toBeInTheDocument();
    expect(listCases).toHaveBeenCalledTimes(2);
  });

  it('a problem that retrying cannot fix offers no retry button', async () => {
    listCases.mockRejectedValue({ status: 429, code: 'RATE_LIMITED', message: 'x' });
    open();
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('an expired sign-in (401) says to sign in again, with a link', async () => {
    listCases.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: 'x' });
    open();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/sign in/i);
    expect(within(alert).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login?next=%2Fhistory');
  });
});

describe('History: guests and accounts', () => {
  it('a guest is told the list is only this device, with ways to sign in', async () => {
    open(fakeBackend(null));
    await screen.findByText('The Silent Sitar');
    expect(screen.getByText(/playing as a guest/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login?next=%2Fhistory');
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register?next=%2Fhistory');
  });

  it('a signed-in person sees no guest banner', async () => {
    open(fakeBackend(DANA));
    await screen.findByText('The Silent Sitar');
    expect(screen.queryByText(/playing as a guest/i)).toBeNull();
  });

  it('with no sign-in service on the site there is no banner (nothing to offer)', async () => {
    open(null);
    await screen.findByText('The Silent Sitar');
    expect(screen.queryByText(/playing as a guest/i)).toBeNull();
  });

  it('signing in refreshes the list (the account\'s cases replace the guest\'s)', async () => {
    const backend = open(fakeBackend(null));
    await screen.findByText('The Silent Sitar');
    listCases.mockResolvedValue([{ ...CASES[0], id: 'e'.repeat(24), title: 'Case from my account' }]);
    await backend.emit(DANA);
    expect(await screen.findByText('Case from my account')).toBeInTheDocument();
    expect(screen.queryByText('The Silent Sitar')).toBeNull();
    expect(screen.queryByText(/playing as a guest/i)).toBeNull();
  });

  it('signing out refreshes it again', async () => {
    const backend = open(fakeBackend(DANA));
    await screen.findByText('The Silent Sitar');
    listCases.mockResolvedValue([]);
    await backend.emit(null);
    expect(await screen.findByText(/no cases yet/i)).toBeInTheDocument();
  });

  it('a slow answer for the old person never replaces the newer list', async () => {
    const slow = deferred();
    listCases.mockReturnValueOnce(slow.promise);
    const backend = open(fakeBackend(null));
    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(1));
    listCases.mockResolvedValue([{ ...CASES[0], title: 'Fresh list' }]);
    await backend.emit(DANA);
    await screen.findByText('Fresh list');
    slow.resolve([{ ...CASES[0], title: 'Stale list' }]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Fresh list')).toBeInTheDocument();
    expect(screen.queryByText('Stale list')).toBeNull();
  });
});
