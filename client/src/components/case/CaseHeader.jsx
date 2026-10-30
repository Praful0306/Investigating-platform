import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Info } from 'lucide-react';
import { DIFFICULTY, previewScore } from '../../config/difficulty.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { ProgressBar } from '../ui/ProgressBar.jsx';

const statLabel = 'font-mono text-[11px] uppercase tracking-[0.2em] text-mist';

export function CaseHeader({ caseData }) {
  const { id, title, difficulty, progress } = caseData;
  const tipId = useId();
  // PREVIEW ONLY: base + 5 per clue - 10 per hint if the accusation is right. The server decides the real score.
  const preview = previewScore({ difficulty, discoveredCount: progress.discoveredCount, hintsUsed: progress.hintsUsed });

  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-amber">CASE #{id.slice(-4).toUpperCase()}</span>
            <Badge tone={difficulty}>{DIFFICULTY[difficulty]?.label ?? difficulty}</Badge>
          </div>
          {/* the setting is part of the story panel (SPEC §4.3), so it is not repeated here */}
          <h1 className="mt-3 font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">{title}</h1>
        </div>
        <Button as={Link} to={`/case/${id}/accuse`} size="lg" className="hidden lg:inline-flex">
          <Gavel aria-hidden="true" className="size-5" />
          Make an accusation
        </Button>
      </div>

      {/* each stat is a <dt> label followed directly by its <dd> value, as a description list requires */}
      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="surface-felt p-4">
          <dt className={statLabel}>Clues found</dt>
          <dd className="mt-1">
            <span className="block font-display text-3xl font-bold">{progress.discoveredCount} / {progress.totalClues}</span>
            <ProgressBar className="mt-3" value={progress.discoveredCount} max={progress.totalClues} label="Clues found" />
          </dd>
        </div>

        <div className="surface-felt p-4">
          <dt className={statLabel}>Hints used</dt>
          <dd className="mt-1">
            <span className="block font-display text-3xl font-bold">{progress.hintsUsed} / {progress.hintsTotal}</span>
            <span aria-hidden="true" className="mt-3 flex gap-1.5">
              {Array.from({ length: progress.hintsTotal }, (_, i) => (
                <span key={i} className={i < progress.hintsUsed ? 'h-2 flex-1 rounded-full bg-amber' : 'h-2 flex-1 rounded-full bg-white/10'} />
              ))}
            </span>
          </dd>
        </div>

        <div className="surface-felt p-4">
          <dt className={statLabel}>Score if correct now</dt>
          <dd className="mt-1">
            <span className="flex items-center gap-2">
              <span data-score className="font-display text-3xl font-bold text-amber">{preview}</span>
              <span className="font-mono text-xs uppercase tracking-wider text-mist">preview</span>
              <span className="group relative ml-auto">
                <button
                  type="button"
                  aria-label="About the score preview"
                  aria-describedby={tipId}
                  className="-m-3 grid size-11 cursor-pointer place-items-center rounded-chip text-mist transition hover:text-amber focus-visible:outline-2 focus-visible:outline-amber"
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
                <span
                  id={tipId}
                  role="tooltip"
                  className="invisible absolute right-0 top-9 z-20 w-64 rounded-chip border border-edge bg-felt-2 p-3 text-sm leading-snug text-zinc-200 opacity-0 shadow-card transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
                >
                  Preview if your accusation is correct. Final score is calculated by the server.
                </span>
              </span>
            </span>
            <span className="mt-3 block text-xs text-mist">{DIFFICULTY[difficulty]?.points} base, +5 per clue, −10 per hint</span>
          </dd>
        </div>
      </dl>
    </header>
  );
}
