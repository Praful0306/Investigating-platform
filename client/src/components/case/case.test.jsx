import { createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../../config/difficulty.js';
import { DifficultyPicker } from './DifficultyPicker.jsx';
import { GeneratingOverlay } from './GeneratingOverlay.jsx';
import { Turnstile } from './Turnstile.jsx';
import { ErrorBanner } from '../ui/ErrorBanner.jsx';

afterEach(() => vi.useRealTimers());

describe('DifficultyPicker', () => {
  const Harness = ({ initial = 'easy', disabled = false, onChange = () => {} }) => {
    const [v, setV] = useState(initial);
    return <DifficultyPicker value={v} disabled={disabled} onChange={(d) => { setV(d); onChange(d); }} />;
  };

  it('is a labelled radio group with one native radio per difficulty, easy first', () => {
    render(<Harness />);
    const group = screen.getByRole('radiogroup', { name: /difficulty/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.value)).toEqual(DIFFICULTY_ORDER);
    expect(within(group).getByRole('radio', { name: /easy/i })).toBeChecked();
  });

  it.each(DIFFICULTY_ORDER)('%s card shows suspects, clues, hints and points from the config', (d) => {
    render(<Harness />);
    const card = screen.getByRole('radio', { name: new RegExp(DIFFICULTY[d].label, 'i') }).closest('label');
    for (const [label, value] of [['suspects', DIFFICULTY[d].suspects], ['clues', DIFFICULTY[d].clues], ['hints', DIFFICULTY[d].hints], ['pts', DIFFICULTY[d].points]]) {
      expect(card, `${d} ${label}`).toHaveTextContent(new RegExp(`${value}\\s*${label}`, 'i'));
    }
    expect(card).toHaveTextContent(DIFFICULTY[d].blurb);
  });

  it('selecting a card calls onChange and checks it', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /hard/i }));
    expect(onChange).toHaveBeenCalledWith('hard');
    expect(screen.getByRole('radio', { name: /hard/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /easy/i })).not.toBeChecked();
  });

  it('clicking the card text (not just the dot) selects it', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText(DIFFICULTY.medium.blurb));
    expect(screen.getByRole('radio', { name: /medium/i })).toBeChecked();
  });

  it('arrow keys move the selection (native radio behaviour)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('radio', { name: /easy/i }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /medium/i })).toBeChecked();
  });

  it('disabled: nothing can be picked', async () => {
    const onChange = vi.fn();
    render(<Harness disabled onChange={onChange} />);
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    await userEvent.click(screen.getByRole('radio', { name: /hard/i }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the selected card is marked for styling and the others are not', () => {
    render(<Harness initial="medium" />);
    expect(screen.getByRole('radio', { name: /medium/i }).closest('label')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('radio', { name: /easy/i }).closest('label')).not.toHaveAttribute('data-selected', 'true');
  });
});

describe('GeneratingOverlay', () => {
  it('renders nothing when closed', () => {
    render(<GeneratingOverlay open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a modal, busy dialog with a name and a polite spoken status', () => {
    render(<GeneratingOverlay open />);
    const d = screen.getByRole('dialog', { name: /generating your mystery/i });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d).toHaveAttribute('aria-busy', 'true');
    expect(within(d).getByRole('status')).toHaveTextContent(/up to 40 seconds/i);
  });

  it('takes focus so keyboard users are not left on the form behind it, and Tab cannot escape', async () => {
    render(<><button>behind</button><GeneratingOverlay open /></>);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('locks page scroll while open and restores it after', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = render(<GeneratingOverlay open />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<GeneratingOverlay open={false} />);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('rotates the playful lines every 2.5 seconds', () => {
    vi.useFakeTimers();
    render(<GeneratingOverlay open />);
    const line = () => screen.getByTestId('generating-line').textContent;
    const first = line();
    expect(first).toMatch(/…$/);
    act(() => { vi.advanceTimersByTime(2499); });
    expect(line()).toBe(first);
    act(() => { vi.advanceTimersByTime(2); });
    const second = line();
    expect(second).not.toBe(first);
    act(() => { vi.advanceTimersByTime(2500); });
    expect(line()).not.toBe(second);
  });

  it('starts with "Dusting for fingerprints…" like the spec', () => {
    render(<GeneratingOverlay open />);
    expect(screen.getByTestId('generating-line')).toHaveTextContent('Dusting for fingerprints…');
  });

  it('shows elapsed time as mm:ss', () => {
    vi.useFakeTimers();
    render(<GeneratingOverlay open />);
    expect(screen.getByTestId('generating-elapsed')).toHaveTextContent('00:00');
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByTestId('generating-elapsed')).toHaveTextContent('00:07');
    act(() => { vi.advanceTimersByTime(63000); });
    expect(screen.getByTestId('generating-elapsed')).toHaveTextContent('01:10');
  });

  it('after 25 seconds it adds "Hard cases take a bit longer…"', () => {
    vi.useFakeTimers();
    render(<GeneratingOverlay open />);
    expect(screen.queryByText(/hard cases take a bit longer/i)).toBeNull();
    act(() => { vi.advanceTimersByTime(24000); });
    expect(screen.queryByText(/hard cases take a bit longer/i)).toBeNull();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText(/hard cases take a bit longer/i)).toBeInTheDocument();
  });

  it('starts over each time it opens', () => {
    vi.useFakeTimers();
    const { rerender } = render(<GeneratingOverlay open />);
    act(() => { vi.advanceTimersByTime(30000); });
    rerender(<GeneratingOverlay open={false} />);
    rerender(<GeneratingOverlay open />);
    expect(screen.getByTestId('generating-elapsed')).toHaveTextContent('00:00');
    expect(screen.queryByText(/hard cases take a bit longer/i)).toBeNull();
  });

  it('clears every interval it starts when it unmounts (GSAP keeps its own ticker, so count only ours)', () => {
    vi.useFakeTimers();
    const started = vi.spyOn(globalThis, 'setInterval');
    const cleared = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<GeneratingOverlay open />);
    const ids = started.mock.results.map((r) => r.value);
    expect(ids.length).toBeGreaterThanOrEqual(2); // the elapsed clock and the line rotation
    unmount();
    for (const id of ids) expect(cleared).toHaveBeenCalledWith(id);
  });

  it('works with reduced motion (the default in tests): the rotating text is still there', () => {
    render(<GeneratingOverlay open />);
    expect(screen.getByTestId('generating-line')).toBeInTheDocument();
  });
});

describe('Turnstile', () => {
  let opts;
  let fake;
  beforeEach(() => {
    opts = undefined;
    fake = {
      render: vi.fn((_el, o) => { opts = o; return 'widget-1'; }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    document.head.querySelectorAll('script[data-turnstile]').forEach((s) => s.remove());
    delete window.turnstile;
  });
  afterEach(() => { delete window.turnstile; });

  it('renders the widget with the site key when the script is already loaded', () => {
    window.turnstile = fake;
    render(<Turnstile siteKey="site-key-1" onToken={() => {}} />);
    expect(fake.render).toHaveBeenCalledTimes(1);
    expect(opts.sitekey).toBe('site-key-1');
    expect(document.head.querySelector('script[data-turnstile]')).toBeNull();
  });

  it('passes the token up, and clears it when it expires or errors', () => {
    window.turnstile = fake;
    const onToken = vi.fn();
    render(<Turnstile siteKey="k" onToken={onToken} />);
    act(() => opts.callback('tok-1'));
    expect(onToken).toHaveBeenLastCalledWith('tok-1');
    act(() => opts['expired-callback']());
    expect(onToken).toHaveBeenLastCalledWith('');
    act(() => opts.callback('tok-2'));
    act(() => opts['error-callback']());
    expect(onToken).toHaveBeenLastCalledWith('');
  });

  it('exposes reset() which resets that widget', () => {
    window.turnstile = fake;
    const ref = createRef();
    render(<Turnstile ref={ref} siteKey="k" onToken={() => {}} />);
    ref.current.reset();
    expect(fake.reset).toHaveBeenCalledWith('widget-1');
  });

  it('removes the widget on unmount', () => {
    window.turnstile = fake;
    const { unmount } = render(<Turnstile siteKey="k" onToken={() => {}} />);
    unmount();
    expect(fake.remove).toHaveBeenCalledWith('widget-1');
  });

  it('loads Cloudflare\'s script once, then renders when it has loaded', () => {
    const first = render(<Turnstile siteKey="k" onToken={() => {}} />);
    const tag = document.head.querySelector('script[data-turnstile]');
    expect(tag).not.toBeNull();
    expect(tag.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(fake.render).not.toHaveBeenCalled();
    window.turnstile = fake;
    act(() => { tag.dispatchEvent(new Event('load')); });
    expect(fake.render).toHaveBeenCalledTimes(1);
    first.unmount();
    delete window.turnstile;
    render(<Turnstile siteKey="k" onToken={() => {}} />);
    expect(document.head.querySelectorAll('script[data-turnstile]')).toHaveLength(1); // not injected twice
  });

  it('an unmount before the script loads does not try to render afterwards', () => {
    const { unmount } = render(<Turnstile siteKey="k" onToken={() => {}} />);
    const tag = document.head.querySelector('script[data-turnstile]');
    unmount();
    window.turnstile = fake;
    act(() => { tag.dispatchEvent(new Event('load')); });
    expect(fake.render).not.toHaveBeenCalled();
  });

  it('has an accessible name for the bot-check region', () => {
    window.turnstile = fake;
    render(<Turnstile siteKey="k" onToken={() => {}} />);
    expect(screen.getByLabelText(/bot check/i)).toBeInTheDocument();
  });
});

describe('ErrorBanner', () => {
  it('is an alert with the friendly message for an error', () => {
    render(<ErrorBanner error={{ code: 'AI_UNAVAILABLE' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The mystery writer is busy. Try again in a minute.');
  });

  it('accepts an explicit message', () => {
    render(<ErrorBanner message="Something specific." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something specific.');
  });

  it('shows "Try again" only when it was given a handler and a retry can help', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorBanner error={{ code: 'AI_GENERATION_FAILED' }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<ErrorBanner error={{ code: 'RATE_LIMITED' }} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
    rerender(<ErrorBanner error={{ code: 'NETWORK', message: 'Cannot reach the server.' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
