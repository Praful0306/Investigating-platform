import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gavel } from 'lucide-react';
import { accuse } from '../api/cases.js';
import { CaseError } from '../components/case/CaseError.jsx';
import { InvestigationSkeleton } from '../components/case/InvestigationSkeleton.jsx';
import { SuspectOption } from '../components/case/SuspectOption.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { useToast } from '../components/ui/useToast.js';
import { useCase } from '../hooks/useCase.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { friendlyMessage } from '../lib/errors.js';
import { gsap, useGSAP } from '../lib/gsap.js';

const MAX_REASONING = 300;

export default function Accusation() {
  const { id } = useParams();
  const { data, error, refresh } = useCase(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const root = useRef(null);
  const busy = useRef(false);
  const [suspectId, setSuspectId] = useState(null);
  const [reasoning, setReasoning] = useState('');
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  useDocumentTitle('Make your accusation');

  useGSAP(() => {
    if (reduced || !data || !root.current) return; // no page on screen while redirecting or failing
    gsap.from(root.current.querySelectorAll('[data-reveal]'), { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'opacity,transform' });
  }, { scope: root, dependencies: [reduced, Boolean(data)] });

  if (error && !data) return <CaseError error={error} heading="Make your accusation" onRetry={refresh} />;
  if (!data) return <InvestigationSkeleton />;
  if (data.status !== 'active') return <Navigate to={`/case/${id}/result`} replace />;

  const chosen = data.suspects.find((s) => s.id === suspectId);

  async function confirm() {
    if (busy.current || !chosen) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await accuse(id, chosen.id);
      const note = reasoning.trim();
      // the note stays on this device (sessionStorage) and is shown back on the result page; it is never sent anywhere
      try {
        if (note) window.sessionStorage.setItem(`mr-reasoning:${id}`, note);
        else window.sessionStorage.removeItem(`mr-reasoning:${id}`);
      } catch { /* storage blocked: the note is a nicety, not part of the game */ }
      navigate(`/case/${id}/result`, { state: { result } });
      // success leaves `busy` set on purpose: the case is closed, so a second click must never send a second accusation
    } catch (err) {
      busy.current = false;
      setPending(false);
      setAsking(false);
      if (err?.code === 'CASE_ALREADY_COMPLETED') navigate(`/case/${id}/result`); // closed elsewhere: the result page fetches it
      else toast({ title: "That didn't work", description: friendlyMessage(err), tone: 'error' });
    }
  }

  return (
    <div ref={root} className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:pt-12">
      <div data-reveal>
        <Link to={`/case/${id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-chip text-sm font-medium text-mist transition hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to investigation
        </Link>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.25em] text-amber">Final answer</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">Make your accusation</h1>
        <p className="mt-3 max-w-xl text-mist">Who took it? You can accuse only once, and the case closes the moment you do.</p>
      </div>

      <fieldset className="mt-10 border-0 p-0">
        <legend className="sr-only">Suspects</legend>
        <div role="radiogroup" aria-label="Suspects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.suspects.map((s, i) => (
            <div key={s.id} data-reveal>
              <SuspectOption suspect={s} slot={i} name="suspect" checked={suspectId === s.id} onChange={setSuspectId} />
            </div>
          ))}
        </div>
      </fieldset>

      <div data-reveal className="mt-10 max-w-2xl">
        <label htmlFor="reasoning" className="block font-display text-xl font-bold">Your reasoning <span className="font-sans text-sm font-normal text-mist">(optional)</span></label>
        <p id="reasoning-help" className="mt-1 text-sm text-mist">Just for you: it is not scored and not sent anywhere. You will see it again with your result.</p>
        <textarea
          id="reasoning"
          aria-describedby="reasoning-help"
          maxLength={MAX_REASONING}
          rows={4}
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          className="mt-3 w-full resize-y rounded-chip border border-edge bg-white/[0.03] px-4 py-3 text-zinc-100 placeholder:text-mist/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          placeholder="What gave them away?"
        />
        <p className="mt-1 text-right font-mono text-xs text-mist">{reasoning.length} / {MAX_REASONING}</p>
      </div>

      <div data-reveal className="mt-8 flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={!chosen} onClick={() => setAsking(true)}>
          <Gavel aria-hidden="true" className="size-5" /> Accuse
        </Button>
        {!chosen && <p className="text-sm text-mist">Choose a suspect first.</p>}
      </div>

      <Modal
        open={asking && Boolean(chosen)}
        onClose={() => { if (!pending) setAsking(false); }}
        dismissible={false}
        title={`Accuse ${chosen?.name}?`}
        description="You can accuse only once. This closes the case and cannot be undone."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAsking(false)} disabled={pending}>Cancel</Button>
            <Button loading={pending} onClick={confirm}>Confirm accusation</Button>
          </>
        )}
      />
    </div>
  );
}
