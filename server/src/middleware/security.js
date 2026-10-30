import cors from 'cors';
import { AppError } from '../utils/app-error.js';

// CLIENT_URL may be a comma list. Browsers send the origin without a trailing slash.
// Requests with no Origin header (curl, health checks, server-to-server) are allowed; browsers always send one.
export function corsMiddleware(clientUrl) {
  const allowed = new Set(clientUrl.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean));
  return cors({ origin: (origin, cb) => cb(null, !origin || allowed.has(origin)), credentials: true });
}

// SPEC S13: a body must be JSON. Blocks form / text / multipart posts, which is also what cross-site forms send.
export function requireJson(req, _res, next) {
  const hasBody = Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (hasBody && !req.is('application/json')) {
    return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Send the request body as application/json.'));
  }
  next();
}

// One line per request: method, path (no query string), status, time, client ip.
// Never the body, cookies or headers. The ip is there so TRUST_PROXY can be checked after deploy.
export function requestLogger(logger) {
  return (req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
      logger.info(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms}ms ip=${req.ip}`);
    });
    next();
  };
}
