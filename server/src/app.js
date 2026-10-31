import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createCasesRouter } from './routes/cases.js';
import { optionalAuth } from './middleware/auth.js';
import { player } from './middleware/player.js';
import { errorHandler } from './middleware/error.js';
import { createLimiters } from './middleware/rate-limit.js';
import { corsMiddleware, noStore, requestLogger, requireJson } from './middleware/security.js';
import { turnstile } from './middleware/turnstile.js';
import { createTokenVerifier } from './services/firebase-token.js';
import { AppError } from './utils/app-error.js';

// Everything a test needs to vary is a parameter: the AI service, rate limits, Turnstile, Firebase (project id and the
// signing keys), the allowed client origins and the logger. `logger: null` silences logging (the default under NODE_ENV=test).
export function createApp({
  ai,
  limits,
  turnstile: turnstileOptions,
  firebase = { projectId: env.FIREBASE_PROJECT_ID },
  clientUrl = env.CLIENT_URL,
  logger = env.NODE_ENV === 'test' ? null : console,
} = {}) {
  const limiters = createLimiters(limits);
  const verify = firebase.projectId ? createTokenVerifier(firebase) : null; // null = sign-in not configured
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  if (logger) app.use(requestLogger(logger)); // first, so every response is logged, including 415 and 429
  app.use(helmet());
  app.use(corsMiddleware(clientUrl));
  app.use('/api', noStore); // before the limiter, so even a 429 carries it
  app.use('/api', limiters.global); // before body parsing: floods and junk bodies are refused cheaply
  app.use(requireJson);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use('/api', player);

  app.locals.ai = ai;
  app.locals.logger = logger;
  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ limiters, verify }));
  app.use('/api/cases', optionalAuth(verify), createCasesRouter({ limiters, turnstile: turnstile(turnstileOptions) }));
  app.use((_req, _res, next) => next(new AppError('ROUTE_NOT_FOUND', 404, 'Route not found')));
  app.use(errorHandler);
  return app;
}
