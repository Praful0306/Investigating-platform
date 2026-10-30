const AUTH_PAGES = /^\/(login|register)(?:[/?#]|$)/;

// The page to return to after signing in comes from the address bar (`?next=`), so it is untrusted: only a path on THIS
// site is allowed, never another site, and never the sign-in pages themselves (that would loop).
export function safeNext(raw, fallback = '/') {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return fallback;
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return fallback;
  // control characters and backslashes never belong in a path we redirect to
  if ([...raw].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || ch === '\\')) return fallback;
  if (/^\/%2f/i.test(raw) || /^\/%5c/i.test(raw)) return fallback;
  if (AUTH_PAGES.test(raw)) return fallback;
  return raw;
}
