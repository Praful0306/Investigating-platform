import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authError, DANA, fakeBackend, renderAuth } from '../test/auth.jsx';
import Register from './Register.jsx';

vi.mock('../api/cases.js', () => ({ startSession: vi.fn().mockResolvedValue({ claimed: 0 }) }));

const routes = (
  <Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/login" element={<p>LOGIN PAGE</p>} />
    <Route path="/history" element={<p>HISTORY PAGE</p>} />
    <Route path="/create" element={<p>CREATE PAGE</p>} />
    <Route path="/" element={<p>HOME PAGE</p>} />
  </Routes>
);

let backend;
beforeEach(() => { backend = fakeBackend(null); });

const open = (path = '/register', b = backend) => renderAuth(routes, { path, backend: b });
const ready = () => screen.findByRole('heading', { level: 1, name: 'Create your account' });
const name = () => screen.getByLabelText('Name');
const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password');
const submit = () => screen.getByRole('button', { name: /^create account$/i });
async function fill(n = 'Dana Detective', e = 'dana@example.com', p = 'longenough1') {
  await userEvent.type(name(), n);
  await userEvent.type(email(), e);
  await userEvent.type(password(), p);
}

describe('Register: the page', () => {
  it('has one h1, name / email / password boxes, and both ways to sign up', async () => {
    open();
    await ready();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Create your account · AI Mystery Room');
    expect(name()).toHaveAttribute('autocomplete', 'name');
    expect(name()).toHaveAttribute('maxlength', '30');
    expect(email()).toHaveAttribute('autocomplete', 'username');
    expect(password()).toHaveAttribute('autocomplete', 'new-password');
    expect(submit()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('shows a skeleton while the sign-in service starts', () => {
    open();
    expect(screen.getByRole('status', { name: /loading sign-up/i })).toBeInTheDocument();
  });

  it('links to signing in, keeping where the person was headed', async () => {
    open('/register?next=/history');
    await ready();
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login?next=%2Fhistory');
  });

  it('with no sign-in service it says so and offers guest play', async () => {
    open('/register', null);
    expect(await screen.findByText(/isn't set up/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /play as a guest/i })).toHaveAttribute('href', '/create');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('someone already signed in is sent on', async () => {
    open('/register?next=/history', fakeBackend(DANA));
    expect(await screen.findByText('HISTORY PAGE')).toBeInTheDocument();
  });

  it('judges the password as it is typed, without ever showing it', async () => {
    open();
    await ready();
    expect(screen.queryByRole('meter')).toBeNull();
    await userEvent.type(password(), 'abc');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    await userEvent.clear(password());
    await userEvent.type(password(), 'correct horse battery');
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(password()).toHaveAttribute('type', 'password');
    expect(document.body.textContent).not.toContain('correct horse battery');
  });
});

describe('Register: checking the form first', () => {
  it('an empty form shows every reason and sends nothing', async () => {
    open();
    await ready();
    await userEvent.click(submit());
    expect(screen.getByText('Enter a name between 2 and 30 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(backend.signUp).not.toHaveBeenCalled();
  });

  it.each([
    ['a one-letter name', 'D', true],
    ['blank spaces as a name', '     ', true],
    ['a two-letter name', 'Di', false],
    ['a 30-letter name', 'D'.repeat(30), false],
  ])('%s', async (_n, value, bad) => {
    open();
    await ready();
    await userEvent.type(name(), value);
    await userEvent.click(submit());
    const error = screen.queryByText('Enter a name between 2 and 30 characters.');
    expect(Boolean(error)).toBe(bad);
  });

  it('a password of 7 characters is too short, 8 is enough', async () => {
    open();
    await ready();
    await fill('Dana', 'dana@example.com', 'abcdefg');
    await userEvent.click(submit());
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(backend.signUp).not.toHaveBeenCalled();
    await userEvent.type(password(), 'h');
    await userEvent.click(submit());
    expect(backend.signUp).toHaveBeenCalledTimes(1);
  });

  it('a malformed email is explained after the box is left', async () => {
    open();
    await ready();
    await userEvent.type(email(), 'nope');
    expect(screen.queryByText(/doesn't look like an email/i)).toBeNull();
    await userEvent.tab();
    expect(screen.getByText(/doesn't look like an email/i)).toBeInTheDocument();
  });

  it('puts the cursor on the first box that needs attention', async () => {
    open();
    await ready();
    await userEvent.click(submit());
    expect(name()).toHaveFocus();
    await userEvent.type(name(), 'Dana');
    await userEvent.click(submit());
    expect(email()).toHaveFocus();
    await userEvent.type(email(), 'dana@example.com');
    await userEvent.click(submit());
    expect(password()).toHaveFocus();
  });
});

describe('Register: creating the account', () => {
  it('sends the trimmed name and email and the password exactly as typed', async () => {
    open();
    await ready();
    await fill('  Dana Detective  ', '  dana@example.com ', 'my secret pass');
    await userEvent.click(submit());
    expect(backend.signUp).toHaveBeenCalledWith({ name: 'Dana Detective', email: 'dana@example.com', password: 'my secret pass' });
  });

  it('then goes home, or on to where the person was going', async () => {
    open('/register?next=/history');
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText('HISTORY PAGE')).toBeInTheDocument();
  });

  it.each(['https://evil.example', '//evil.example', '/register'])('ignores an unsafe next (%s)', async (next) => {
    open(`/register?next=${encodeURIComponent(next)}`);
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
  });

  it('a double click creates one account', async () => {
    open();
    await ready();
    await fill();
    await userEvent.dblClick(submit());
    await screen.findByText('HOME PAGE');
    expect(backend.signUp).toHaveBeenCalledTimes(1);
  });

  it('a second submit while the first is still being answered sends nothing more (even without the button)', async () => {
    let finish;
    backend.signUp.mockImplementation(() => new Promise((res) => { finish = () => res(DANA); }));
    open();
    await ready();
    await fill();
    const form = email().closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(backend.signUp).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText('HOME PAGE');
  });

  it('an email that is taken is explained under the email box, and the typed values stay', async () => {
    backend.signUp.mockRejectedValue(authError('auth/email-already-in-use'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(name()).toHaveValue('Dana Detective');
    expect(password()).toHaveValue('longenough1');
    expect(submit()).toBeEnabled();
  });

  it('a password Firebase finds weak is explained under the password box', async () => {
    backend.signUp.mockRejectedValue(authError('auth/weak-password'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText(/stronger password/i)).toBeInTheDocument();
    expect(password()).toHaveAttribute('aria-invalid', 'true');
  });

  it('a lost connection is explained for the whole form, never as a raw code', async () => {
    backend.signUp.mockRejectedValue(authError('auth/network-request-failed'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection/i);
    expect(screen.queryByText(/auth\//)).toBeNull();
  });

  it('typing in a box clears the error that was about it', async () => {
    backend.signUp.mockRejectedValueOnce(authError('auth/email-already-in-use'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    await screen.findByText(/already exists/i);
    await userEvent.type(email(), 'x');
    expect(screen.queryByText(/already exists/i)).toBeNull();
  });
});

describe('Register: Google', () => {
  it('signs up with Google and goes on', async () => {
    open('/register?next=/history');
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(backend.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('HISTORY PAGE')).toBeInTheDocument();
  });

  it('closing the Google window is not an error', async () => {
    backend.signInWithGoogle.mockRejectedValue(authError('auth/popup-closed-by-user'));
    open();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await vi.waitFor(() => expect(backend.signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a Google failure is explained', async () => {
    backend.signInWithGoogle.mockRejectedValue(authError('auth/account-exists-with-different-credential'));
    open();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/different sign-in method/i);
  });
});
