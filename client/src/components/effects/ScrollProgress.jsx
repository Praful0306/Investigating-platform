import { useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { cn } from '../../lib/cn.js';
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap.js';

// A hairline amber bar across the top that fills as you read down the page. Decorative; hidden for reduced motion.
// (The transform is inline because GSAP animates it; a Tailwind scale class would stack with GSAP's.)
export function ScrollProgress() {
  const bar = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(() => {
    if (reduced) return;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
    });
  }, { dependencies: [reduced], revertOnUpdate: true });

  return (
    <div
      ref={bar}
      data-scroll-progress
      aria-hidden="true"
      style={{ transform: 'scaleX(0)' }}
      className={cn('fixed inset-x-0 top-0 z-[65] h-0.5 origin-left bg-amber', reduced && 'hidden')}
    />
  );
}
