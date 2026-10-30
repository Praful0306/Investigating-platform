import { useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';
import { Button } from '../ui/Button.jsx';

// The reveal plays once per case per browser session. Storage can be blocked (private mode), so every access is guarded.
const key = (id) => `mr-story-seen:${id}`;
const wasSeen = (id) => {
  try {
    return window.sessionStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
};
const markSeen = (id) => {
  try {
    window.sessionStorage.setItem(key(id), '1');
  } catch {
    /* fine: the reveal may simply play again next time */
  }
};

export function StoryPanel({ caseId, setting, crime, story }) {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const timeline = useRef(null);
  const [animating, setAnimating] = useState(() => !reduced && !wasSeen(caseId));
  const paragraphs = story.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  function finish() {
    markSeen(caseId);
    setAnimating(false);
  }

  useGSAP(() => {
    if (!animating) return;
    const box = root.current;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: finish });
    tl.from(box.querySelector('[data-crime]'), { opacity: 0, y: 14, duration: 0.7 })
      .from(box.querySelectorAll('[data-story] p'), { opacity: 0, y: 18, duration: 0.8, stagger: 0.4 }, '-=0.2');
    timeline.current = tl;
  }, { scope: root, dependencies: [animating] });

  // "Skip" jumps the timeline to its end (which fires finish); if there is no timeline it just finishes
  const skip = () => (timeline.current ? timeline.current.progress(1) : finish());

  return (
    <section ref={root} aria-labelledby="story-title" className="surface-felt p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber">Read this first</p>
          <h2 id="story-title" className="mt-1 font-display text-3xl font-bold">The case file</h2>
        </div>
        {animating && <Button variant="ghost" onClick={skip}>Skip intro</Button>}
      </div>

      <p className="mt-4 flex items-center gap-2 text-mist">
        <MapPin aria-hidden="true" className="size-4 shrink-0 text-amber" />
        {setting}
      </p>

      <div data-crime className="mt-5 rounded-chip border-l-4 border-amber bg-amber/10 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber">The crime</p>
        <p className="mt-1 text-lg leading-snug text-zinc-100">{crime}</p>
      </div>

      <div data-story className="mt-6 space-y-4 text-lg leading-8 text-zinc-300">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}
