// DEV ONLY (route /__kit exists only under `vite` dev, never in a production build): a gallery of the design tokens and
// every UI component in every state, for looking at the real thing in a browser while building pages.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Lightbulb, Search } from 'lucide-react';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { ProgressBar } from '../components/ui/ProgressBar.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useToast } from '../components/ui/useToast.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const SWATCHES = [
  ['ink', 'bg-ink'], ['felt', 'bg-felt'], ['felt-2', 'bg-felt-2'], ['paper', 'bg-paper'], ['amber', 'bg-amber'],
  ['moss', 'bg-moss'], ['blood', 'bg-blood'], ['blood-deep', 'bg-blood-deep'], ['mist', 'bg-mist'],
];

function Section({ title, children }) {
  return (
    <section className="mt-14">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-amber">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function Kit() {
  useDocumentTitle('Component gallery');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-5xl font-black tracking-tight sm:text-7xl">Component gallery</h1>
      <p className="mt-3 max-w-prose text-mist">Development only. Tokens, type and every UI component in every state.</p>

      <Section title="Colour">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {SWATCHES.map(([name, cls]) => (
            <div key={name}>
              <div className={`${cls} h-16 rounded-chip border border-edge`} />
              <p className="mt-1 font-mono text-xs text-mist">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="font-display text-[clamp(2.75rem,8vw,6rem)] font-black leading-[0.95] tracking-[-0.03em]">
          Every case is <em className="font-medium italic text-amber">new</em>.
        </p>
        <p className="mt-4 font-display text-3xl font-bold">Section heading in Playfair 700</p>
        <p className="mt-3 max-w-prose text-zinc-200">Body copy in Inter 400 at 16px with a comfortable line height. A good detective story is a promise: every clue is on the table, and only the reader's attention is missing.</p>
        <p className="mt-3 font-mono text-sm text-mist">CASE #A1F3 · 9 CLUES · 00:42 elapsed</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Start a mystery</Button>
          <Button variant="ghost">How it works</Button>
          <Button variant="danger">Accuse</Button>
          <Button loading>Generating…</Button>
          <Button disabled>Disabled</Button>
          <Button size="lg"><Search aria-hidden="true" className="size-5" />Large</Button>
          <Button as={Link} to="/create" variant="ghost">As a link</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge tone="easy">Easy</Badge><Badge tone="medium">Medium</Badge><Badge tone="hard">Hard</Badge>
          <Badge tone="success">Solved</Badge><Badge tone="danger">Unsolved</Badge><Badge>Active</Badge>
        </div>
      </Section>

      <Section title="Cards: felt and paper">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <Fingerprint aria-hidden="true" className="size-6 text-amber" />
            <h3 className="mt-3 font-display text-xl font-bold">Meera Iyer</h3>
            <p className="font-mono text-xs uppercase tracking-wider text-mist">Festival coordinator</p>
            <p className="mt-3 text-sm text-zinc-300">Has run the festival for nine years and holds the master key.</p>
          </Card>
          <Card variant="paper" tilt={-1.5} className="p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-ink/60">Green room door</p>
            <h3 className="mt-1 font-display text-2xl font-bold">Rosin smudge</h3>
            <p className="mt-3 text-sm">A fresh amber smear of rosin on the inside door handle. The college stocks none.</p>
          </Card>
          <Card variant="paper" tilt={1.2} className="p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-ink/60">Back stairwell</p>
            <h3 className="mt-1 font-display text-2xl font-bold">Torn ticket</h3>
            <p className="mt-3 text-sm">Half of a backstage pass, stamped 7:12, long before the festival began.</p>
          </Card>
        </div>
      </Section>

      <Section title="Progress, skeleton, spinner">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4">
            <ProgressBar value={0} max={5} label="No clues yet" />
            <ProgressBar value={2} max={5} label="Two of five clues" />
            <ProgressBar value={5} max={5} label="All clues found" />
          </div>
          <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-24" /></div>
          <div className="flex items-center gap-4"><Spinner label="Dusting for fingerprints" /><p className="text-sm text-mist">Dusting for fingerprints…</p></div>
        </div>
      </Section>

      <Section title="Errors">
        <div className="grid gap-6 md:grid-cols-2">
          <ErrorState error={{ code: 'AI_GENERATION_FAILED' }} onRetry={() => toast({ title: 'Retrying…', tone: 'info' })} />
          <ErrorState title="Case not found" error={{ code: 'CASE_NOT_FOUND' }} onRetry={() => {}} actions={<Button as={Link} to="/create">Start a new mystery</Button>} />
        </div>
      </Section>

      <Section title="Toasts and dialog">
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => toast({ title: '+5 clue found', description: 'Rosin smudge', tone: 'success' })}>Success toast</Button>
          <Button variant="ghost" onClick={() => toast({ title: 'No hints left', description: 'You have used them all.', tone: 'error' })}>Error toast</Button>
          <Button variant="ghost" onClick={() => toast({ title: 'Case saved' })}>Info toast</Button>
          <Button onClick={() => setOpen(true)}><Lightbulb aria-hidden="true" className="size-4" />Open dialog</Button>
        </div>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Accuse Arjun Rao?"
          description="You can accuse only once. This is final."
          dismissible={false}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => setOpen(false)}>Accuse</Button></>}
        />
      </Section>
    </div>
  );
}
