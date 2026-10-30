import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { player } from './middleware/player.js';
import { errorHandler } from './middleware/error.js';
import { AppError } from './utils/app-error.js';

// `ai` is injected so tests can pass the mock provider (used from T-09).
// T-11 adds helmet, CORS allow-list, 415 guard, logger and rate limiters at the marked spot.
export function createApp({ ai } = {}) {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  // T-11: helmet, cors, request logger, global limiter go here
  app.use('/api', player);
  app.locals.ai = ai;
  app.use('/api/health', healthRouter);
  app.use((_req, _res, next) => next(new AppError('ROUTE_NOT_FOUND', 404, 'Route not found')));
  app.use(errorHandler);
  return app;
}
