import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards for bugs that only showed up when the page was actually looked at in a browser. jsdom does not apply CSS,
// so these read the stylesheet itself (tests run with the client folder as the working directory).
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const ruleBody = (selector) => new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('index.css regressions', () => {
  it('the page-enter animation does not keep a transform after it ends (fill-mode must not be "both" or "forwards")', () => {
    // A transformed ancestor becomes the containing block for position:fixed. ScrollTrigger pins with position:fixed,
    // so a leftover transform on the page wrapper made the pinned "How it works" section scroll away invisibly.
    const decl = /--animate-page-enter:\s*([^;]+);/.exec(css)?.[1] ?? '';
    expect(decl).toMatch(/page-enter/);
    expect(decl).not.toMatch(/\b(both|forwards)\b/);
    expect(decl).toMatch(/\bbackwards\b/);
  });

  it('body has no background of its own, so the fixed lamp and vignette layers behind the content stay visible', () => {
    // The page colour lives on <html>. An opaque body paints over z-index:-1 layers.
    const body = ruleBody('body');
    expect(body).not.toMatch(/bg-ink|background/);
    expect(ruleBody('html')).toMatch(/background:\s*var\(--color-ink\)/);
  });

  it('the headline mask extends below the line so descenders (g, y, p) are not clipped', () => {
    expect(ruleBody('\\.hero-line-mask')).toMatch(/padding-bottom:\s*0\.\d+em/);
    expect(ruleBody('\\.hero-line-mask')).toMatch(/margin-bottom:\s*-0\.\d+em/);
  });

  it('reduced motion switches animations and transitions off at the CSS level too', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms\s*!important/);
  });
});
