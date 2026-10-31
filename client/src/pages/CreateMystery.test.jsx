import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { Providers } from '../App.jsx';
import CreateMystery from './CreateMystery.jsx';

vi.mock('../api/cases.js', () => ({ createCase: vi.fn(), health: vi.fn() }));
const { createCase } = await import('../api/cases.js');

const PREMISE = 'A stolen trophy at a college cricket final';
const Room = () => <p>ROOM {useParams().id}</p>;

const setup = () =>
  render(
    <MemoryRouter initialEntries={['/create']}>
      <Providers>
        <Routes>
          <Route path="/create" element={<CreateMystery />} />
          <Route path="/case/:id" element={<Room />} />
        </Routes>
      </Providers>
    </MemoryRouter>,
  );

const premiseBox = () => screen.getByRole('textbox', { name: /premise/i });
const generate = () => screen.getByRole('button', { name: /generate|try again in/i });
const write = (text = PREMISE) => userEvent.type(premiseBox(), text);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => { createCase.mockReset(); });
afterEach(() => { vi.useRealTimers(); delete window.turnstile; });

describe('the form', () => {
  it('has one h1, a labelled premise box (max 300) and a Generate button', async () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Create a mystery' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Create a mystery · AI Mystery Room'));
    expect(premiseBox()).toHaveAttribute('maxlength', '300');
    expect(generate()).toBeInTheDocument();
  });

  it('Generate is disabled until the premise has 10 real characters', async () => {
    setup();
    expect(generate()).toBeDisabled();
    await write('short');
    expect(generate()).toBeDisabled();
    await userEvent.clear(premiseBox());
    await write('1234567890');
    expect(generate()).toBeEnabled();
  });

  it('whitespace does not count: 40 spaces and "abc" is still too short', async () => {
    setup();
    await userEvent.type(premiseBox(), `${' '.repeat(40)}abc`);
    expect(generate()).toBeDisabled();
  });

  it('shows a live counter n/300', async () => {
    setup();
    expect(screen.getByText('0/300')).toBeInTheDocument();
    await write('hello');
    expect(screen.getByText('5/300')).toBeInTheDocument();
  });

  it('shows the "too short" message only after the box was left, then removes it once the premise is valid', async () => {
    setup();
    await write('short');
    expect(screen.queryByText(/at least 10 characters/i)).toBeNull();
    await userEvent.tab(); // leave the box
    const msg = screen.getByText(/at least 10 characters/i);
    expect(premiseBox()).toHaveAttribute('aria-invalid', 'true');
    expect(premiseBox().getAttribute('aria-describedby')).toContain(msg.id);
    await userEvent.type(premiseBox(), ' and more text');
    expect(screen.queryByText(/at least 10 characters/i)).toBeNull();
    expect(premiseBox()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('five sample premises fill the box when clicked (and do not submit)', async () => {
    setup();
    const group = screen.getByRole('group', { name: /sample premises|need an idea/i });
    const chips = within(group).getAllByRole('button');
    expect(chips).toHaveLength(5);
    expect(chips.map((c) => c.textContent)).toEqual(expect.arrayContaining([
      'A stolen trophy at a college cricket final',
      'A poisoned chai at a hill-station homestay',
      'A missing hard drive at a startup hackathon',
      'A vanished sitar at a music festival',
      'Sabotage on a Mumbai local train film shoot',
    ]));
    await userEvent.click(chips[1]);
    expect(premiseBox()).toHaveValue(chips[1].textContent);
    expect(generate()).toBeEnabled();
    expect(createCase).not.toHaveBeenCalled();
  });

  it('difficulty defaults to easy and can be changed', async () => {
    setup();
    expect(screen.getByRole('radio', { name: /easy/i })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /hard/i }));
    expect(screen.getByRole('radio', { name: /hard/i })).toBeChecked();
  });
});

describe('generating', () => {
  it('sends the trimmed premise and the chosen difficulty, then opens the new case', async () => {
    createCase.mockResolvedValue({ id: '6720c1f0a1b2c3d4e5f60718' });
    setup();
    await userEvent.click(screen.getByRole('radio', { name: /medium/i }));
    await write(`   ${PREMISE}   `);
    await userEvent.click(generate());
    expect(createCase).toHaveBeenCalledWith({ premise: PREMISE, difficulty: 'medium' });
    expect(await screen.findByText('ROOM 6720c1f0a1b2c3d4e5f60718')).toBeInTheDocument();
  });

  it('shows the generating overlay while waiting and locks the form behind it', async () => {
    const d = deferred();
    createCase.mockReturnValue(d.promise);
    setup();
    await write();
    await userEvent.click(generate());
    expect(screen.getByRole('dialog', { name: /generating your mystery/i })).toBeInTheDocument();
    expect(document.querySelector('[inert]')).not.toBeNull();
    expect(document.querySelector('[inert]')).toContainElement(premiseBox());
    await act(async () => { d.resolve({ id: 'abc' }); await d.promise; });
  });

  it('cannot be submitted twice (double click, Enter-mashing)', async () => {
    const d = deferred();
    createCase.mockReturnValue(d.promise);
    setup();
    await write();
    const button = generate();
    await userEvent.dblClick(button);
    await userEvent.click(button);
    expect(createCase).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve({ id: 'abc' }); await d.promise; });
  });

  it('an invalid premise cannot be submitted even by pressing Enter in the form', async () => {
    setup();
    await write('short');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(createCase).not.toHaveBeenCalled();
  });
});

describe('when generating fails', () => {
  it('shows a friendly banner, keeps the premise and difficulty, and closes the overlay', async () => {
    createCase.mockRejectedValue({ status: 502, code: 'AI_GENERATION_FAILED', message: 'raw' });
    setup();
    await userEvent.click(screen.getByRole('radio', { name: /hard/i }));
    await write();
    await userEvent.click(generate());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Our mystery writer tangled the plot. Try again — it usually works on the next try.');
    expect(alert).not.toHaveTextContent('raw');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(premiseBox()).toHaveValue(PREMISE);
    expect(screen.getByRole('radio', { name: /hard/i })).toBeChecked();
    expect(generate()).toBeEnabled();
  });

  it('"Try again" in the banner generates again with the same values', async () => {
    createCase.mockRejectedValueOnce({ status: 503, code: 'AI_UNAVAILABLE', message: 'x' }).mockResolvedValueOnce({ id: 'case-2' });
    setup();
    await userEvent.click(screen.getByRole('radio', { name: /medium/i }));
    await write();
    await userEvent.click(generate());
    await userEvent.click(await screen.findByRole('button', { name: /^try again$/i }));
    expect(createCase).toHaveBeenCalledTimes(2);
    expect(createCase).toHaveBeenLastCalledWith({ premise: PREMISE, difficulty: 'medium' });
    expect(await screen.findByText('ROOM case-2')).toBeInTheDocument();
  });

  it('a network failure is explained and can be retried', async () => {
    createCase.mockRejectedValue({ status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' });
    setup();
    await write();
    await userEvent.click(generate());
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    expect(screen.getByRole('button', { name: /^try again$/i })).toBeInTheDocument();
  });

  it('a validation error from the server is shown as is', async () => {
    createCase.mockRejectedValue({ status: 400, code: 'VALIDATION_ERROR', message: 'Premise must be 10–300 characters.' });
    setup();
    await write();
    await userEvent.click(generate());
    expect(await screen.findByRole('alert')).toHaveTextContent('Premise must be 10–300 characters.');
  });

  it('the error disappears as soon as a new attempt starts', async () => {
    const d = deferred();
    createCase.mockRejectedValueOnce({ status: 502, code: 'AI_GENERATION_FAILED', message: 'x' }).mockReturnValueOnce(d.promise);
    setup();
    await write();
    await userEvent.click(generate());
    await screen.findByRole('alert');
    await userEvent.click(generate());
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => { d.resolve({ id: 'abc' }); await d.promise; });
  });
});

describe('rate limiting (429)', () => {
  const limited = { status: 429, code: 'RATE_LIMITED', message: 'x' };

  it('disables Generate for 60 seconds with a countdown, then re-enables it', async () => {
    vi.useFakeTimers();
    createCase.mockRejectedValue(limited);
    setup();
    // direct events: typing 40 characters through userEvent under fake timers is needlessly slow
    fireEvent.change(premiseBox(), { target: { value: PREMISE } });
    await act(async () => { fireEvent.click(generate()); });
    expect(screen.getByRole('alert')).toHaveTextContent("You've opened a lot of cases");
    expect(screen.queryByRole('button', { name: /^try again$/i })).toBeNull(); // waiting, not retrying, is what helps
    expect(generate()).toBeDisabled();
    expect(generate()).toHaveTextContent(/60s/);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(generate()).toHaveTextContent(/50s/);
    act(() => { vi.advanceTimersByTime(49000); });
    expect(generate()).toBeDisabled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(generate()).toBeEnabled();
    expect(generate()).toHaveTextContent(/generate/i);
  });

  it('keeps the premise while waiting', async () => {
    createCase.mockRejectedValue(limited);
    setup();
    await write();
    await userEvent.click(generate());
    await screen.findByRole('alert');
    expect(premiseBox()).toHaveValue(PREMISE);
  });
});

describe('Cloudflare Turnstile (only when VITE_TURNSTILE_SITE_KEY is set)', () => {
  let opts;
  const install = () => {
    window.turnstile = { render: vi.fn((_el, o) => { opts = o; return 'w1'; }), reset: vi.fn(), remove: vi.fn() };
  };

  it('is absent without a key: no widget, no token sent', async () => {
    createCase.mockResolvedValue({ id: 'abc' });
    setup();
    expect(screen.queryByLabelText(/bot check/i)).toBeNull();
    await write();
    await userEvent.click(generate());
    expect(createCase).toHaveBeenCalledWith({ premise: PREMISE, difficulty: 'easy' });
  });

  it('with a key: the widget is shown and Generate waits for the token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    install();
    setup();
    expect(window.turnstile.render).toHaveBeenCalledTimes(1);
    expect(opts.sitekey).toBe('site-key');
    await write();
    expect(generate()).toBeDisabled();
    act(() => opts.callback('tok-1'));
    expect(generate()).toBeEnabled();
  });

  it('sends the token with the request', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    install();
    createCase.mockResolvedValue({ id: 'abc' });
    setup();
    await write();
    act(() => opts.callback('tok-1'));
    await userEvent.click(generate());
    expect(createCase).toHaveBeenCalledWith({ premise: PREMISE, difficulty: 'easy', turnstileToken: 'tok-1' });
  });

  it('resets the widget after a failed attempt and needs a fresh token (tokens are single-use)', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    install();
    createCase.mockRejectedValue({ status: 502, code: 'AI_GENERATION_FAILED', message: 'x' });
    setup();
    await write();
    act(() => opts.callback('tok-1'));
    await userEvent.click(generate());
    await screen.findByRole('alert');
    expect(window.turnstile.reset).toHaveBeenCalledWith('w1');
    expect(generate()).toBeDisabled();
    act(() => opts.callback('tok-2'));
    expect(generate()).toBeEnabled();
  });

  it('an expired token disables Generate again', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    install();
    setup();
    await write();
    act(() => opts.callback('tok-1'));
    expect(generate()).toBeEnabled();
    act(() => opts['expired-callback']());
    expect(generate()).toBeDisabled();
  });
});
