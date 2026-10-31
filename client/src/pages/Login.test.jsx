import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { authError, DANA, fakeBackend, renderAuth } from '../test/auth.jsx';
import Login from './Login.jsx';

vi.mock('../api/cases.js', () => ({ startSession: vi.fn().mockResolvedValue({ claimed: 0 }) }));

const routes = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<p>REGISTER PAGE</p>} />
    <Route path="/history" element={<p>HISTORY PAGE</p>} />
    <Route path="/create" element={<p>CREATE PAGE</p>} />
    <Route path="/" element={<p>HOME PAGE</p>} />
  </Routes>
);

let backend;
beforeEach(() => { backend = fakeBackend(null); });

const open = (path = '/login', b = backend) => renderAuth(routes, { path, backend: b });
const ready = () => screen.findByRole('heading', { level: 1, name: 'Sign in' });
const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password');
const submit = () => screen.getByRole('button', { name: /^sign in$/i });
async function fill(e = 'dana@example.com', p = 'longenough1') {
  await userEvent.type(email(), e);
  await userEvent.type(password(), p);
}

describe('Login: the page', () => {
  it('has one h1, a title, an email and a password box, and both ways to sign in', async () => {
    open();
    await ready();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(document.title).toBe('Sign in · AI Mystery Room'));
    expect(email()).toHaveAttribute('autocomplete', 'username');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(submit()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('shows a skeleton while the sign-in service starts', () => {
    open();
    expect(screen.getByRole('status', { name: /loading sign-in/i })).toBeInTheDocument();
  });

  it('links to creating an account, keeping where the person was headed', async () => {
    open('/login?next=/history');
    await ready();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register?next=%2Fhistory');
  });

  it('with no sign-in service it says so, offers guest play, and shows no form', async () => {
    open('/login', null);
    expect(await screen.findByText(/isn't set up/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /play as a guest/i })).toHaveAttribute('href', '/create');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('someone who is already signed in is sent on, not shown the form', async () => {
    open('/login?next=/history', fakeBackend(DANA));
    expect(await screen.findByText('HISTORY PAGE')).toBeInTheDocument();
  });
});

describe('Login: checking the form before asking anyone', () => {
  it('an empty form shows both reasons and sends nothing', async () => {
    open();
    await ready();
    await userEvent.click(submit());
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(backend.signIn).not.toHaveBeenCalled();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
  });

  it('a malformed email is explained, and only after the person has left the box (not while typing)', async () => {
    open();
    await ready();
    await userEvent.type(email(), 'not-an-email');
    expect(screen.queryByText(/doesn't look like an email/i)).toBeNull();
    await userEvent.tab();
    expect(screen.getByText(/doesn't look like an email/i)).toBeInTheDocument();
  });

  it('the error goes away once the problem is fixed', async () => {
    open();
    await ready();
    await userEvent.click(submit());
    await userEvent.type(email(), 'dana@example.com');
    expect(screen.queryByText('Enter your email address.')).toBeNull();
  });

  it('puts the cursor on the first box that needs attention', async () => {
    open();
    await ready();
    await userEvent.click(submit());
    expect(email()).toHaveFocus();
    await userEvent.type(email(), 'dana@example.com');
    await userEvent.click(submit());
    expect(password()).toHaveFocus();
  });
});

describe('Login: signing in', () => {
  it('sends the trimmed email and the password exactly as typed', async () => {
    open();
    await ready();
    await fill('  dana@example.com  ', '  spaced password  ');
    await userEvent.click(submit());
    expect(backend.signIn).toHaveBeenCalledWith({ email: 'dana@example.com', password: '  spaced password  ' });
  });

  it('then goes home by default', async () => {
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
  });

  it('or back to where the person was going (?next=)', async () => {
    open('/login?next=/history');
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText('HISTORY PAGE')).toBeInTheDocument();
  });

  it.each(['https://evil.example', '//evil.example', '/login', 'javascript:alert(1)'])('ignores an unsafe next (%s) and goes home', async (next) => {
    open(`/login?next=${encodeURIComponent(next)}`);
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
  });

  it('a double click signs in once', async () => {
    open();
    await ready();
    await fill();
    await userEvent.dblClick(submit());
    await screen.findByText('HOME PAGE');
    expect(backend.signIn).toHaveBeenCalledTimes(1);
  });

  it('a second submit while the first is still being answered sends nothing more (even without the button)', async () => {
    let finish;
    backend.signIn.mockImplementation(() => new Promise((res) => { finish = () => res(DANA); }));
    open();
    await ready();
    await fill();
    const form = email().closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(backend.signIn).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText('HOME PAGE');
  });

  it('a sign-in that fails only because a pop-up was closed shows nothing', async () => {
    backend.signIn.mockRejectedValue(authError('auth/popup-closed-by-user'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    await vi.waitFor(() => expect(backend.signIn).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submit()).toBeEnabled();
  });

  it('while waiting, the button shows it is busy', async () => {
    let finish;
    backend.signIn.mockImplementation(() => new Promise((res) => { finish = () => res(DANA); }));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(submit()).toHaveAttribute('aria-busy', 'true');
    expect(submit()).toBeDisabled();
    finish();
    await screen.findByText('HOME PAGE');
  });

  it('a wrong password is a plain sentence, the typed values stay, and the form is usable again', async () => {
    backend.signIn.mockRejectedValue(authError('auth/invalid-credential'));
    open();
    await ready();
    await fill('dana@example.com', 'wrong-password');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent("That email and password don't match.");
    expect(email()).toHaveValue('dana@example.com');
    expect(password()).toHaveValue('wrong-password');
    expect(submit()).toBeEnabled();
    expect(screen.queryByText(/auth\/|firebase/i)).toBeNull();
  });

  it('an error that belongs to the email box is shown under it', async () => {
    backend.signIn.mockRejectedValue(authError('auth/invalid-email'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByText(/doesn't look like an email/i)).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
  });

  it('too many attempts and a lost connection are explained', async () => {
    backend.signIn.mockRejectedValueOnce(authError('auth/too-many-requests'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('an unknown failure never shows the raw message', async () => {
    backend.signIn.mockRejectedValue(new Error('Firebase: apiKey=AIzaSECRET internal'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(document.body.textContent).not.toContain('AIzaSECRET');
  });

  it('an old error is cleared when the person tries again', async () => {
    backend.signIn.mockRejectedValueOnce(authError('auth/invalid-credential'));
    open();
    await ready();
    await fill();
    await userEvent.click(submit());
    await screen.findByRole('alert');
    await userEvent.click(submit());
    await screen.findByText('HOME PAGE');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Login: Google', () => {
  it('signs in with Google and goes on', async () => {
    open('/login?next=/history');
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
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });

  it('a blocked pop-up is explained', async () => {
    backend.signInWithGoogle.mockRejectedValue(authError('auth/popup-blocked'));
    open();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pop-ups/i);
  });

  it('a double click opens one Google window', async () => {
    open();
    await ready();
    await userEvent.dblClick(screen.getByRole('button', { name: /continue with google/i }));
    await screen.findByText('HOME PAGE');
    expect(backend.signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('Login: forgot password', () => {
  const askForReset = async () => {
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    return screen.findByRole('dialog', { name: /reset your password/i });
  };

  it('opens a small dialog with the email box (filled in if it was already typed)', async () => {
    open();
    await ready();
    await userEvent.type(email(), 'dana@example.com');
    const dialog = await askForReset();
    expect(within(dialog).getByLabelText('Email')).toHaveValue('dana@example.com');
  });

  it('sends the reset link and says so, without revealing whether the account exists', async () => {
    open();
    await ready();
    const dialog = await askForReset();
    await userEvent.type(within(dialog).getByLabelText('Email'), ' dana@example.com ');
    await userEvent.click(within(dialog).getByRole('button', { name: /send reset link/i }));
    expect(backend.resetPassword).toHaveBeenCalledWith('dana@example.com');
    expect(await within(dialog).findByText(/if an account exists/i)).toBeInTheDocument();
  });

  it('an unknown account looks exactly the same (Firebase reports success either way; we add nothing)', async () => {
    backend.resetPassword.mockRejectedValue(authError('auth/user-not-found'));
    open();
    await ready();
    const dialog = await askForReset();
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ghost@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: /send reset link/i }));
    expect(await within(dialog).findByText(/if an account exists/i)).toBeInTheDocument();
  });

  it('a malformed email is explained and nothing is sent', async () => {
    open();
    await ready();
    const dialog = await askForReset();
    await userEvent.type(within(dialog).getByLabelText('Email'), 'nope');
    await userEvent.click(within(dialog).getByRole('button', { name: /send reset link/i }));
    expect(within(dialog).getByText(/doesn't look like an email/i)).toBeInTheDocument();
    expect(backend.resetPassword).not.toHaveBeenCalled();
  });

  it('a lost connection is explained inside the dialog', async () => {
    backend.resetPassword.mockRejectedValue(authError('auth/network-request-failed'));
    open();
    await ready();
    const dialog = await askForReset();
    await userEvent.type(within(dialog).getByLabelText('Email'), 'dana@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: /send reset link/i }));
    expect(await within(dialog).findByText(/can't reach the sign-in service/i)).toBeInTheDocument();
  });

  it('Escape closes it and the page behind is untouched', async () => {
    open();
    await ready();
    await askForReset();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(email()).toBeInTheDocument();
  });
});
