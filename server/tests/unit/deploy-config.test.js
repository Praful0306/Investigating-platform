import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { builtinModules } from 'node:module';
import { describe, expect, it } from 'vitest';

// Run from the server folder, as `npm test` does.
const blueprint = readFileSync('../render.yaml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const envBlock = (key) => new RegExp(`- key: ${key}\\s*\\n\\s+(value: [^\\n#]+|sync: false)`).exec(blueprint)?.[1]?.trim();

describe('render.yaml', () => {
  it('describes one free Node web service, built and started from the server folder', () => {
    expect(blueprint).toMatch(/type: web/);
    expect(blueprint).toMatch(/runtime: node/);
    expect(blueprint).toMatch(/plan: free/);
    expect(blueprint).toMatch(/rootDir: server/);
    expect(blueprint).toMatch(/startCommand: npm start/);
  });

  it('installs without the dev tools (no in-memory MongoDB download on the server)', () => {
    expect(blueprint).toMatch(/buildCommand: npm ci --omit=dev/);
  });

  it('is checked by the platform on /api/health', () => {
    expect(blueprint).toMatch(/healthCheckPath: \/api\/health/);
  });

  it('runs in production with the real AI provider, never the mock', () => {
    expect(envBlock('NODE_ENV')).toBe('value: production');
    expect(envBlock('AI_PROVIDERS')).toBe('value: gemini');
    expect(blueprint).not.toMatch(/AI_PROVIDERS[\s\S]{0,40}mock/);
  });

  it('counts two proxies in front of Express (Vercel rewrite + Render)', () => {
    expect(envBlock('TRUST_PROXY')).toBe('value: "2"');
  });

  it.each(['MONGODB_URI', 'GEMINI_API_KEY', 'CLIENT_URL', 'FIREBASE_PROJECT_ID', 'TURNSTILE_SECRET'])('%s is asked for in the dashboard, not written in the file', (key) => {
    expect(envBlock(key)).toBe('sync: false');
  });

  it('contains no secret-looking values', () => {
    expect(blueprint).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|mongodb\+srv:\/\/|gsk_|xai-|-----BEGIN/);
  });

  it('every variable it sets is one the server actually reads', () => {
    const envSource = readFileSync('src/config/env.js', 'utf8') + readFileSync('src/index.js', 'utf8');
    const keys = [...blueprint.matchAll(/- key: ([A-Z_]+)/g)].map((m) => m[1]).filter((k) => k !== 'NODE_VERSION');
    for (const key of keys) expect(envSource, key).toContain(key);
  });
});

describe('package.json (what Render runs)', () => {
  it('starts the real entry point and names a Node version the code supports', () => {
    expect(pkg.scripts.start).toBe('node src/index.js');
    expect(pkg.engines.node).toMatch(/>=20/);
  });
});

// With `npm ci --omit=dev` only "dependencies" are installed, so everything the server imports at run time must be there.
describe('production imports', () => {
  const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
  const files = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });

  it('every package under src/ is a real dependency (not a devDependency)', () => {
    const wanted = new Set();
    for (const file of files('src')) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"./][^'"]*)['"]/g)) {
        const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
        if (!builtins.has(m[1]) && !builtins.has(name)) wanted.add(name);
      }
    }
    expect(wanted.size).toBeGreaterThan(5); // the scan found the real imports
    for (const name of wanted) expect(pkg.dependencies, name).toHaveProperty(name);
  });

  it('nothing under src/ pulls in a test tool', () => {
    for (const file of files('src')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/mongodb-memory-server|supertest|vitest|nodemon/);
    }
  });
});
