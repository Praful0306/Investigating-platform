import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap.js';
import { Button } from '../ui/Button.jsx';

export function ClosingCta() {
  const root = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(() => {
    if (reduced) return;
    const parts = root.current.querySelectorAll('[data-cta-part]');
    gsap.set(parts, { opacity: 0, y: 28 });
    ScrollTrigger.create({
      trigger: root.current,
      start: 'top 82%',
      once: true,
      onEnter: () => gsap.to(parts, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 }),
    });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <section ref={root} aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <div className="surface-felt relative overflow-hidden rounded-panel px-6 py-16 text-center sm:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-amber/15 blur-3xl" />
        <h2 data-cta-part id="cta-title" className="relative mx-auto max-w-2xl font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Ready to take the case?
        </h2>
        <p data-cta-part className="relative mx-auto mt-4 max-w-md text-mist">
          A brand-new mystery is one sentence away. The culprit is already hiding.
        </p>
        <div data-cta-part className="relative mt-9">
          <Button as={Link} to="/create" size="lg">
            Start a mystery
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
