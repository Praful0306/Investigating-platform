import { useCallback, useEffect, useState } from 'react';
import { getResult } from '../api/cases.js';

// The result of one case. `carried` is the result the accusation page just received: it is used as is (no second
// request) but only when it belongs to THIS case. Otherwise (a reload, a shared link) it is fetched.
// State is keyed by id, like useCase, so a slow answer for an old case can never show up on a new one.
export function useResult(id, carried) {
  const seed = carried?.caseId === id ? carried : null;
  const [state, setState] = useState({ id, data: seed, error: null });
  const [attempt, setAttempt] = useState(0);
  const current = state.id === id ? state : { id, data: seed, error: null };
  const needsFetch = !current.data;

  useEffect(() => {
    if (!needsFetch) return undefined;
    let active = true;
    getResult(id).then(
      (data) => active && setState({ id, data, error: null }),
      (error) => active && setState({ id, data: null, error }),
    );
    return () => { active = false; };
  }, [id, attempt, needsFetch]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { data: current.data, error: current.error, loading: needsFetch && !current.error, refresh };
}
