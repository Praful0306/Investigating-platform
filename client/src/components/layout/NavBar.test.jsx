import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authError, DANA, fakeBackend, renderAuth } from '../../test/auth.jsx';
import { NavBar } from './NavBar.jsx';

vi.mock('../../api/cases.js', () => ({ startSession: vi.fn().mockResolvedValue({ claimed: 0 }) }));

const routes = <Routes><Route path="*" element={<NavBar />} /></Routes>;
const open = (backend = fakeBackend(null), path = '/create') => {
  renderAuth(routes, { path, backend });
  return backend;
};
const nav = () => screen.getByRole('navigation', { name: /main/i });
const accountButton = () => screen.findByRole('button', { name: /account menu/i });

beforeEach(() => vi.clearAllMocks());

describe('NavBar: always there', () => {
  it('has the logo home, New mystery and My cases', async () => {
    open();
    expect(within(nav()).getByRole('link', { name: 'AI Mystery Room' })).toHaveAttribute('href', '/');
    expect(within(nav()).getByRole('link', { name: 'New mystery' })).toHaveAttribute('href', '/create');
    expect(within(nav()).getByRole('link', { name: 'My cases' })).toHaveAttribute('href', '/history');
  });
});

describe('NavBar: signed out', () => {
  it('offers Sign in, remembering the page the person is on', async () => {
    open(fakeBackend(null), '/create');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fcreate');
  });

  it('on the home page the link has no ?next', async () => {
    open(fakeBackend(null), '/');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it.each(['/login', '/register'])('on %s it does not point back at itself with a next', async (path) => {
    open(fakeBackend(null), path);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows no account menu', async () => {
    open();
    await screen.findByRole('link', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull();
  });
});

describe('NavBar: other states', () => {
  it('while the sign-in service starts, neither Sign in nor an account menu flashes up', () => {
    open();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull();
  });

  it('with no sign-in service on the site there is nothing to sign in to', async () => {
    open(null);
    await waitFor(() => expect(screen.getByRole('link', { name: 'New mystery' })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });
});

describe('NavBar: signed in', () => {
  it('shows an account button named after the person, and no Sign in link', async () => {
    open(fakeBackend(DANA));
    const button = await accountButton();
    expect(button).toHaveAccessibleName(/dana detective/i);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('opens a menu with who you are, My cases and Sign out', async () => {
    open(fakeBackend(DANA));
    const button = await accountButton();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Dana Detective')).toBeInTheDocument();
    expect(within(menu).getByText('dana@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /my cases/i })).toHaveAttribute('href', '/history');
    expect(within(menu).getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('the menu is not in the page until it is opened', async () => {
    open(fakeBackend(DANA));
    await accountButton();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('the button opens and closes the menu', async () => {
    open(fakeBackend(DANA));
    const button = await accountButton();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape closes it and puts the focus back on the button', async () => {
    open(fakeBackend(DANA));
    const button = await accountButton();
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('a click anywhere else closes it', async () => {
    open(fakeBackend(DANA));
    await userEvent.click(await accountButton());
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('choosing My cases closes the menu', async () => {
    open(fakeBackend(DANA));
    await userEvent.click(await accountButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /my cases/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Sign out signs out, closes the menu, and the bar offers Sign in again', async () => {
    const backend = fakeBackend(DANA);
    backend.signOut.mockImplementation(async () => { backend.subs.forEach((cb) => cb(null)); });
    open(backend);
    await userEvent.click(await accountButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(backend.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a failed sign-out says so and keeps the person signed in', async () => {
    const backend = fakeBackend(DANA);
    backend.signOut.mockRejectedValue(authError('auth/network-request-failed'));
    open(backend);
    await userEvent.click(await accountButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(await screen.findByText(/couldn't sign you out/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument();
  });

  it('the initials are decoration; the name is what screen readers get', async () => {
    open(fakeBackend(DANA));
    const button = await accountButton();
    expect(button.querySelector('[data-avatar]')).toHaveAttribute('aria-hidden', 'true');
    expect(button.querySelector('[data-avatar]')).toHaveTextContent('DD');
  });
});
