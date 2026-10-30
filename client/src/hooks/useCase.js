import { useCallback, useEffect, useState } from 'react';
import { getCase } from '../api/cases.js';

const EMPTY = { data: null, loading: true, error: null };

// Loads one case and keeps it in step with what the server says WITHOUT refetching: every clue / hint reply carries the
// new facts, and applyClue / applyHint merge them in. State is keyed by id, so switching to another case never shows
// the previous one, and a slow answer for an old id can never overwrite the new one.
export function useCase(id) {
  const [state, setState] = useState({ id, ...EMPTY });
  const [attempt, setAttempt] = useState(0);
  const current = state.id === id ? state : { id, ...EMPTY };

  useEffect(() => {
    let active = true;
    getCase(id).then(
      (data) => active && setState({ id, data, loading: false, error: null }),
      (error) => active && setState({ id, data: null, loading: false, error }),
    );
    return () => { active = false; };
  }, [id, attempt]);

  // keeps whatever is on screen (a re-sync after the server said "no") and clears the error
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  const applyClue = useCallback(({ clue, progress }) => {
    setState((s) => {
      if (!s.data || !s.data.clues.some((c) => c.id === clue.id)) return s;
      return { ...s, data: { ...s.data, clues: s.data.clues.map((c) => (c.id === clue.id ? { ...c, ...clue } : c)), progress } };
    });
  }, []);

  const applyHint = useCallback(({ hint, progress }) => {
    setState((s) => {
      if (!s.data) return s;
      const revealed = [...s.data.hints.revealed.filter((h) => h.index !== hint.index), hint].sort((a, b) => a.index - b.index);
      return { ...s, data: { ...s.data, hints: { ...s.data.hints, used: progress.hintsUsed, revealed }, progress } };
    });
  }, []);

  return { data: current.data, loading: current.loading, error: current.error, refresh, applyClue, applyHint };
}
