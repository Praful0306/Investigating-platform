import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShutdown, tuneServer } from '../../src/server-lifecycle.js';

const quiet = () => ({ info: vi.fn(), error: vi.fn() });

function parts(overrides = {}) {
  const order = [];
  const server = {
    close: vi.fn((cb) => { order.push('close'); cb(); }),
    closeIdleConnections: vi.fn(() => order.push('idle')),
    ...overrides.server,
  };
  const disconnect = vi.fn(async () => { order.push('disconnect'); });
  const exit = vi.fn((code) => order.push(`exit:${code}`));
  const log = quiet();
  return { server, disconnect: overrides.disconnect ?? disconnect, exit, log, order, timeoutMs: 1000 };
}

describe('createShutdown (what happens when Render stops the service)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stops taking new requests, lets finished connections go, closes the database, then exits 0, in that order', async () => {
    const p = parts();
    await createShutdown(p)('SIGTERM');
    expect(p.order).toEqual(['close', 'idle', 'disconnect', 'exit:0']);
  });

  it('says which signal it got', async () => {
    const p = parts();
    await createShutdown(p)('SIGTERM');
    expect(p.log.info.mock.calls[0][0]).toContain('SIGTERM');
  });

  it('waits for in-flight requests: the exit comes only after the server has finished closing', async () => {
    let finishClosing;
    const p = parts({ server: { close: vi.fn((cb) => { finishClosing = cb; }) } });
    const done = createShutdown(p)('SIGTERM');
    await vi.advanceTimersByTimeAsync(500);
    expect(p.exit).not.toHaveBeenCalled(); // a request (an AI generation, say) is still running
    finishClosing();
    await done;
    expect(p.exit).toHaveBeenCalledWith(0);
  });

  it('a second signal while shutting down does nothing more', async () => {
    const p = parts();
    const shutdown = createShutdown(p);
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);
    expect(p.server.close).toHaveBeenCalledTimes(1);
    expect(p.exit).toHaveBeenCalledTimes(1);
  });

  it('gives up after the time limit and exits 1 rather than hanging forever', async () => {
    const p = parts({ server: { close: vi.fn(() => {}) } }); // never finishes
    createShutdown(p)('SIGTERM');
    await vi.advanceTimersByTimeAsync(1001);
    expect(p.exit).toHaveBeenCalledWith(1);
    expect(p.log.error.mock.calls.flat().join(' ')).toMatch(/forced|timeout|timed out/i);
  });

  it('a failure while closing is logged and exits 1', async () => {
    const p = parts({ server: { close: vi.fn((cb) => cb(new Error('boom'))) } });
    await createShutdown(p)('SIGTERM');
    expect(p.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalled();
  });

  it('a failure while disconnecting the database is logged and exits 1', async () => {
    const p = parts({ disconnect: vi.fn(async () => { throw new Error('db gone'); }) });
    await createShutdown(p)('SIGTERM');
    expect(p.exit).toHaveBeenCalledWith(1);
  });

  it('the time limit does not fire after a clean exit', async () => {
    const p = parts();
    await createShutdown(p)('SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);
    expect(p.exit).toHaveBeenCalledTimes(1);
  });

  it('works with an older server object that has no closeIdleConnections', async () => {
    const p = parts({ server: { closeIdleConnections: undefined } });
    await createShutdown(p)('SIGTERM');
    expect(p.exit).toHaveBeenCalledWith(0);
  });

  it('never prints secrets or the environment', async () => {
    const p = parts();
    await createShutdown(p)('SIGTERM');
    expect(JSON.stringify([p.log.info.mock.calls, p.log.error.mock.calls])).not.toMatch(/mongodb|key|secret|password/i);
  });
});

describe('tuneServer (Render\'s proxy sits in front of Node)', () => {
  it('keeps idle connections open longer than the proxy does, so it never reuses one Node already closed (that shows up as random 502s)', () => {
    const server = {};
    tuneServer(server);
    expect(server.keepAliveTimeout).toBeGreaterThanOrEqual(65_000);
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });

  it('returns the same server so it can be chained', () => {
    const server = {};
    expect(tuneServer(server)).toBe(server);
  });
});
