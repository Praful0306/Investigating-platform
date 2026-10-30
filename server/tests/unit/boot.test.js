import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// Starts the real entry point with env that must make it refuse to boot (it exits before touching the DB).
const boot = (env) =>
  spawnSync(process.execPath, ['src/index.js'], {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/never-used', GEMINI_API_KEY: '', ...env },
  });

describe('src/index.js boot checks', () => {
  it('no usable AI provider -> exit 1 with a clear message', () => {
    const r = boot({ NODE_ENV: 'development', AI_PROVIDERS: 'gemini' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/No AI provider/i);
  });

  it('mock provider in production -> refused, exit 1', () => {
    const r = boot({ NODE_ENV: 'production', AI_PROVIDERS: 'mock' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/No AI provider/i);
    expect(r.stderr).toMatch(/mock/);
  });

  it('production with gemini listed but no key -> exit 1 naming GEMINI_API_KEY', () => {
    const r = boot({ NODE_ENV: 'production', AI_PROVIDERS: 'gemini' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/GEMINI_API_KEY/);
  });
});
