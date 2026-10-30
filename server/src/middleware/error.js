import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details && { details }) } });

// Express identifies error middleware by its 4 arguments; keep `_next`.
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return _next(err);
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', details[0]?.message ?? 'Invalid request', details);
  }
  if (err instanceof AppError) return send(res, err.status, err.code, err.message, err.details);
  if (err instanceof mongoose.Error.CastError) return send(res, 400, 'INVALID_ID', 'Invalid id');
  // body-parser errors (malformed JSON, body over the 10kb limit)
  if (err?.type === 'entity.parse.failed') return send(res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON.');
  if (err?.type === 'entity.too.large') return send(res, 400, 'VALIDATION_ERROR', 'Request body is too large.');
  if (process.env.NODE_ENV !== 'test') console.error('[error]', err); // full error stays server-side
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
}
