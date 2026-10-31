import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/app-error.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// specs/03-security.md §2. Tests lower these through createApp({ limits }).
export const DEFAULT_LIMITS = Object.freeze({
  // Behind the Vercel rewrite every visitor reaches the API from the proxy's address, so these per-IP counters are shared
  // by many people: they are a ceiling against floods and runaway Gemini use, not a per-person limit (that is `create`).
  global: { windowMs: MINUTE, limit: 600 }, // per IP, every /api route
  create: { windowMs: 10 * MINUTE, limit: 5 }, // per player: each new case costs one AI call
  daily: { windowMs: DAY, limit: 120 }, // per IP: stops "clear the cookie, ask again" (a cost ceiling for the AI)
  auth: { windowMs: 15 * MINUTE, limit: 300 }, // per IP: the client calls /auth/session once per sign-in
});

// Logged-in users are counted by account, guests by their cookie.
export const playerKey = (req) => req.user?.id ?? req.playerId;

// Rejections go through the normal error middleware, so clients always get the same JSON envelope.
const limiter = (config, message, keyGenerator) =>
  rateLimit({
    ...config,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }), // no custom key = the library's IPv6-safe per-IP default
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED', 429, message)),
  });

// A new set of counters per app, so tests never share state.
export function createLimiters(overrides = {}) {
  const cfg = Object.fromEntries(Object.entries(DEFAULT_LIMITS).map(([k, v]) => [k, { ...v, ...overrides[k] }]));
  return {
    global: limiter(cfg.global, 'Too many requests. Please slow down and try again shortly.'),
    create: limiter(cfg.create, 'Too many new cases. Please wait a few minutes before generating another.', playerKey),
    daily: limiter(cfg.daily, 'The daily limit for new cases was reached. Please try again tomorrow.'),
    auth: limiter(cfg.auth, 'Too many sign-in attempts. Please wait a few minutes and try again.'),
  };
}
