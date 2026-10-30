import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHealthWake } from '../../hooks/useHealthWake.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, SplitText, useGSAP } from '../../lib/gsap.js';
import { EvidenceBoard } from '../effects/EvidenceBoard.jsx';
import { Button } from '../ui/Button.jsx';
import { SpinnerIcon } from '../ui/Spinner.jsx';

export function Hero() {
  const root = useRef(null);
  const reduced = useReducedMotion();
  const { waking } = useHealthWake();

  useGSAP(() => {
    if (reduced) return;
    // The headline rises letter by letter out of a mask. SplitText keeps it readable to screen readers (aria-label on
    // the h1, letters hidden) and re-splits by itself when the web font loads or the width changes.
    SplitText.create(root.current.querySelector('[data-hero-title]'), {
      type: 'lines,words,chars',
      mask: 'lines',
      linesClass: 'hero-line', // the mask wrapper then gets the class "hero-line-mask" (see index.css)
      autoSplit: true,
      onSplit: (self) => gsap.from(self.chars, { yPercent: 115, duration: 1, ease: 'expo.out', stagger: 0.02 }),
    });
    gsap.from(root.current.querySelectorAll('[data-hero-fade]'), { opacity: 0, y: 18, duration: 0.8, ease: 'power3.out', stagger: 0.09, delay: 0.15 });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <section ref={root} className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:pt-16 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:py-16">
      <div>
        <p data-hero-fade className="font-mono text-xs uppercase tracking-[0.3em] text-amber">AI Mystery Room · Case file</p>
        {/* text-wrap and kerning are switched off: balanced wrapping and kerning shifts both fight SplitText */}
        <h1
          data-hero-title
          className="mt-5 font-display text-[clamp(2.75rem,8.4vw,6.25rem)] font-black leading-[0.98] tracking-[-0.03em] [font-kerning:none] [text-wrap:wrap]"
        >
          Every case is <em className="font-medium italic text-amber">new</em>. Every culprit is hiding.
        </h1>
        <p data-hero-fade className="mt-6 max-w-xl text-lg text-mist">
          Type any premise and an AI writes a fair, fully solvable detective case: suspects, clues, hints and one hidden culprit.
          Read the file, find the evidence, then make your accusation. Play as a guest, no sign-up.
        </p>
        <div data-hero-fade className="mt-9 flex flex-wrap items-center gap-3">
          <Button as={Link} to="/create" size="lg">
            Start a mystery
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
          <Button as="a" href="#how" variant="ghost" size="lg">How it works</Button>
        </div>
        <div className="mt-6 min-h-8" data-hero-fade>
          {waking && (
            <p role="status" aria-label="Waking up the detective" className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-sm text-amber">
              <SpinnerIcon />
              Waking up the detective…
            </p>
          )}
        </div>
      </div>
      <EvidenceBoard />
    </section>
  );
}
