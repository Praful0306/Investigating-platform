import { useRef } from 'react';
import { Fingerprint } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';
import { cn } from '../../lib/cn.js';
import { Card } from '../ui/Card.jsx';

// Decorative hero art: three evidence cards pinned to a board with a red string between them.
// Everything is laid out in one 520 x 480 box (percent positions + an SVG with the same viewBox), so the pins and the
// string stay glued to the cards at any width. Sizes use container query units (cqw) so it scales down on a phone.
// GSAP: cards drop in, the string draws itself, the stamp lands, the board drifts with the pointer and the scroll.
// Reduced motion: it simply sits there, fully drawn.
const PINS = [[140, 24], [343, 149], [177, 302]];
const STRING = 'M140 24 C 215 112, 285 62, 343 149 S 252 262, 177 302';

const label = 'font-mono text-[clamp(8px,1.9cqw,10px)] uppercase tracking-[0.2em] text-paper-ink/60';
const title = 'mt-1 font-display text-[clamp(14px,4.2cqw,22px)] font-bold leading-tight';
const body = 'mt-2 text-[clamp(10px,2.45cqw,13px)] leading-snug text-paper-ink/85';

export function EvidenceBoard({ className }) {
  const root = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(() => {
    if (reduced) return;
    const box = root.current;
    const path = box.querySelector('[data-string]');
    const length = path.getTotalLength?.(); // not available in every environment; the string is then simply shown

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(box.querySelectorAll('[data-card]'), { opacity: 0, y: -56, rotate: (i) => [-12, 9, -8][i], duration: 0.9, ease: 'back.out(1.5)', stagger: 0.16 }, 0.3)
      .from(box.querySelectorAll('[data-pin]'), { scale: 0, transformOrigin: '50% 50%', duration: 0.35, ease: 'back.out(3)', stagger: 0.16 }, 0.7)
      .from(box.querySelector('[data-stamp]'), { opacity: 0, scale: 1.7, rotate: -28, duration: 0.45, ease: 'back.out(2.2)' }, 2.1);
    if (length) {
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      tl.to(path, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }, 0.9);
    }

    // the whole board breathes a little (one group, so pins and string never drift away from the cards)
    gsap.to(box.querySelector('[data-board]'), { y: -7, duration: 3.4, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 1.5 });
    // and rises slower than the page as you scroll away from the hero
    gsap.to(box, { yPercent: -7, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });

    // pointer parallax: only for a mouse or trackpad, never on touch
    const mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine)', () => {
      const layer = box.querySelector('[data-parallax]');
      const x = gsap.quickTo(layer, 'x', { duration: 0.8, ease: 'power3' });
      const y = gsap.quickTo(layer, 'y', { duration: 0.8, ease: 'power3' });
      const move = (e) => {
        x((e.clientX / window.innerWidth - 0.5) * 22);
        y((e.clientY / window.innerHeight - 0.5) * 16);
      };
      window.addEventListener('pointermove', move);
      return () => window.removeEventListener('pointermove', move);
    });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <div ref={root} data-evidence-board aria-hidden="true" className={cn('relative mx-auto aspect-[13/12] w-full max-w-[520px] [container-type:inline-size]', className)}>
      <div className="absolute inset-[8%] rounded-full bg-amber/15 blur-3xl" />
      <div data-parallax className="absolute inset-0">
        <div data-board className="absolute inset-0">
          {/* the string runs BEHIND the cards (so it never crosses their text); the pins sit on top of them */}
          <svg viewBox="0 0 520 480" className="pointer-events-none absolute inset-0 size-full" fill="none">
            <path d={STRING} stroke="rgb(0 0 0 / 0.35)" strokeWidth="4" strokeLinecap="round" transform="translate(2 3)" />
            <path data-string d={STRING} stroke="#d94848" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <Card data-card variant="paper" tilt={-2.5} className="absolute left-[4%] top-[4%] w-[46%] p-[3.4cqw]">
            <p className={label}>Green room door</p>
            <p className={title}>Rosin smudge</p>
            <p className={body}>A fresh amber smear on the inside handle. The college stocks none.</p>
          </Card>
          <Card data-card variant="paper" tilt={2} className="absolute left-[40%] top-[30%] w-[52%] p-[3.4cqw]">
            <div className="flex items-center justify-between">
              <p className={label}>Person of interest</p>
              <Fingerprint className="size-[3.6cqw] min-h-3.5 min-w-3.5 text-paper-ink/60" />
            </div>
            <p className={title}>Arjun Rao</p>
            <p className={body}>Visiting tabla player. Says he stepped out for chai at 9:10.</p>
          </Card>
          <Card data-card variant="paper" tilt={-1.6} className="absolute left-[10%] top-[62%] w-[48%] p-[3.4cqw]">
            <p className={label}>Back stairwell</p>
            <p className={title}>Torn ticket</p>
            <p className={body}>Stamped 7:12, long before the festival began.</p>
          </Card>

          <svg viewBox="0 0 520 480" className="pointer-events-none absolute inset-0 size-full" fill="none">
            {PINS.map(([cx, cy]) => (
              <g key={cx} data-pin>
                <circle cx={cx} cy={cy} r="7.5" fill="#b23838" />
                <circle cx={cx - 2} cy={cy - 2.5} r="2.4" fill="#f08585" />
              </g>
            ))}
          </svg>

          <div
            data-stamp
            style={{ transform: 'rotate(-12deg)' }}
            className="absolute bottom-[3%] right-[2%] border-2 border-blood/70 px-[2.4cqw] py-[0.8cqw] font-mono text-[clamp(10px,2.8cqw,14px)] font-medium tracking-[0.3em] text-blood-soft/90"
          >
            UNSOLVED
          </div>
        </div>
      </div>
    </div>
  );
}
