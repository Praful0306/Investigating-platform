import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { listCases } from '../api/cases.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { DIFFICULTY } from '../config/difficulty.js';
import { useAuth } from '../context/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { cn } from '../lib/cn.js';
import { toApiError } from '../api/http.js';

const STATUS = {
  active: { label: 'Active', tone: 'neutral' },
  solved: { label: 'Solved', tone: 'success' },
  failed: { label: 'Unsolved', tone: 'danger' },
};
const SIGN_IN = '/login?next=%2Fhistory';
const REGISTER = '/register?next=%2Fhistory';

const date = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

function CaseRow({ c }) {
  const status = STATUS[c.status] ?? STATUS.active;
  const open = c.status === 'active';
  const day = date(c.createdAt);
  return (
    <li>
      <Link
        to={open ? `/case/${c.id}` : `/case/${c.id}/result`}
        className="surface-felt group flex flex-wrap items-center gap-x-5 gap-y-3 p-5 transition duration-200 ease-out-expo hover:border-amber/40 hover:shadow-lamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-display text-xl font-bold leading-tight">{c.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={c.difficulty}>{DIFFICULTY[c.difficulty]?.label ?? c.difficulty}</Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
            {day && <time dateTime={c.createdAt} className="font-mono text-xs text-mist">{day}</time>}
          </p>
        </div>
        <p className={cn('inline-flex items-center gap-2 font-mono text-sm', open ? 'text-amber' : 'text-zinc-200')}>
          {open ? 'Continue' : `${c.score ?? 0} pts`}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </p>
      </Link>
    </li>
  );
}

export default function History() {
  const { status, user } = useAuth();
  const [view, setView] = useState({ key: null, cases: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useDocumentTitle('My cases');

  // The list belongs to whoever is signed in (or to this browser, as a guest): ask again whenever that changes.
  const key = status === 'loading' ? null : `${user?.id ?? 'guest'}:${attempt}`;
  useEffect(() => {
    if (key === null) return undefined;
    let active = true;
    listCases().then(
      (cases) => active && setView({ key, cases, error: null }),
      (err) => active && setView({ key, cases: null, error: toApiError(err) }),
    );
    return () => { active = false; };
  }, [key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = key !== null && view.key === key ? view : null; // an answer for someone else is not an answer yet

  let body;
  if (!current) {
    body = (
      <div role="status" aria-label="Loading your cases" className="space-y-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  } else if (current.error) {
    body = (
      <ErrorState
        title="Could not load your cases"
        error={current.error}
        onRetry={retry}
        actions={current.error.code === 'UNAUTHORIZED' ? <Button as={Link} to={SIGN_IN}>Sign in</Button> : undefined}
      />
    );
  } else if (current.cases.length === 0) {
    body = (
      <div className="surface-felt flex flex-col items-center gap-3 p-10 text-center">
        <FolderOpen aria-hidden="true" className="size-10 text-amber" />
        <h2 className="font-display text-2xl font-bold">No cases yet</h2>
        <p className="max-w-sm text-mist">Describe a crime and an AI writes you a mystery to solve.</p>
        <Button as={Link} to="/create" size="lg" className="mt-2">Start your first mystery</Button>
      </div>
    );
  } else {
    body = <ul className="space-y-4">{current.cases.map((c) => <CaseRow key={c.id} c={c} />)}</ul>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-14">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">Your files</p>
      <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">My cases</h1>

      {status === 'signedOut' && (
        <p className="surface-felt mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm text-zinc-300">
          <span>You&apos;re playing as a guest, so this list is only on this device.</span>
          <span className="flex gap-4 font-medium">
            <Link to={SIGN_IN} className="text-amber hover:underline">Sign in</Link>
            <Link to={REGISTER} className="text-amber hover:underline">Create an account</Link>
          </span>
        </p>
      )}

      <div className="mt-8">{body}</div>
    </section>
  );
}
