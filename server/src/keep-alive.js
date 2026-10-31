// A free Render web service goes to sleep after 15 minutes without incoming requests, and the first visitor after that
// waits about a minute. A request the service sends to its OWN public address comes back in through Render's front
// door, so it counts as traffic: while the server is awake, this keeps it awake. (It cannot wake a sleeping server;
// that is what the outside ping in .github/workflows/keep-alive.yml and an uptime monitor are for.)
export const DEFAULT_INTERVAL_MS = 10 * 60_000;
const TIMEOUT_MS = 30_000;

// The address to ping, or null when it is not a usable https address. Render always serves https.
export function keepAliveUrl(baseUrl) {
  if (typeof baseUrl !== 'string') return null;
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return `${url.origin}/api/health`;
}

// Returns a function that stops it. Never throws and never stops by itself: a failed ping is logged and the next one
// is tried on schedule. Only one ping runs at a time.
export function startKeepAlive({
  baseUrl,
  intervalMs = DEFAULT_INTERVAL_MS,
  minIntervalMs = 1000,
  fetchImpl = fetch,
  setIntervalImpl = setInterval,
  log = console,
}) {
  const url = keepAliveUrl(baseUrl);
  if (!url) {
    log.warn('Keep-alive not started: RENDER_EXTERNAL_URL is not a usable https address.');
    return () => {};
  }

  let running = false;
  async function ping() {
    if (running) return;
    running = true;
    try {
      const res = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) log.warn(`Keep-alive ping answered ${res.status}`);
    } catch (err) {
      log.warn(`Keep-alive ping failed: ${err?.message ?? err}`);
    } finally {
      running = false;
    }
  }

  const every = Math.max(intervalMs, minIntervalMs);
  const timer = setIntervalImpl(ping, every);
  timer.unref?.(); // never the reason the process stays alive
  log.info(`Keep-alive: pinging ${url} every ${Math.round(every / 60_000)} min`);
  return () => clearInterval(timer);
}
