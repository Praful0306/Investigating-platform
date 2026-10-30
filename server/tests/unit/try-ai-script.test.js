import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// Runs the real script as a child process, on the mock provider (no network, no quota).
const run = (...argv) =>
  spawnSync(process.execPath, ['scripts/try-ai.mjs', ...argv], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', AI_PROVIDERS: 'mock' },
  });
const PREMISE = 'A stolen trophy at a college cricket final';

describe('scripts/try-ai.mjs', () => {
  it.each([['easy', [3, 5, 2]], ['medium', [4, 7, 3]], ['hard', [5, 9, 3]]])('%s: prints provider, attempts and counts', (d, [s, c, h]) => {
    const r = run(d, PREMISE);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/provider:\s+mock/);
    expect(r.stdout).toMatch(/attempts:\s+1/);
    expect(r.stdout).toMatch(new RegExp(`suspects:\\s+${s}`));
    expect(r.stdout).toMatch(new RegExp(`clues:\\s+${c}`));
    expect(r.stdout).toMatch(new RegExp(`hints:\\s+${h}`));
    expect(r.stdout).toMatch(/latencyMs:\s+\d+/);
  });

  it('does not print the solution by default', () => {
    const r = run('easy', PREMISE);
    expect(r.stdout + r.stderr).not.toMatch(/MOCK_SECRET_EXPLANATION|culpritId|keyClueIds|explanation/);
  });

  it('prints the solution only with --show-solution', () => {
    const r = run('easy', PREMISE, '--show-solution');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/MOCK_SECRET_EXPLANATION/);
  });

  it.each([
    ['unknown difficulty', ['extreme', PREMISE]],
    ['missing premise', ['easy']],
    ['premise too short', ['easy', 'short']],
  ])('%s -> usage message and exit 1', (_n, argv) => {
    const r = run(...argv);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Usage/);
  });

  it('no usable provider -> clear message and exit 1', () => {
    const r = spawnSync(process.execPath, ['scripts/try-ai.mjs', 'easy', PREMISE], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', AI_PROVIDERS: 'gemini', GEMINI_API_KEY: '' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/No AI provider/i);
  });
});
