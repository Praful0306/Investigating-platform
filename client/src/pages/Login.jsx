import { useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { authMessage } from '../auth/errors.js';
import { AuthShell } from '../components/auth/AuthShell.jsx';
import { ForgotPasswordDialog } from '../components/auth/ForgotPasswordDialog.jsx';
import { GoogleButton } from '../components/auth/GoogleButton.jsx';
import { PasswordField } from '../components/auth/PasswordField.jsx';
import { TextField } from '../components/auth/TextField.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ErrorBanner } from '../components/ui/ErrorBanner.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { isEmail } from '../lib/validate.js';
import { safeNext } from '../lib/safe-next.js';

function check({ email, password }) {
  const found = {};
  if (!email.trim()) found.email = 'Enter your email address.';
  else if (!isEmail(email)) found.email = authMessage({ code: 'auth/invalid-email' }).message;
  if (!password) found.password = 'Enter your password.';
  return found;
}

export default function Login() {
  const { status, signIn, signInWithGoogle, resetPassword } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const busy = useRef(false);
  const [values, setValues] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState(false); // the email box has been left once
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState({ field: null, message: '' }); // what the sign-in service said
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [forgot, setForgot] = useState(false);
  useDocumentTitle('Sign in');

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading sign-in" className="mx-auto max-w-md px-4 py-16">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }
  if (status === 'signedIn') return <Navigate to={next} replace />;
  if (status === 'unavailable') {
    return (
      <AuthShell title="Sign in" subtitle="Accounts are optional.">
        <p className="text-zinc-200">Sign-in isn&apos;t set up on this site yet, but every case is fully playable as a guest.</p>
        <Button as={Link} to="/create" size="lg" className="mt-6 w-full">Play as a guest</Button>
      </AuthShell>
    );
  }

  const live = check(values);
  const shown = {
    email: (submitted || touched ? live.email : undefined) ?? (server.field === 'email' ? server.message : undefined),
    password: (submitted ? live.password : undefined) ?? (server.field === 'password' ? server.message : undefined),
  };
  const formError = server.field === null ? server.message : '';

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setServer((s) => (s.field === field || s.field === null ? { field: null, message: '' } : s));
  };

  async function submit(e) {
    e.preventDefault();
    if (busy.current) return;
    setSubmitted(true);
    const found = check(values);
    if (found.email) { emailRef.current?.focus(); return; }
    if (found.password) { passwordRef.current?.focus(); return; }
    busy.current = true;
    setPending(true);
    setServer({ field: null, message: '' });
    try {
      await signIn({ email: values.email.trim(), password: values.password });
      // success: the status flips to signedIn and the redirect above takes the person on (busy stays set)
    } catch (err) {
      const { field, message, silent } = authMessage(err);
      if (!silent) setServer({ field, message });
      busy.current = false;
      setPending(false);
    }
  }

  async function google() {
    if (busy.current) return;
    busy.current = true;
    setGooglePending(true);
    setServer({ field: null, message: '' });
    try {
      await signInWithGoogle();
    } catch (err) {
      const { message, silent } = authMessage(err);
      if (!silent) setServer({ field: null, message });
      busy.current = false;
      setGooglePending(false);
    }
  }

  const registerHref = next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell title="Sign in" subtitle="Welcome back, detective.">
      <GoogleButton loading={googlePending} onClick={google} />

      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-mist" aria-hidden="true">
        <span className="h-px flex-1 bg-edge" /> or with email <span className="h-px flex-1 bg-edge" />
      </div>

      <form noValidate onSubmit={submit} className="space-y-4">
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          onChange={change('email')}
          onBlur={() => setTouched(true)}
          error={shown.email}
        />
        <PasswordField ref={passwordRef} label="Password" autoComplete="current-password" value={values.password} onChange={change('password')} error={shown.password} />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setForgot(true)}
            className="min-h-11 cursor-pointer rounded-chip px-1 text-sm font-medium text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Forgot password?
          </button>
        </div>

        {formError && <ErrorBanner message={formError} />}

        <Button type="submit" size="lg" loading={pending} className="w-full">Sign in</Button>
      </form>

      <p className="mt-6 text-center text-sm text-mist">
        New here? <Link to={registerHref} className="font-medium text-amber hover:underline">Create an account</Link>
      </p>

      {/* mounted only while open: every opening starts clean, with whatever email was typed on the page */}
      {forgot && <ForgotPasswordDialog open onClose={() => setForgot(false)} initialEmail={values.email.trim()} resetPassword={resetPassword} />}
    </AuthShell>
  );
}
