import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { hueOf, initialsOf } from '../../lib/avatar.js';
import { cn } from '../../lib/cn.js';
import { Card } from '../ui/Card.jsx';

// `slot` is the suspect's position in the case; it keeps the avatars of one case clearly different colours.
export function SuspectCard({ suspect, slot }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const hue = hueOf(suspect.name, slot);

  return (
    <Card as="article" className="p-5">
      <div className="flex items-center gap-4">
        <span
          data-avatar
          aria-hidden="true"
          style={{ '--h': hue, '--h2': (hue + 40) % 360 }}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,hsl(var(--h)_55%_42%),hsl(var(--h2)_60%_26%))] font-display text-lg font-bold text-white shadow-card"
        >
          {initialsOf(suspect.name)}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold leading-tight">{suspect.name}</h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{suspect.role}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-300">{suspect.description}</p>

      {/* phones: motive and alibi are tucked away to keep five suspects scannable; large screens show them always */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-chip text-sm font-medium text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber lg:hidden"
      >
        Motive and alibi
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <dl id={detailsId} data-details className={cn('mt-3 space-y-3 border-t border-edge pt-4 text-sm lg:mt-4', open ? 'block' : 'hidden lg:block')}>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Motive</dt>
          <dd className="mt-0.5 text-zinc-200">{suspect.motive}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Alibi</dt>
          <dd className="mt-0.5 text-zinc-200">{suspect.alibi}</dd>
        </div>
      </dl>
    </Card>
  );
}
