import { describe, expect, it, vi } from 'vitest';
import { createAiService } from '../../src/services/ai/index.js';
import { mockProvider } from '../../src/services/ai/providers/mock.js';
import { SYSTEM_PROMPT } from '../../src/services/ai/prompt.js';
import { ProviderError } from '../../src/utils/provider-error.js';
import { AppError } from '../../src/utils/app-error.js';

const quiet = { warn: vi.fn() };
const req = { premise: 'A stolen trophy at a college cricket final', difficulty: 'easy' };
const svc = (providers, opts) => createAiService(providers, { logger: quiet, ...opts });
const fail = (p) => p.then(() => { throw new Error('expected rejection'); }, (e) => e);
const hang = { name: 'hang', model: 'x', generate: () => new Promise(() => {}) };

describe('createAiService.generateCase', () => {
  it.each(['easy', 'medium', 'hard'])('valid %s -> data with right counts + meta', async (difficulty) => {
    const p = mockProvider();
    const { data, meta } = await svc([p]).generateCase({ ...req, difficulty });
    const counts = { easy: [3, 5, 2], medium: [4, 7, 3], hard: [5, 9, 3] }[difficulty];
    expect([data.suspects.length, data.clues.length, data.hints.length]).toEqual(counts);
    expect(meta).toMatchObject({ provider: 'mock', model: p.model, attempts: 1 });
    expect(meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('sends the system prompt and an exact-size JSON schema to the provider', async () => {
    const p = mockProvider();
    await svc([p]).generateCase({ ...req, difficulty: 'hard' });
    const [call] = p.calls;
    expect(call.system).toBe(SYSTEM_PROMPT);
    expect(call.jsonSchema.properties.suspects.minItems).toBe(5);
    expect(call.prompt).toContain('exactly 9 clues');
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it('invalid-once -> succeeds on attempt 2 and the retry prompt carries the feedback', async () => {
    const p = mockProvider({ mode: 'invalid-once' });
    const { meta } = await svc([p]).generateCase(req);
    expect(meta.attempts).toBe(2);
    expect(p.calls[0].prompt).not.toMatch(/rejected/);
    expect(p.calls[1].prompt).toMatch(/previous output was rejected/);
    expect(p.calls[1].prompt).toMatch(/title|Invalid input|expected/i); // the validator's reasons are passed along
  });

  it('invalid-always -> 502 AI_GENERATION_FAILED after exactly 3 attempts', async () => {
    const p = mockProvider({ mode: 'invalid-always' });
    const e = await fail(svc([p]).generateCase(req));
    expect(e).toBeInstanceOf(AppError);
    expect([e.code, e.status]).toEqual(['AI_GENERATION_FAILED', 502]);
    expect(p.calls).toHaveLength(3);
  });

  it('[unavailable, valid] -> falls back; meta.provider is the second', async () => {
    const down = mockProvider({ mode: 'unavailable', name: 'down' });
    const up = mockProvider({ name: 'up' });
    const { meta } = await svc([down, up]).generateCase(req);
    expect(meta.provider).toBe('up');
    expect(down.calls).toHaveLength(1);
  });

  it('[unavailable] -> 503 AI_UNAVAILABLE', async () => {
    const e = await fail(svc([mockProvider({ mode: 'unavailable' })]).generateCase(req));
    expect([e.code, e.status]).toEqual(['AI_UNAVAILABLE', 503]);
  });

  it('no providers at all -> 503 AI_UNAVAILABLE', async () => {
    const e = await fail(svc([]).generateCase(req));
    expect([e.code, e.status]).toEqual(['AI_UNAVAILABLE', 503]);
  });

  it('attempts are capped at 3 in total across providers', async () => {
    const bad = mockProvider({ mode: 'invalid-always', name: 'bad' });
    const good = mockProvider({ name: 'good' });
    const e = await fail(svc([bad, good]).generateCase(req));
    expect(e.code).toBe('AI_GENERATION_FAILED');
    expect(bad.calls).toHaveLength(3);
    expect(good.calls).toHaveLength(0);
  });

  it('invalid output followed by a provider outage still reports 502 (the AI did answer)', async () => {
    let n = 0;
    const flaky = {
      name: 'flaky', model: 'x',
      generate: async () => { if (n++ === 0) return '{"oops":true}'; throw new ProviderError('quota', 429, true); },
    };
    const e = await fail(svc([flaky]).generateCase(req));
    expect(e.code).toBe('AI_GENERATION_FAILED');
  });

  it('a provider that hangs is cut off at timeoutMs and treated as unavailable', async () => {
    const t0 = Date.now();
    const e = await fail(svc([hang], { timeoutMs: 40 }).generateCase(req));
    expect(e.code).toBe('AI_UNAVAILABLE');
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('a hanging first provider falls through to the next one', async () => {
    const { meta } = await svc([hang, mockProvider({ name: 'ok' })], { timeoutMs: 40 }).generateCase(req);
    expect(meta.provider).toBe('ok');
  });

  it('never logs the premise or the provider output', async () => {
    const logger = { warn: vi.fn() };
    await svc([mockProvider({ mode: 'invalid-once' })], { logger }).generateCase(req);
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logger.warn).toHaveBeenCalled();
    expect(logged).not.toContain(req.premise);
    expect(logged).not.toContain('oops');
  });
});
