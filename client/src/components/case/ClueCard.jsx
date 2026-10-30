import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';
import { Button } from '../ui/Button.jsx';

const label = 'font-mono text-[11px] uppercase tracking-[0.2em]';

// A clue card. Face down it shows only the title and where it was found, and an Examine button. Once the server reveals
// the clue (the `clue` prop turns discovered) the card turns over with a GSAP 3D flip and the description appears.
// The description is not in the page at all until then: the back face is only rendered for a discovered clue.
// A clue that is already found when the page opens is simply drawn face up, with no animation.
export function ClueCard({ clue, onExamine }) {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [openOnMount] = useState(clue.discovered);
  const flipped = clue.discovered;

  useGSAP(() => {
    if (!flipped || openOnMount) return;
    const inner = root.current.querySelector('[data-flip]');
    if (reduced) {
      gsap.set(inner, { rotateY: 180 });
      return;
    }
    gsap.to(inner, { rotateY: 180, duration: 0.9, ease: 'power3.inOut' });
    gsap.fromTo(root.current.querySelector('[data-back]'), { scale: 0.96 }, { scale: 1, duration: 0.5, delay: 0.55, ease: 'back.out(2)' });
  }, { scope: root, dependencies: [flipped, reduced] });

  async function examine() {
    // a clue that is already open is never examined again, even if a click somehow reaches the old button
    if (busy.current || flipped) return;
    busy.current = true;
    setPending(true);
    try {
      await onExamine(clue.id);
    } catch {
      /* the page already told the player what went wrong; the card just becomes usable again */
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const Title = flipped ? 'p' : 'h3'; // one heading per card: the back face carries it once the card is open

  return (
    <div ref={root} className="[perspective:1100px]">
      <div
        data-flip
        data-flipped={String(flipped)}
        style={openOnMount ? { transform: 'rotateY(180deg)' } : undefined}
        className="grid [transform-style:preserve-3d]"
      >
        <div
          aria-hidden={flipped || undefined}
          inert={flipped || undefined}
          className="surface-felt flex min-h-44 flex-col justify-between border-dashed border-amber/30 p-5 [backface-visibility:hidden] [grid-area:1/1]"
        >
          <div>
            <p className={`${label} flex items-center gap-1.5 text-amber`}>
              <Lock aria-hidden="true" className="size-3" /> Sealed
            </p>
            <Title className="mt-2 font-display text-xl font-bold leading-tight">{clue.title}</Title>
            <p className={`${label} mt-1 text-mist`}>{clue.location}</p>
          </div>
          <Button variant="ghost" loading={pending} onClick={examine} aria-label={`Examine clue: ${clue.title}`} className="mt-4 self-start">
            Examine
          </Button>
        </div>

        {flipped && (
          <div
            data-back
            style={{ transform: 'rotateY(180deg)' }}
            className="surface-paper min-h-44 p-5 [backface-visibility:hidden] [grid-area:1/1]"
          >
            <p className={`${label} text-paper-ink/60`}>{clue.location}</p>
            <h3 className="mt-1 font-display text-xl font-bold leading-tight">{clue.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper-ink/90">{clue.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
