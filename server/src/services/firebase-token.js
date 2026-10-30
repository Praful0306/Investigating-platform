import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../utils/app-error.js';

// Google publishes the keys that sign Firebase ID tokens here; `jose` caches them for as long as Google says to.
const GOOGLE_KEYS = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
const SKEW = 60; // seconds of clock difference we forgive
const MAX_TOKEN_LENGTH = 4096; // a real ID token is about 1 kB; anything huge is refused before any work is done

// Always the same message: a caller learns nothing about WHY a token failed.
const refuse = () => new AppError('UNAUTHORIZED', 401, 'Please sign in again.');

// jose's own errors all have a code starting ERR_J. A key download that failed (no code, a timeout, or the generic
// "expected 200 OK") means Google is unreachable: that is our problem, not the player's, so it is a 503.
const keysUnreachable = (err) => {
  const code = String(err?.code ?? '');
  return !code.startsWith('ERR_J') || code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JOSE_GENERIC';
};

// Verifies a Firebase ID token exactly as Firebase documents it for servers without the Admin SDK:
// RS256 only, issuer https://securetoken.google.com/<project>, audience <project>, not expired, a non-empty subject
// (the user's uid), and issue / sign-in times that are not in the future.
// Returns only what we use: { id, email, displayName }.
export function createTokenVerifier({ projectId, jwks = createRemoteJWKSet(GOOGLE_KEYS) }) {
  return async function verify(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) throw refuse();

    let payload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256'],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        clockTolerance: SKEW,
        requiredClaims: ['exp', 'iat', 'sub'],
      }));
    } catch (err) {
      throw keysUnreachable(err) ? new AppError('AUTH_UNAVAILABLE', 503, "Sign-in isn't available right now. Please try again in a moment.") : refuse();
    }

    const now = Date.now() / 1000;
    const { sub, iat, auth_time: authTime, email, name } = payload;
    if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) throw refuse();
    if (typeof iat !== 'number' || iat > now + SKEW) throw refuse();
    if (typeof authTime !== 'number' || authTime > now + SKEW) throw refuse();

    const mail = typeof email === 'string' && email ? email : null;
    const shown = (typeof name === 'string' && name.trim()) || mail?.split('@')[0] || 'Detective';
    return { id: sub, email: mail, displayName: shown.slice(0, 60) };
  };
}
