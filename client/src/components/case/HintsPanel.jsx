import { useRef, useState } from 'react';
import { Lightbulb, Lock } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

// Hints cost 10 points each, so asking is a two-step: the button opens a confirmation, the confirmation makes the
// request. Revealed hints sit in an aria-live region so a screen reader announces each new one.
export function HintsPanel({ hints, onRequest }) {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const seen = useRef(hints.revealed.length);
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const left = hints.total - hints.used;
  const next = hints.used + 1;

  useGSAP(() => {
    const count = hints.revealed.length;
    const isNew = count > seen.current;
    seen.current = count;
    if (!isNew || reduced) return;
    gsap.from(root.current.querySelector('ol > li:last-child'), { opacity: 0, y: 14, duration: 0.7, ease: 'power3.out' });
  }, { scope: root, dependencies: [hints.revealed.length, reduced] });

  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await onRequest();
    } catch {
      /* the page shows the error; the dialog still closes so the player is not stuck */
    } finally {
      busy.current = false;
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <section ref={root} aria-labelledby="hints-title" className="surface-felt p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="hints-title" className="font-display text-2xl font-bold">Hints</h2>
        <span className="font-mono text-xs text-mist">{hints.used}/{hints.total} used</span>
      </div>

      <div aria-live="polite" className="mt-4">
        {hints.revealed.length === 0 ? (
          <p className="text-sm text-mist">No hints used yet. Hints cost 10 points each.</p>
        ) : (
          <ol className="space-y-3">
            {hints.revealed.map((h) => (
              <li key={h.index} className="surface-paper p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-ink/60">Hint {h.index + 1} of {hints.total}</p>
                <p className="mt-1 text-sm leading-relaxed">{h.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {left > 0 && (
        <ul aria-hidden="true" className="mt-3 space-y-2">
          {Array.from({ length: left }, (_, i) => (
            <li key={i} className="flex items-center gap-2 rounded-chip border border-dashed border-edge px-4 py-3 text-sm text-mist">
              <Lock className="size-4" /> Hint {hints.used + i + 1}, sealed
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" className="mt-5 w-full" disabled={left <= 0} onClick={() => setOpen(true)}>
        {left <= 0 ? 'No hints left' : (
          <>
            <Lightbulb aria-hidden="true" className="size-4 text-amber" />
            Get a hint
            <span className="font-mono text-xs text-mist">· {left} left</span>
          </>
        )}
      </Button>

      <Modal
        open={open && left > 0}
        onClose={() => { if (!pending) setOpen(false); }}
        title={`Reveal hint ${next}?`}
        description="Hints cost 10 points. The points are taken off your score when you accuse."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button loading={pending} onClick={confirm}>Reveal hint {next}</Button>
          </>
        )}
      />
    </section>
  );
}
