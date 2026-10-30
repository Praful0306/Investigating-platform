import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { ProgressBar } from '../ui/ProgressBar.jsx';

// Pinned to the bottom of the screen on phones so the way to accuse is never a long scroll away. Hidden from lg up,
// where the header carries the button.
export function AccuseBar({ caseData }) {
  const { id, progress } = caseData;
  return (
    <div
      data-accuse-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-ink/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-mist">
            {progress.discoveredCount}/{progress.totalClues} clues · {progress.hintsUsed}/{progress.hintsTotal} hints
          </p>
          <ProgressBar value={progress.discoveredCount} max={progress.totalClues} label="Clues found" />
        </div>
        <Button as={Link} to={`/case/${id}/accuse`}>
          <Gavel aria-hidden="true" className="size-4" />
          Make an accusation
        </Button>
      </div>
    </div>
  );
}
