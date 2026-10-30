import { AppError } from '../utils/app-error.js';

const BEARER = /^Bearer\s+(\S+)$/i;

// No Authorization header = a guest, as before. A header that is there must be a valid Firebase ID token:
// a bad or expired one is a 401 (never quietly downgraded to a guest, which would hide the problem from the client).
// `verify` is null when the server has no FIREBASE_PROJECT_ID: sending a token is then a 503, not a silent guest.
export function optionalAuth(verify) {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (header === undefined) return next();
    const token = BEARER.exec(header)?.[1];
    if (!token) return next(new AppError('UNAUTHORIZED', 401, 'Please sign in again.'));
    if (!verify) return next(new AppError('AUTH_UNAVAILABLE', 503, "Sign-in isn't available right now."));
    try {
      req.user = await verify(token);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new AppError('UNAUTHORIZED', 401, 'Please sign in to continue.'));
  return next();
}
