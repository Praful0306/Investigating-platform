import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details && { details }) } });

// What the server log gets for an unexpected error: the kind, a short message and the stack frames.
// Never field values: a Mongoose ValidationError message quotes the offending text (premise, story, solution).
function describeError(err) {
  const name = err?.name ?? 'Error';
  const message = name === 'ValidationError' && err.errors
    ? `invalid paths: ${Object.keys(err.errors).join(', ')}`
    : String(err?.message ?? err).slice(0, 300);
  const frames = String(err?.stack ?? '').split('\n').filter((l) => l.trim().startsWith('at ')).slice(0, 6).join('\n');
  return `${name}: ${message}${frames ? `\n${frames}` : ''}`;
}

// Express identifies error middleware by its 4 arguments; keep `next`.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', details[0]?.message ?? 'Invalid request', details);
  }
  if (err instanceof AppError) return send(res, err.status, err.code, err.message, err.details);
  if (err instanceof mongoose.Error.CastError) return send(res, 400, 'INVALID_ID', 'Invalid id');
  // body-parser errors (malformed JSON, body over the 10kb limit)
  if (err?.type === 'entity.parse.failed') return send(res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON.');
  if (err?.type === 'entity.too.large') return send(res, 400, 'VALIDATION_ERROR', 'Request body is too large.');
  req.app?.locals?.logger?.error?.('[error]', describeError(err)); // the full error never leaves the server
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
}
