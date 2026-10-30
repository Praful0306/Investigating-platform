import { useEffect, useState } from 'react';
import { health } from '../api/cases.js';

// Pings the API once so a sleeping free-tier backend starts waking up while the visitor reads the page.
// `waking` turns true only if there is still no answer after 3 s, so a warm server never shows the message.
export function useHealthWake() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => active && setWaking(true), 3000);
    const settled = () => {
      clearTimeout(timer);
      if (active) setWaking(false); // success or failure: never leave the message stuck on screen
    };
    health().then(settled, settled);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return { waking };
}
