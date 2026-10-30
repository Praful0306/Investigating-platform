import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { createCasesRouter } from './routes/cases.js';
import { player } from './middleware/player.js';
import { errorHandler } from './middleware/error.js';
import { createLimiters } from './middleware/rate-limit.js';
import { corsMiddleware, requestLogger, requireJson } from './middleware/security.js';
import { turnstile } from './middleware/turnstile.js';
import { AppError } from './utils/app-error.js';

// Everything a test needs to vary is a parameter: the AI service, rate limits, Turnstile, the allowed client
// origins and the logger. `logger: null` silences logging (the default under NODE_ENV=test).
export function createApp({
  ai,
  limits,
  turnstile: turnstileOptions,
  clientUrl = env.CLIENT_URL,
  logger = env.NODE_ENV === 'test' ? null : console,
} = {}) {
  const limiters = createLimiters(limits);
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  if (logger) app.use(requestLogger(logger)); // first, so every response is logged, including 415 and 429
  app.use(helmet());
  app.use(corsMiddleware(clientUrl));
  app.use('/api', limiters.global); // before body parsing: floods and junk bodies are refused cheaply
  app.use(requireJson);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use('/api', player);

  app.locals.ai = ai;
  app.locals.logger = logger;
  app.use('/api/health', healthRouter);
  app.use('/api/cases', createCasesRouter({ limiters, turnstile: turnstile(turnstileOptions) }));
  app.use((_req, _res, next) => next(new AppError('ROUTE_NOT_FOUND', 404, 'Route not found')));
  app.use(errorHandler);
  return app;
}
