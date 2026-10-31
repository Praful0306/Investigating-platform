// Starting and stopping the server the way a hosting platform expects.

// Behind a load balancer (Render's, Vercel's rewrite) Node must keep an idle connection open LONGER than the balancer
// does; otherwise the balancer reuses a connection Node just closed and the visitor sees a random 502.
// headersTimeout has to be larger than keepAliveTimeout.
export function tuneServer(server) {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
}

// On every redeploy Render sends SIGTERM and then kills the process after a grace period. A mystery being generated
// (up to ~40 s) should finish first: stop taking new requests, let the running ones end, close the database, exit.
// If that takes longer than `timeoutMs`, leave anyway with a failure code rather than hang.
export function createShutdown({ server, disconnect, exit = process.exit, log = console, timeoutMs = 25_000 }) {
  let started = false;
  return async function shutdown(signal) {
    if (started) return;
    started = true;
    log.info(`${signal} received: finishing running requests, then shutting down`);

    const force = setTimeout(() => {
      log.error(`shutdown timed out after ${timeoutMs} ms: exiting anyway`);
      exit(1);
    }, timeoutMs);
    force.unref?.();

    try {
      const closed = new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      server.closeIdleConnections?.(); // connections with no request on them would otherwise hold close() open
      await closed;
      await disconnect();
      clearTimeout(force);
      exit(0);
    } catch (err) {
      clearTimeout(force);
      log.error(`shutdown failed: ${err?.message ?? err}`);
      exit(1);
    }
  };
}
