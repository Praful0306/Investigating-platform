import { useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { authMessage } from '../auth/errors.js';
import { AuthShell } from '../components/auth/AuthShell.jsx';
import { GoogleButton } from '../components/auth/GoogleButton.jsx';
import { PasswordField } from '../components/auth/PasswordField.jsx';
import { TextField } from '../components/auth/TextField.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ErrorBanner } from '../components/ui/ErrorBanner.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { MIN_PASSWORD } from '../lib/password.js';
import { safeNext } from '../lib/safe-next.js';
import { isEmail } from '../lib/validate.js';

const NAME_MSG = 'Enter a name between 2 and 30 characters.';

function check({ name, email, password }) {
  const found = {};
  const length = Array.from(name.trim()).length;
  if (length < 2 || length > 30) found.name = NAME_MSG;
  if (!email.trim()) found.email = 'Enter your email address.';
  else if (!isEmail(email)) found.email = authMessage({ code: 'auth/invalid-email' }).message;
  if (Array.from(password).length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters.`;
  return found;
}

export default function Register() {
  const { status, signUp, signInWithGoogle } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const busy = useRef(false);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [emailLeft, setEmailLeft] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState({ field: null, message: '' });
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  useDocumentTitle('Create your account');

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading sign-up" className="mx-auto max-w-md px-4 py-16">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-6 h-80" />
      </div>
    );
  }
  if (status === 'signedIn') return <Navigate to={next} replace />;
  if (status === 'unavailable') {
    return (
      <AuthShell title="Create your account" subtitle="Accounts are optional.">
        <p className="text-zinc-200">Sign-up isn&apos;t set up on this site yet, but every case is fully playable as a guest.</p>
        <Button as={Link} to="/create" size="lg" className="mt-6 w-full">Play as a guest</Button>
      </AuthShell>
    );
  }

  const live = check(values);
  const serverFor = (field) => (server.field === field ? server.message : undefined);
  const shown = {
    name: (submitted ? live.name : undefined) ?? serverFor('name'),
    email: (submitted || emailLeft ? live.email : undefined) ?? serverFor('email'),
    password: (submitted ? live.password : undefined) ?? serverFor('password'),
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
    const first = found.name ? nameRef : found.email ? emailRef : found.password ? passwordRef : null;
    if (first) { first.current?.focus(); return; }
    busy.current = true;
    setPending(true);
    setServer({ field: null, message: '' });
    try {
      await signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password });
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

  const loginHref = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell title="Create your account" subtitle="Keep every case you play, on every device.">
      <GoogleButton loading={googlePending} onClick={google} />

      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-mist" aria-hidden="true">
        <span className="h-px flex-1 bg-edge" /> or with email <span className="h-px flex-1 bg-edge" />
      </div>

      <form noValidate onSubmit={submit} className="space-y-4">
        <TextField ref={nameRef} label="Name" autoComplete="name" maxLength={30} value={values.name} onChange={change('name')} error={shown.name} />
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
          onBlur={() => setEmailLeft(true)}
          error={shown.email}
        />
        <PasswordField
          ref={passwordRef}
          showStrength
          label="Password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={values.password}
          onChange={change('password')}
          error={shown.password}
        />

        {formError && <ErrorBanner message={formError} />}

        <Button type="submit" size="lg" loading={pending} className="w-full">Create account</Button>
      </form>

      <p className="mt-6 text-center text-sm text-mist">
        Already have an account? <Link to={loginHref} className="font-medium text-amber hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
