import { useRef } from 'react';
import { FolderLock, Smartphone, UserRound } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';

const PERKS = [
  { icon: FolderLock, text: 'Every case you play is saved to your account.' },
  { icon: Smartphone, text: 'Pick up an investigation on any device.' },
  { icon: UserRound, text: 'No account? You can always play as a guest.' },
];

// The frame for sign-in and sign-up: a form card with the one h1 on the right, and on large screens a noir "case file"
// panel on the left that says what an account is for. Everything rises in once; nothing loops.
export function AuthShell({ title, subtitle, children }) {
  const reduced = useReducedMotion();
  const root = useRef(null);

  useGSAP(() => {
    if (reduced || !root.current) return;
    gsap.from(root.current.querySelectorAll('[data-rise]'), { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.09, clearProps: 'opacity,transform' });
  }, { scope: root, dependencies: [reduced] });

  return (
    <div ref={root} className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <aside aria-hidden={undefined} className="relative hidden lg:block">
        <div data-rise className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">Your case files</p>
          <p className="mt-4 font-display text-5xl font-bold leading-[1.05]">
            Every culprit you catch, <span className="text-amber">kept safe.</span>
          </p>
          <ul className="mt-10 space-y-5">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-4 text-zinc-300">
                <span className="grid size-10 shrink-0 place-items-center rounded-chip border border-edge bg-white/[0.04] text-amber">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="pt-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* a dropped case file, decoration only */}
        <div data-rise aria-hidden="true" className="relative mt-14 h-44">
          <div className="surface-paper absolute left-4 top-0 w-72 p-5 text-paper-ink" style={{ '--tilt': '-4deg' }}>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-ink/60">Case #7F3A</p>
            <p className="mt-1 font-display text-2xl font-bold">The Silent Sitar</p>
            <p className="mt-3 inline-block rotate-[-6deg] rounded-chip border-4 border-double border-moss px-3 py-1 font-display text-lg font-black uppercase tracking-[0.2em] text-moss">Solved</p>
          </div>
        </div>
      </aside>

      <section className="mx-auto w-full max-w-md">
        <div data-rise className="surface-felt p-6 sm:p-8">
          <h1 className="font-display text-4xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-mist">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  );
}
