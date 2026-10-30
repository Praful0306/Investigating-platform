import { randomUUID } from 'node:crypto';
import { env, isProd } from '../config/env.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// SameSite=None requires Secure; only used when the client calls the API cross-origin (no Vercel rewrite).
export function cookieOptions(maxAge) {
  const cross = env.CROSS_SITE_COOKIES === 'true';
  return { httpOnly: true, sameSite: cross ? 'none' : 'lax', secure: isProd || cross, maxAge, path: '/' };
}

export function player(req, res, next) {
  let pid = req.cookies?.mr_pid;
  if (!pid || !UUID.test(pid)) {
    pid = randomUUID();
    res.cookie('mr_pid', pid, cookieOptions(180 * 864e5));
  }
  req.playerId = pid;
  next();
}
