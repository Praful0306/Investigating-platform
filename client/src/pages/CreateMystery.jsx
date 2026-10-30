import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Feather, MapPin } from 'lucide-react';
import { createCase } from '../api/cases.js';
import { DifficultyPicker } from '../components/case/DifficultyPicker.jsx';
import { GeneratingOverlay } from '../components/case/GeneratingOverlay.jsx';
import { Turnstile } from '../components/case/Turnstile.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ErrorBanner } from '../components/ui/ErrorBanner.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const MIN = 10;
const MAX = 300;
const RATE_LIMIT_WAIT_S = 60;
const SAMPLES = [
  'A stolen trophy at a college cricket final',
  'A poisoned chai at a hill-station homestay',
  'A missing hard drive at a startup hackathon',
  'A vanished sitar at a music festival',
  'Sabotage on a Mumbai local train film shoot',
];
const TIPS = [
  { icon: MapPin, text: 'Name a place and something that goes wrong there.' },
  { icon: Feather, text: 'Add a mood: a rainy hill station, a loud festival night.' },
  { icon: Compass, text: 'Skip the names. The detective invents the suspects.' },
];

export default function CreateMystery() {
  useDocumentTitle('Create a mystery');
  const navigate = useNavigate();
  const ids = useId();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const [premise, setPremise] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');
  const [blockedFor, startBlock] = useCountdown();
  const inFlight = useRef(false);
  const textarea = useRef(null);
  const turnstile = useRef(null);

  // the server collapses whitespace too, so "valid" is judged on the collapsed text
  const length = premise.replace(/\s+/g, ' ').trim().length;
  const tooShort = length < MIN;
  const needsToken = Boolean(siteKey) && !token;
  const canSubmit = !tooShort && length <= MAX && !submitting && blockedFor === 0 && !needsToken;

  async function submit(event) {
    event?.preventDefault();
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const created = await createCase({ premise: premise.trim(), difficulty, ...(token && { turnstileToken: token }) });
      navigate(`/case/${created.id}`);
    } catch (err) {
      setError(err);
      if (err?.code === 'RATE_LIMITED' || err?.status === 429) startBlock(RATE_LIMIT_WAIT_S);
      setSubmitting(false);
      turnstile.current?.reset(); // a token works once, so ask for a new one
      setToken('');
      inFlight.current = false;
    }
  }

  function pickSample(text) {
    setPremise(text);
    setTouched(false);
    textarea.current?.focus();
  }

  const errorId = `${ids}-error`;
  const countId = `${ids}-count`;
  const showShort = touched && tooShort;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">New case</p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">Create a mystery</h1>
      <p className="mt-3 max-w-xl text-mist">
        Describe any setting and crime. A fresh, fully solvable case is written just for you in under a minute.
      </p>

      <div inert={submitting || undefined} className="mt-10 grid gap-8 lg:grid-cols-[1.45fr_1fr]">
        <form onSubmit={submit} noValidate>
          <Card className="space-y-7 p-6 sm:p-8">
            <div>
              <label htmlFor={`${ids}-premise`} className="font-display text-xl font-bold">Your premise</label>
              <textarea
                id={`${ids}-premise`}
                ref={textarea}
                value={premise}
                maxLength={MAX}
                rows={4}
                placeholder="A stolen violin at a Mumbai music college…"
                onChange={(e) => setPremise(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={showShort || undefined}
                aria-describedby={showShort ? `${countId} ${errorId}` : countId}
                className="mt-3 w-full resize-y rounded-chip border border-edge bg-ink/60 px-4 py-3 text-base text-zinc-100 placeholder:text-mist/70 focus-visible:border-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber aria-[invalid=true]:border-blood"
              />
              <div className="mt-2 flex items-start justify-between gap-4 text-sm">
                <p id={errorId} className="min-h-5 text-blood-soft">
                  {showShort && `Write at least ${MIN} characters so the detective has something to work with.`}
                </p>
                <span id={countId} className="shrink-0 font-mono text-xs text-mist">{premise.length}/{MAX}</span>
              </div>
            </div>

            <div role="group" aria-labelledby={`${ids}-ideas`}>
              <p id={`${ids}-ideas`} className="text-sm font-medium text-mist">Need an idea? Try one of these</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SAMPLES.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => pickSample(text)}
                    className="min-h-11 cursor-pointer rounded-full border border-edge bg-white/[0.03] px-4 text-left text-sm text-zinc-200 transition hover:border-amber/50 hover:bg-amber/10 hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 font-display text-xl font-bold">Difficulty</p>
              <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            </div>

            {siteKey && (
              <div>
                <Turnstile ref={turnstile} siteKey={siteKey} onToken={setToken} />
                {needsToken && <p className="mt-2 text-sm text-mist">Complete the bot check to continue.</p>}
              </div>
            )}

            {error && <ErrorBanner error={error} onRetry={submit} />}

            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit} loading={submitting}>
              {blockedFor > 0 ? `Try again in ${blockedFor}s` : 'Generate mystery'}
            </Button>
          </Card>
        </form>

        <aside>
          <Card variant="paper" tilt={1} className="p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-ink/60">Detective's notes</p>
            <h2 className="mt-1 font-display text-2xl font-bold">What makes a good premise</h2>
            <ul className="mt-5 space-y-4">
              {TIPS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-paper-ink/70" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-paper-ink/15 pt-4 text-sm text-paper-ink/80">
              Every case is checked for fairness before you see it: the culprit can always be worked out from the clues.
            </p>
          </Card>
        </aside>
      </div>

      <GeneratingOverlay open={submitting} />
    </section>
  );
}
