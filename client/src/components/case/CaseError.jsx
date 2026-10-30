import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { ErrorState } from '../ui/ErrorState.jsx';

const GONE = new Set(['CASE_NOT_FOUND', 'INVALID_ID']);

// The full-page error for a case that could not be opened. `heading` is the page's own (screen-reader) h1, so every
// page keeps exactly one h1 even when it failed to load.
export function CaseError({ error, heading, onRetry }) {
  const title = error.code === 'FORBIDDEN' ? 'Not your case file' : GONE.has(error.code) ? 'Case not found' : 'Could not open the case';
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <h1 className="sr-only">{heading}</h1>
      <ErrorState title={title} error={error} onRetry={onRetry} actions={<Button as={Link} to="/create">Start a new mystery</Button>} />
    </div>
  );
}
