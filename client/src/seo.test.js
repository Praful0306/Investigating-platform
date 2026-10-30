import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// (Run from the client folder, as `npm test` does.)
// Guards the first-load basics that Lighthouse checks: a real robots.txt, no third-party font request blocking the
// first paint, and the head tags a search result or a shared link needs.
const html = readFileSync('index.html', 'utf8');
const robots = readFileSync('public/robots.txt', 'utf8');
const main = readFileSync('src/main.jsx', 'utf8');

describe('robots.txt', () => {
  it('lets search engines in, and is plain text rather than the app\'s HTML', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/<html|<!doctype/i);
  });

  it('does not block the whole site by accident', () => {
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  });

  it('keeps crawlers out of the API only', () => {
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
  });
});

describe('index.html head', () => {
  it('loads no fonts from another site (they are self-hosted: no render-blocking third-party request)', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it('has a title, a description of a sensible length, a theme colour and share tags', () => {
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
    const description = /<meta name="description" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(170);
    expect(html).toMatch(/<meta name="theme-color"/);
    expect(html).toMatch(/<meta property="og:title"/);
    expect(html).toMatch(/<meta property="og:description"/);
  });

  it('is set to scale on phones and allows zooming', () => {
    expect(html).toMatch(/width=device-width, initial-scale=1/);
    expect(html).not.toMatch(/user-scalable=no|maximum-scale=1\b/);
  });
});

describe('fonts', () => {
  it('the three families are imported from the app itself, Latin only', () => {
    for (const family of ['inter', 'playfair-display', 'jetbrains-mono']) {
      expect(main, family).toMatch(new RegExp(`@fontsource/${family}/latin-`));
    }
    expect(main).not.toMatch(/@fontsource\/[a-z-]+\/(?:index|\d+)\.css/); // the all-scripts files are far bigger
  });

  it('only the weights the design uses are loaded', () => {
    const imports = main.match(/@fontsource\/[a-z-]+\/latin-[a-z0-9-]+\.css/g) ?? [];
    expect(imports.length).toBeLessThanOrEqual(12);
  });
});
