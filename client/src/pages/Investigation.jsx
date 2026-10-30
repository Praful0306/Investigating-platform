import { useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { discoverClue, requestHint } from '../api/cases.js';
import { AccuseBar } from '../components/case/AccuseBar.jsx';
import { CaseHeader } from '../components/case/CaseHeader.jsx';
import { ClueCard } from '../components/case/ClueCard.jsx';
import { HintsPanel } from '../components/case/HintsPanel.jsx';
import { InvestigationSkeleton } from '../components/case/InvestigationSkeleton.jsx';
import { StoryPanel } from '../components/case/StoryPanel.jsx';
import { SuspectCard } from '../components/case/SuspectCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { useToast } from '../components/ui/useToast.js';
import { useCase } from '../hooks/useCase.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { friendlyMessage } from '../lib/errors.js';
import { gsap, useGSAP } from '../lib/gsap.js';

const GONE = new Set(['CASE_NOT_FOUND', 'INVALID_ID']);

export default function Investigation() {
  const { id } = useParams();
  const { data, loading, error, refresh, applyClue, applyHint } = useCase(id);
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const root = useRef(null);
  useDocumentTitle(data?.title ?? 'Investigation room');

  // the page rises in once, when the case first arrives (not on every clue or hint)
  useGSAP(() => {
    if (reduced || !data) return;
    gsap.from(root.current.querySelectorAll('[data-reveal]'), { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.07, clearProps: 'opacity,transform' });
  }, { scope: root, dependencies: [reduced, Boolean(data)] });

  // The server is the authority. If it says the case is closed or out of hints, our copy was stale: say so, then re-sync
  // (a closed case then redirects to the result by itself).
  function fail(err) {
    toast({ title: "That didn't work", description: friendlyMessage(err), tone: 'error' });
    if (err?.code === 'CASE_ALREADY_COMPLETED' || err?.code === 'NO_HINTS_LEFT') refresh();
  }

  async function examine(clueId) {
    try {
      const reply = await discoverClue(id, clueId);
      applyClue(reply);
      if (!reply.alreadyDiscovered) toast({ title: '+5 clue found', description: reply.clue.title, tone: 'success' });
    } catch (err) {
      fail(err);
    }
  }

  async function takeHint() {
    try {
      const reply = await requestHint(id);
      applyHint(reply);
      toast({ title: `Hint ${reply.hint.index + 1} revealed`, description: '−10 points', tone: 'info' });
    } catch (err) {
      fail(err);
    }
  }

  if (loading && !data) return <InvestigationSkeleton />;

  if (error && !data) {
    const forbidden = error.code === 'FORBIDDEN';
    const title = forbidden ? 'Not your case file' : GONE.has(error.code) ? 'Case not found' : 'Could not open the case';
    return (
      <div className="mx-auto max-w-6xl px-4 py-24">
        <h1 className="sr-only">Investigation room</h1>
        <ErrorState
          title={title}
          error={error}
          onRetry={refresh}
          actions={<Button as={Link} to="/create">Start a new mystery</Button>}
        />
      </div>
    );
  }

  if (!data) return <InvestigationSkeleton />;
  if (data.status !== 'active') return <Navigate to={`/case/${id}/result`} replace />;

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:pt-12 lg:pb-20">
      <div data-reveal>
        <CaseHeader caseData={data} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-12">
          <div data-reveal>
            <StoryPanel caseId={data.id} setting={data.setting} crime={data.crime} story={data.story} />
          </div>

          <section aria-labelledby="suspects-title">
            <h2 id="suspects-title" className="font-display text-3xl font-bold">Suspects</h2>
            <p className="mt-1 text-mist">One of them did it. Read their motives and alibis carefully.</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {data.suspects.map((s, i) => (
                <li key={s.id} data-reveal>
                  <SuspectCard suspect={s} slot={i} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-12">
          <section aria-labelledby="evidence-title">
            <h2 id="evidence-title" className="font-display text-3xl font-bold">Evidence board</h2>
            <p className="mt-1 text-mist">Examine a clue to turn it over. Every clue you find is worth 5 points.</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {data.clues.map((c) => (
                <li key={c.id} data-reveal>
                  <ClueCard clue={c} onExamine={examine} />
                </li>
              ))}
            </ul>
          </section>

          <div data-reveal>
            <HintsPanel hints={data.hints} onRequest={takeHint} />
          </div>
        </div>
      </div>

      <AccuseBar caseData={data} />
    </div>
  );
}
