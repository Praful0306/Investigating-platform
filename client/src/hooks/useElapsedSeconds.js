import { useEffect, useState } from 'react';

// Whole seconds since `running` became true. 0 while idle; starts over each time it is switched on.
export function useElapsedSeconds(running) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => {
      clearInterval(id);
      setSeconds(0); // reset on the way out, so the next run starts from zero
    };
  }, [running]);

  return running ? seconds : 0;
}
