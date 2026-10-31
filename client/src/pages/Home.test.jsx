import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setReducedMotion } from '../test/matchMedia.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../config/difficulty.js';
import Home from './Home.jsx';

vi.mock('../api/cases.js', () => ({ health: vi.fn() }));
const { health } = await import('../api/cases.js');

const setup = () => render(<MemoryRouter><Home /></MemoryRouter>);

beforeEach(() => { health.mockReset(); health.mockResolvedValue({ ok: true }); });
afterEach(() => { vi.useRealTimers(); ScrollTrigger.getAll().forEach((t) => t.kill()); });

describe('content (works with and without animation)', () => {
  it('has exactly one h1: the tagline, with the brand as the eyebrow', async () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(/every case is new\.?\s*every culprit is hiding/i);
    expect(screen.getByText(/AI Mystery Room · Case file/)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('AI Mystery Room — every case is new'));
  });

  it('the primary call to action goes to /create, and "How it works" jumps to its section', () => {
    setup();
    const start = screen.getAllByRole('link', { name: /start a mystery/i });
    expect(start.length).toBeGreaterThanOrEqual(2); // hero + closing banner
    start.forEach((a) => expect(a).toHaveAttribute('href', '/create'));
    const how = screen.getByRole('link', { name: /how it works/i });
    expect(how).toHaveAttribute('href', '#how');
    expect(document.getElementById('how')).not.toBeNull();
  });

  it('explains the game in three ordered steps: describe, investigate, accuse', () => {
    setup();
    const section = document.getElementById('how');
    expect(within(section).getByRole('heading', { level: 2 })).toBeInTheDocument();
    const steps = within(section).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/describe/i);
    expect(steps[1]).toHaveTextContent(/investigate/i);
    expect(steps[2]).toHaveTextContent(/accuse/i);
    expect(within(section).getByRole('list').tagName).toBe('OL');
  });

  it.each(DIFFICULTY_ORDER)('the %s card lists suspects, clues, hints and points from the config', (d) => {
    setup();
    const heading = screen.getByRole('heading', { level: 3, name: DIFFICULTY[d].label });
    const card = heading.closest('[data-difficulty]');
    expect(card).toHaveAttribute('data-difficulty', d);
    for (const [label, value] of [['Suspects', DIFFICULTY[d].suspects], ['Clues', DIFFICULTY[d].clues], ['Hints', DIFFICULTY[d].hints], ['Points', DIFFICULTY[d].points]]) {
      const dt = within(card).getByText(label, { selector: 'dt' });
      expect(dt.nextElementSibling).toHaveTextContent(String(value));
    }
  });

  it('every section has a heading in order (h1 > h2 > h3, none skipped)', () => {
    setup();
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('decorative art is hidden from assistive technology', () => {
    setup();
    const board = document.querySelector('[data-evidence-board]');
    expect(board).not.toBeNull();
    expect(board).toHaveAttribute('aria-hidden', 'true');
  });

  it('the scroll progress bar is decorative too', () => {
    setup();
    expect(document.querySelector('[data-scroll-progress]')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('waking the backend', () => {
  it('pings /health on load and shows "Waking up the detective…" only if it takes more than 3 s', async () => {
    vi.useFakeTimers();
    let resolve;
    health.mockReturnValue(new Promise((r) => { resolve = r; }));
    setup();
    expect(health).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/waking up the detective/i)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(screen.getByRole('status', { name: /waking up the detective/i })).toBeInTheDocument();
    await act(async () => { resolve({ ok: true }); });
    expect(screen.queryByText(/waking up the detective/i)).toBeNull();
  });
});

describe('animation', () => {
  it('reduced motion (the test default): no ScrollTriggers at all and everything is simply visible', () => {
    setup();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });

  it('reduced motion: nothing is hidden or moved by animation code (no inline opacity anywhere on the page)', () => {
    // Counting ScrollTriggers is not enough here: in a test environment every one-shot trigger is already "in view"
    // and destroys itself at once, so the proof has to be that no element was ever touched.
    setup();
    expect(document.querySelectorAll('[style*="opacity"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-difficulty][style]')).toHaveLength(0);
  });

  it.each([1280, 800])('full motion at %i px wide: it mounts without errors and creates scroll triggers', (width) => {
    setReducedMotion(false);
    window.innerWidth = width;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = setup();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(0);
    unmount();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    window.innerWidth = 1024;
  });

  it('unmounting kills every ScrollTrigger (no leaks when you navigate away)', () => {
    setReducedMotion(false);
    const { unmount } = setup();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(0);
    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('keeps the headline readable by assistive tech once split into letters', () => {
    setReducedMotion(false);
    setup();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAccessibleName(/every case is new/i);
    expect(h1.getAttribute('aria-label')).toBe('Every case is new. Every culprit is hiding.');
    expect(h1.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0); // the letters are hidden, the label speaks
  });

  it('reduced motion leaves the headline as plain, unsplit text', () => {
    setup();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.getAttribute('aria-label')).toBeNull();
    expect(h1.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  describe('the pinned story (desktop with motion)', () => {
    const PREMISE = 'A poisoned chai at a hill-station homestay';
    const steps = () => [...document.querySelectorAll('[data-step]')].map((s) => s.dataset.active);
    afterEach(() => { window.innerWidth = 1024; });

    it('starts on step 1 with the premise typed out from empty', () => {
      setReducedMotion(false);
      window.innerWidth = 1280;
      setup();
      expect(steps()).toEqual(['true', 'false', 'false']);
      expect(document.querySelector('[data-typed]').textContent).toBe('');
    });

    it('on a phone it does not pin or dim anything (plain steps)', () => {
      setReducedMotion(false);
      window.innerWidth = 800;
      setup();
      expect(steps()).toEqual([undefined, undefined, undefined]);
      expect(document.querySelector('[data-typed]').textContent).toBe(PREMISE);
    });

    it('switching to reduced motion undoes everything it wrote to the page', () => {
      setReducedMotion(false);
      window.innerWidth = 1280;
      setup();
      act(() => setReducedMotion(true));
      expect(steps()).toEqual([undefined, undefined, undefined]);
      expect(document.querySelector('[data-typed]').textContent).toBe(PREMISE);
      const stage = document.querySelector('[data-stage]');
      expect(stage).toHaveClass('hidden');
      expect(stage.className).not.toMatch(/lg:block/); // not even on a wide screen: the stage is not shown at all
    });
  });

  it('switching reduced motion on at runtime removes the animations', () => {
    setReducedMotion(false);
    setup();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(0);
    act(() => setReducedMotion(true));
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
