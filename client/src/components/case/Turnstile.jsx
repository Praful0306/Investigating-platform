import { useEffect, useImperativeHandle, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Cloudflare Turnstile bot check (explicit rendering). Loads Cloudflare's script once, renders the widget into a box and
// reports the token upward ('' when it expires or errors). Tokens are single-use: call ref.current.reset() after each
// submit. Only mounted when VITE_TURNSTILE_SITE_KEY is set.
export function Turnstile({ siteKey, onToken, ref }) {
  const box = useRef(null);
  const widget = useRef(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });

  useEffect(() => {
    const mount = () => {
      if (widget.current !== null || !window.turnstile || !box.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      });
    };

    let script = null;
    if (window.turnstile) {
      mount();
    } else {
      script = document.querySelector('script[data-turnstile]');
      if (!script) {
        script = Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true, defer: true });
        script.dataset.turnstile = '';
        document.head.appendChild(script);
      }
      script.addEventListener('load', mount);
    }

    return () => {
      script?.removeEventListener('load', mount);
      if (widget.current !== null) {
        window.turnstile?.remove(widget.current);
        widget.current = null;
      }
    };
  }, [siteKey]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widget.current !== null) window.turnstile?.reset(widget.current);
    },
  }), []);

  return <div ref={box} role="group" aria-label="Bot check" />;
}
