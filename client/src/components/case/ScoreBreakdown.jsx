import { useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { gsap, useGSAP } from '../../lib/gsap.js';

const th = 'py-3 pr-4 text-left font-medium text-zinc-300';
const td = 'py-3 text-right font-mono tabular-nums';
const note = 'ml-2 font-mono text-xs text-mist';

// The numbers come from the server's score; this only lays them out. Amounts that are zero carry no sign.
// The total counts up from 0 (whole numbers only) and always ends on the server's value.
export function ScoreBreakdown({ score, progress }) {
  const reduced = useReducedMotion();
  const totalRef = useRef(null);

  useGSAP(() => {
    const el = totalRef.current;
    if (reduced) {
      el.textContent = String(score.total); // also covers the setting being switched on mid-count
      return;
    }
    const counter = { n: 0 };
    el.textContent = '0';
    gsap.to(counter, {
      n: score.total, duration: 1.4, ease: 'power2.out', delay: 0.5,
      onUpdate: () => { el.textContent = String(Math.round(counter.n)); },
    });
  }, { dependencies: [score.total, reduced] });

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Score breakdown</caption>
      <tbody className="divide-y divide-edge">
        <tr>
          <th scope="row" className={th}>Base score</th>
          <td className={td}>{score.base}</td>
        </tr>
        <tr>
          <th scope="row" className={th}>Clues found<span className={note}>{progress.discoveredCount} × 5</span></th>
          <td className={`${td} text-moss`}>{score.clueBonus > 0 ? `+${score.clueBonus}` : '0'}</td>
        </tr>
        <tr>
          <th scope="row" className={th}>Hints used<span className={note}>{progress.hintsUsed} × 10</span></th>
          <td className={`${td} text-blood-soft`}>{score.hintPenalty > 0 ? `−${score.hintPenalty}` : '0'}</td>
        </tr>
        <tr>
          <th scope="row" className="pt-4 text-left font-display text-lg font-bold">Total</th>
          <td className="pt-4 text-right font-display text-4xl font-bold text-amber"><span ref={totalRef} data-total>{score.total}</span></td>
        </tr>
      </tbody>
    </table>
  );
}
