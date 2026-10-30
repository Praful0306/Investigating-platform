import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useElapsedSeconds } from '../../hooks/useElapsedSeconds.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';
import { LogoMark } from '../layout/LogoMark.jsx';

const LINES = [
  'Dusting for fingerprints…',
  'Interrogating suspects…',
  'Checking alibis…',
  'Cross-referencing the timeline…',
  'Pinning clues to the board…',
  'Reading between the lines…',
];
const LINE_MS = 2500;
const LONG_WAIT_S = 25;
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// A full-screen "the detective is working" screen shown while the AI writes the case (10-40 s).
// It is a modal, busy dialog: it takes focus (nothing behind it can be reached), cannot be tabbed out of, and speaks
// one calm status instead of announcing every rotating line.
export function GeneratingOverlay({ open }) {
  const seconds = useElapsedSeconds(open);
  const reduced = useReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => setLineIndex((i) => i + 1), LINE_MS);
    return () => {
      clearInterval(id);
      setLineIndex(0); // reset on the way out, so the next time it opens it starts at the first line
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    const trapTab = (e) => { if (e.key === 'Tab') { e.preventDefault(); root.current?.focus(); } };
    document.addEventListener('keydown', trapTab);
    return () => {
      document.removeEventListener('keydown', trapTab);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  useGSAP(() => {
    if (!open || reduced) return;
    gsap.to('[data-lens]', { scale: 1.1, rotate: -8, duration: 1.3, ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.to('[data-glow]', { opacity: 0.9, scale: 1.15, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
  }, { scope: root, dependencies: [open, reduced] });

  if (!open) return null;
  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generating-title"
      aria-busy="true"
      tabIndex={-1}
      className="fixed inset-0 z-[55] grid place-items-center bg-ink/95 p-6 text-center outline-none backdrop-blur-md"
    >
      <h2 id="generating-title" className="sr-only">Generating your mystery</h2>
      <p role="status" className="sr-only">Generating your mystery. This can take up to 40 seconds.</p>
      <div aria-hidden="true" className="flex max-w-md flex-col items-center">
        <div className="relative grid size-40 place-items-center">
          <span data-glow className="absolute inset-0 rounded-full bg-amber/25 opacity-60 blur-2xl" />
          <LogoMark className="relative size-24 text-amber" />
          <span data-lens className="absolute inset-4 rounded-full border border-amber/30" />
        </div>
        <p data-testid="generating-line" className="mt-8 min-h-8 font-display text-2xl font-bold sm:text-3xl">
          {LINES[lineIndex % LINES.length]}
        </p>
        <p data-testid="generating-elapsed" className="mt-3 font-mono text-sm tracking-widest text-mist">{mmss(seconds)}</p>
        <p className="mt-6 min-h-6 text-sm text-mist">
          {seconds >= LONG_WAIT_S ? 'Hard cases take a bit longer…' : 'Writing a case no one has solved before.'}
        </p>
      </div>
    </div>,
    document.body,
  );
}
