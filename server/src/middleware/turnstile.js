import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const failed = () => new AppError('CAPTCHA_FAILED', 403, 'The bot check failed. Please try again.');

// Optional bot check for case creation. Off unless TURNSTILE_SECRET is set. Fails closed: anything other than an
// explicit `success: true` from Cloudflare is a rejection. Must run AFTER body validation: a token is single-use,
// so verifying it for a request that is then rejected would burn the visitor's token.
export function turnstile(options = {}) {
  const { fetchImpl = fetch, timeoutMs = 5000 } = options;
  const secret = 'secret' in options ? options.secret : env.TURNSTILE_SECRET;

  return async (req, _res, next) => {
    if (!secret) return next();
    const token = req.body?.turnstileToken;
    if (!token) throw failed();

    let ok = false;
    try {
      const res = await fetchImpl(VERIFY_URL, {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token, remoteip: req.ip }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      ok = res.ok && (await res.json()).success === true;
    } catch {
      ok = false;
    }
    if (!ok) throw failed();
    next();
  };
}
