import { useCallback, useEffect, useState } from 'react';

// const [secondsLeft, start] = useCountdown();  start(60) counts 60 -> 0 and then stops ticking.
export function useCountdown() {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(id);
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback((seconds) => {
    if (!(seconds > 0)) return;
    setRemaining(seconds);
    setUntil(Date.now() + seconds * 1000);
  }, []);

  return [remaining, start];
}
