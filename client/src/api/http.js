import axios from 'axios';

// Same-origin `/api` everywhere: the Vite proxy in dev, the Vercel rewrite in production, so cookies stay first-party.
// 90 s: the first request after the free backend slept can take about a minute.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 90000,
});

// Signed-in players prove who they are with their Firebase ID token (SPEC §5.1). The auth layer registers a function that
// returns the current token (or null for a guest); it is asked on every request, so a refreshed token is always used.
// A token that cannot be fetched must never break the request: it simply goes out as a guest.
let tokenProvider = null;
export function setAuthTokenProvider(fn) {
  tokenProvider = fn;
}
http.interceptors.request.use(async (config) => {
  if (!tokenProvider) return config;
  try {
    const token = await tokenProvider();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  } catch { /* no token: carry on as a guest */ }
  return config;
});

const text = (value, fallback) => (typeof value === 'string' && value ? value : fallback);

// Flattens anything that can go wrong into { status, code, message, details? }. Never throws, never leaks HTML or stacks.
export function toApiError(err) {
  // already mapped (the mock API throws these directly)
  if (err && typeof err === 'object' && !(err instanceof Error) && typeof err.code === 'string' && typeof err.status === 'number') {
    return err;
  }
  if (axios.isCancel(err)) return { status: 0, code: 'CANCELED', message: 'Request canceled.' };

  if (err?.response) {
    const { status, data } = err.response;
    const envelope = data?.error;
    if (envelope && typeof envelope === 'object') {
      return {
        status,
        code: text(envelope.code, 'INTERNAL_ERROR'),
        message: text(envelope.message, 'The server had a problem. Please try again.'),
        ...(envelope.details && { details: envelope.details }),
      };
    }
    // a proxy or host error page rather than our JSON envelope
    return status === 429
      ? { status, code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' }
      : { status, code: 'INTERNAL_ERROR', message: 'The server had a problem. Please try again.' };
  }

  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return { status: 0, code: 'TIMEOUT', message: 'The server took too long. It may be waking up, please try again.' };
  }
  return { status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' };
}
