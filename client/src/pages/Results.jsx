import { useRef } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Check, Plus, Share2, X } from 'lucide-react';
import { CaseError } from '../components/case/CaseError.jsx';
import { ScoreBreakdown } from '../components/case/ScoreBreakdown.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/useToast.js';
import { DIFFICULTY } from '../config/difficulty.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useResult } from '../hooks/useResult.js';
import { hueOf, initialsOf } from '../lib/avatar.js';
import { cn } from '../lib/cn.js';
import { gsap, useGSAP } from '../lib/gsap.js';

const STAMP_REST = 'rotate(-6deg)';

function readNote(id) {
  try {
    return window.sessionStorage.getItem(`mr-reasoning:${id}`) ?? '';
  } catch {
    return '';
  }
}

function ResultSkeleton() {
  return (
    <div role="status" aria-label="Loading result" className="mx-auto max-w-4xl px-4 pb-20 pt-12">
      <Skeleton className="h-16 w-44" />
      <Skeleton className="mt-6 h-14 w-3/4" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="mt-8 h-56" />
    </div>
  );
}

function Person({ label, name, role, tone, id }) {
  const hue = hueOf(name);
  return (
    <section aria-labelledby={id} className={cn('surface-felt border-2 p-5', tone === 'good' ? 'border-moss/50' : 'border-blood/50')}>
      <h2 id={id} className="font-mono text-xs uppercase tracking-[0.25em] text-mist">{label}</h2>
      <div className="mt-4 flex items-center gap-4">
        <span
          aria-hidden="true"
          style={{ '--h': hue, '--h2': (hue + 40) % 360 }}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,hsl(var(--h)_55%_42%),hsl(var(--h2)_60%_26%))] font-display text-xl font-bold text-white shadow-card"
        >
          {initialsOf(name)}
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-tight">{name}</p>
          {role && <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{role}</p>}
        </div>
      </div>
    </section>
  );
}

export default function Results() {
  const { id } = useParams();
  const location = useLocation();
  const { data, loading, error, refresh } = useResult(id, location.state?.result);
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const root = useRef(null);
  useDocumentTitle('Case result');

  useGSAP(() => {
    if (reduced || !data || !root.current) return; // no page on screen while redirecting or failing
    gsap.fromTo('[data-stamp]', { scale: 1.4, rotation: -14, opacity: 0 }, { scale: 1, rotation: -6, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    gsap.from(root.current.querySelectorAll('[data-reveal]'), { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.25, clearProps: 'opacity,transform' });
  }, { scope: root, dependencies: [reduced, Boolean(data)] });

  if (error?.code === 'CASE_NOT_COMPLETED') return <Navigate to={`/case/${id}`} replace />;
  if (error && !data) return <CaseError error={error} heading="Case result" onRetry={refresh} />;
  if (loading || !data) return <ResultSkeleton />;

  const solved = data.verdict === 'correct';
  const note = readNote(id);
  const shareText = solved
    ? `I solved '${data.title}' on AI Mystery Room — ${data.score.total} pts`
    : `I couldn't crack '${data.title}' on AI Mystery Room — ${data.score.total} pts`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AI Mystery Room', text: shareText });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        toast({ title: 'Copied to clipboard', description: shareText, tone: 'success' });
      } else {
        throw new Error('no way to share');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // the player closed the share sheet: nothing went wrong
      toast({ title: "Couldn't share", description: `You can copy this yourself: ${shareText}`, tone: 'error' });
    }
  }

  return (
    <div ref={root} className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:pt-14">
      <header data-reveal>
        <span
          data-stamp
          data-tone={solved ? 'success' : 'danger'}
          aria-hidden="true"
          style={{ transform: STAMP_REST }}
          className={cn(
            'inline-block rounded-chip border-4 border-double px-5 py-2 font-display text-3xl font-black uppercase tracking-[0.2em]',
            solved ? 'border-moss text-moss' : 'border-blood text-blood-soft',
          )}
        >
          {solved ? 'Solved' : 'Unsolved'}
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-5xl">
          {solved ? 'Case closed — you got it!' : 'The culprit got away.'}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-lg text-mist">
          <span>{data.title}</span>
          <Badge tone={data.difficulty}>{DIFFICULTY[data.difficulty]?.label ?? data.difficulty}</Badge>
        </p>
      </header>

      <div data-reveal className="mt-10 grid gap-4 sm:grid-cols-2">
        <Person id="accused-title" label="You accused" name={data.accused.name} tone={solved ? 'good' : 'bad'} />
        <Person id="culprit-title" label="The culprit" name={data.culprit.name} role={data.culprit.role} tone="good" />
      </div>

      <section data-reveal aria-labelledby="explanation-title" className="surface-paper mt-8 p-6 sm:p-8">
        <h2 id="explanation-title" className="font-display text-2xl font-bold">What really happened</h2>
        <p className="mt-3 leading-relaxed text-paper-ink/90">{data.explanation}</p>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section data-reveal aria-labelledby="clues-title" className="surface-felt p-6">
          <h2 id="clues-title" className="font-display text-2xl font-bold">Key clues</h2>
          <p className="mt-1 text-sm text-mist">The clues that pointed to the culprit.</p>
          <ul className="mt-4 space-y-3">
            {data.keyClues.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3">
                <span>{k.title}</span>
                <span className={cn('inline-flex shrink-0 items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider', k.found ? 'text-moss' : 'text-mist')}>
                  {k.found ? <Check aria-hidden="true" className="size-4" /> : <X aria-hidden="true" className="size-4" />}
                  {k.found ? 'Found' : 'Missed'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section data-reveal aria-labelledby="score-title" className="surface-felt p-6">
          <h2 id="score-title" className="font-display text-2xl font-bold">Your score</h2>
          <div className="mt-3">
            <ScoreBreakdown score={data.score} progress={data.progress} />
          </div>
        </section>
      </div>

      {note && (
        <section data-reveal aria-labelledby="note-title" className="surface-felt mt-8 p-6">
          <h2 id="note-title" className="font-display text-2xl font-bold">Your reasoning</h2>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-200">{note}</p>
        </section>
      )}

      <div data-reveal className="mt-10 flex flex-wrap items-center gap-4">
        <Button as={Link} to="/create" size="lg"><Plus aria-hidden="true" className="size-5" /> New mystery</Button>
        <Button variant="ghost" size="lg" onClick={share}><Share2 aria-hidden="true" className="size-5" /> Share</Button>
      </div>
    </div>
  );
}
