import { useRef } from 'react';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../../config/difficulty.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap.js';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';

const STATS = [['Suspects', 'suspects'], ['Clues', 'clues'], ['Hints', 'hints'], ['Points', 'points']];

export function Difficulties() {
  const root = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(() => {
    if (reduced) return;
    const cards = root.current.querySelectorAll('[data-difficulty]');
    gsap.set(cards, { opacity: 0, y: 36 });
    ScrollTrigger.batch(cards, {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.14, overwrite: true }),
    });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <section ref={root} aria-labelledby="levels-title" className="mx-auto max-w-6xl px-4 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">Difficulty</p>
      <h2 id="levels-title" className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
        Pick how hard you want it.
      </h2>
      <p className="mt-4 max-w-xl text-mist">
        Harder cases have more suspects and more clues to weigh, and pay more for a correct accusation.
        Each clue you find adds 5 points; each hint costs 10.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {DIFFICULTY_ORDER.map((d) => {
          const cfg = DIFFICULTY[d];
          return (
            <Card key={d} data-difficulty={d} className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-3xl font-bold">{cfg.label}</h3>
                <Badge tone={d}>{d}</Badge>
              </div>
              <p className="mt-2 text-mist">{cfg.blurb}</p>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-edge pt-5">
                {STATS.map(([label, key]) => (
                  <div key={key}>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">{label}</dt>
                    <dd className="mt-0.5 font-display text-3xl font-bold text-zinc-100">{cfg[key]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
