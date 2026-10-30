import { Stamp } from 'lucide-react';
import { hueOf, initialsOf } from '../../lib/avatar.js';

// One suspect as a choice. A real radio input (hidden, but still the thing that gets focus) gives selection, arrow-key
// movement and screen-reader semantics for free; the card beside it just shows which one is checked.
export function SuspectOption({ suspect, slot, name, checked, onChange }) {
  const hue = hueOf(suspect.name, slot);
  return (
    <label className="block cursor-pointer">
      <input type="radio" name={name} value={suspect.id} checked={checked} onChange={() => onChange(suspect.id)} className="peer sr-only" />
      <article className="surface-felt relative h-full border border-transparent p-5 transition duration-200 ease-out-expo hover:border-amber/40 peer-checked:border-amber peer-checked:shadow-lamp peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber">
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
            <span className="block font-display text-xl font-bold leading-tight">{suspect.name}</span>
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{suspect.role}</span>
          </div>
        </div>
        <dl className="mt-4 space-y-3 border-t border-edge pt-4 text-sm">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Motive</dt>
            <dd className="mt-0.5 text-zinc-200">{suspect.motive}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Alibi</dt>
            <dd className="mt-0.5 text-zinc-200">{suspect.alibi}</dd>
          </div>
        </dl>
        {checked && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-chip border border-amber bg-amber/15 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-widest text-amber">
            <Stamp aria-hidden="true" className="size-3.5" /> Accused
          </span>
        )}
      </article>
    </label>
  );
}
