import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Run from the client folder, as `npm test` does. Guards what the Vercel deployment depends on.
const raw = readFileSync('vercel.json', 'utf8');
const config = JSON.parse(raw);
const render = readFileSync('../render.yaml', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const turnstileSource = readFileSync('src/components/case/Turnstile.jsx', 'utf8');

const headersFor = (source) => Object.fromEntries((config.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [h.key, h.value]));
const everywhere = headersFor('/(.*)');
const policy = (everywhere['Content-Security-Policy-Report-Only'] ?? '').split(';').map((d) => d.trim()).filter(Boolean);
const directive = (name) => (policy.find((d) => d.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);

describe('vercel.json: routing', () => {
  it('sends /api/* to the Render service, then everything that is not /api to index.html (a refresh on /case/:id works)', () => {
    expect(config.rewrites).toHaveLength(2);
    const [api, spa] = config.rewrites;
    expect(api.source).toBe('/api/:path*');
    expect(spa.destination).toBe('/index.html');
    expect(spa.source).toMatch(/\(\?!api\//); // the fallback must not swallow API calls
    expect(new RegExp(`^${spa.source}$`).test('/case/6720c1f0a1b2c3d4e5f60718')).toBe(true);
    expect(new RegExp(`^${spa.source}$`).test('/api/health')).toBe(false);
  });

  it('the API address is https and is the service named in render.yaml, keeping the path', () => {
    const name = /name: (ai-mystery-room-api)/.exec(render)?.[1];
    expect(name).toBeTruthy();
    expect(config.rewrites[0].destination).toBe(`https://${name}.onrender.com/api/:path*`);
  });

  it('the app calls /api on its own address, which is what makes the cookie first-party', () => {
    expect(envExample).toMatch(/^VITE_API_BASE_URL=\/api$/m);
  });
});

describe('vercel.json: security headers', () => {
  it('sets the four basic headers on every page', () => {
    expect(everywhere['X-Content-Type-Options']).toBe('nosniff');
    expect(everywhere['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(everywhere['X-Frame-Options']).toBe('DENY');
    expect(everywhere['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('does not set a cross-origin opener policy (it would break the Google sign-in pop-up)', () => {
    expect(raw).not.toMatch(/Cross-Origin-Opener-Policy/i);
  });

  it('caches the hashed files in /assets for a year, and nothing else that way', () => {
    expect(headersFor('/assets/(.*)')['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(everywhere['Cache-Control']).toBeUndefined(); // index.html must always be fresh
  });
});

describe('vercel.json: content security policy', () => {
  it('is delivered report-only for now: it logs violations in the browser console but cannot break sign-in before it has been tried with real Firebase', () => {
    expect(everywhere['Content-Security-Policy-Report-Only']).toBeTruthy();
    expect(everywhere['Content-Security-Policy']).toBeUndefined();
  });

  it('allows nothing by default and nothing dangerous: no eval, no inline scripts, no wildcard scripts, no plugins', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
    const script = directive('script-src');
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script.join(' ')).not.toMatch(/\*(?!\.)|https:(\s|$)/);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'self'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });

  it('allows the app\'s own scripts, and exactly the outside scripts it uses: Cloudflare Turnstile and Google (sign-in)', () => {
    expect(directive('script-src')).toEqual(["'self'", 'https://challenges.cloudflare.com', 'https://apis.google.com']);
  });

  it('the Turnstile script the code loads is covered', () => {
    const host = /https:\/\/[^/']+/.exec(turnstileSource)?.[0];
    expect(host).toBe('https://challenges.cloudflare.com');
    expect(directive('script-src')).toContain(host);
    expect(directive('frame-src')).toContain(host);
  });

  it('lets the page talk to itself and to Firebase Authentication only', () => {
    expect(directive('connect-src')).toEqual([
      "'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com',
    ]);
  });

  it('allows the Firebase sign-in frame and the Google account chooser', () => {
    const frames = directive('frame-src');
    expect(frames).toContain('https://*.firebaseapp.com');
    expect(frames).toContain('https://accounts.google.com');
  });

  it('fonts come from the site itself (they are self-hosted); inline styles are allowed because the animation library sets them', () => {
    expect(directive('font-src')).toEqual(["'self'"]);
    expect(directive('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('images: the site, inline data, and Google profile pictures', () => {
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'https://*.googleusercontent.com']);
  });
});

describe('vercel.json: hygiene', () => {
  it('has no secrets in it', () => {
    expect(raw).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|mongodb\+srv|gsk_|xai-|JWT_SECRET|-----BEGIN/);
  });

  it('has no leftover placeholder addresses', () => {
    expect(raw).not.toMatch(/<[a-z-]+>|your-app|example\.com/i);
  });
});
