import { useId } from 'react';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../../config/difficulty.js';
import { cn } from '../../lib/cn.js';
import { Badge } from '../ui/Badge.jsx';

// Three cards that are really native radio buttons: arrow keys, focus and screen readers all work for free.
export function DifficultyPicker({ value, onChange, disabled = false }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Difficulty" className="grid gap-3 sm:grid-cols-3">
      {DIFFICULTY_ORDER.map((d) => {
        const cfg = DIFFICULTY[d];
        const selected = value === d;
        return (
          <label
            key={d}
            data-selected={selected}
            className={cn(
              'relative flex cursor-pointer flex-col gap-2 rounded-card border p-4 transition duration-200',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber',
              selected ? 'border-amber bg-amber/10 shadow-lamp' : 'border-edge bg-white/[0.03] hover:bg-white/[0.06]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={d}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(d)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-xl font-bold">{cfg.label}</span>
              <Badge tone={d}>{cfg.points} pts</Badge>
            </span>
            <span className="text-sm text-mist">{cfg.blurb}</span>
            <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-xs text-zinc-300">
              <span>{cfg.suspects} suspects</span>
              <span>{cfg.clues} clues</span>
              <span>{cfg.hints} hints</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
