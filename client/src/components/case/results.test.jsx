import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { setReducedMotion } from '../../test/matchMedia.js';
import { ScoreBreakdown } from './ScoreBreakdown.jsx';

const score = { base: 100, clueBonus: 15, hintPenalty: 10, total: 105 };
const progress = { discoveredCount: 3, totalClues: 5, hintsUsed: 1, hintsTotal: 2 };
const total = () => within(screen.getByRole('row', { name: /total/i })).getByRole('cell');

describe('ScoreBreakdown', () => {
  it('reduced motion: the final total is there straight away', () => {
    render(<ScoreBreakdown score={score} progress={progress} />);
    expect(total()).toHaveTextContent(/^105$/);
  });

  it('with motion: the total counts up from 0 and lands exactly on the server total', async () => {
    setReducedMotion(false);
    render(<ScoreBreakdown score={score} progress={progress} />);
    expect(total()).toHaveTextContent(/^0$/);
    await waitFor(() => expect(total()).toHaveTextContent(/^105$/));
  });

  it('with motion: never shows a fraction on the way', async () => {
    setReducedMotion(false);
    render(<ScoreBreakdown score={score} progress={progress} />);
    const seen = new Set();
    await waitFor(() => { seen.add(total().textContent); expect(total()).toHaveTextContent(/^105$/); });
    for (const v of seen) expect(v).toMatch(/^\d+$/);
  });

  it('a total of 0 stays 0', () => {
    render(<ScoreBreakdown score={{ base: 0, clueBonus: 5, hintPenalty: 20, total: 0 }} progress={{ ...progress, discoveredCount: 1, hintsUsed: 2 }} />);
    expect(total()).toHaveTextContent(/^0$/);
  });

  it('a new score replaces the old total (no stale number)', () => {
    const { rerender } = render(<ScoreBreakdown score={score} progress={progress} />);
    rerender(<ScoreBreakdown score={{ ...score, total: 50 }} progress={progress} />);
    expect(total()).toHaveTextContent(/^50$/);
  });
});
