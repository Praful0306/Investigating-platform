# AI Mystery Room — Design System (MASTER)

> Source of truth for visual decisions. Tokens live in `client/src/index.css` (`@theme`); the contract with the build
> is `specs/04-frontend.md` §1. Page-specific overrides, if ever needed, go in `pages/<name>.md` next to this file.

## How this was decided (verified vs fallback)

| Question | Source | Result |
|---|---|---|
| Whole-product style | `ui-ux-pro-max --design-system` | **Rejected.** It returned pastel *Claymorphism / pink* because "game" and "puzzle" dominated the query. Wrong product, so not persisted (skill rule: never persist unverified output). |
| Surface treatment | `--domain style "dark cinematic noir editorial film grain"` | **Verified match:** *Vintage Analog / Retro Film* (film grain via SVG filter, warm light leaks, fade-in transitions). Used as the accent surface treatment. |
| Typography | `--domain typography "serif display dramatic editorial dark"` | **Verified match:** *Playfair Display + Inter* ("Classic Elegant") and the triple stack *Playfair + JetBrains Mono* (Playfair 900, tight tracking, for heroes). Same as the spec. |
| Palette | `--domain color "dark amber noir detective"` | **No match** (returned an alarm-clock palette). **Fallback:** the spec's own noir tokens, contrast-checked below. |

## One primary style: **Noir Case File** (dark editorial)

A detective's desk at night: near-black felt, one amber desk-lamp as the only accent, aged paper evidence cards, a
magazine-style serif for titles. *Retro Film* supplies grain and warm light only. No glass, no neon, no clay, no
neumorphism (mixing surface styles reads as cheap).

**Depth comes from light, not borders:** a warm lamp bloom top-left, a vignette, 1px translucent edges
(`white / 8-14 %`), inner highlights. Hard grey borders and default shadows are banned.

## Tokens

| Token | Value | Use | Contrast on `ink` |
|---|---|---|---|
| `ink` | `#0b0b0f` | page | n/a |
| `felt` | `#14141b` | panels | n/a |
| `paper` / `paper-ink` | `#efe6d2` / `#2a2219` | evidence cards | 12:1 (text on paper) |
| `amber` | `#f5a524` | the one accent (<= 10 % of pixels) | 9:1 |
| `moss` | `#4caf7a` | success, easy, "solved" | 7:1 |
| `blood` | `#d94848` | danger, hard, "unsolved" (large/bold only) | 4.7:1 |
| `blood-soft` | `#f08585` | small danger text | 7:1 |
| `mist` | `#a1a1b5` | muted text | 8:1 |

Radii: **12** (chips, inputs) / **20** (cards) / **28** (panels). Spacing: 8 px grid. Shadows are warm and low:
`lamp` (amber bloom), `card`, `paper`.

## Typography

- Display: **Playfair Display** 600/700/900 + italic 500. Hero `clamp(2.75rem, 8vw, 6rem)`, weight 900, tracking `-0.03em`,
  leading `0.95`. At most one treatment trick per headline (an italic or amber word).
- Body: **Inter** 400/500/600, 16 px base, line-height 1.6, measure <= 68ch.
- Mono: **JetBrains Mono** for case numbers (`CASE #A1F3`), counters and timers.

## Motion (GSAP via `@gsap/react` `useGSAP`, plus CSS for micro-states)

- UI feedback 150-250 ms; reveals 400-700 ms; only `transform` and `opacity`; ease `cubic-bezier(.22,1,.36,1)`.
- Signature moments (built in T-14-T-18): hero letter rise + lamp sweep; clue flip; red-string between found clues; hint
  envelope; "ACCUSED" stamp; SOLVED/UNSOLVED stamp; score count-up; scroll-linked reveals on Home (ScrollTrigger).
- Everything checks `useReducedMotion()`: reduced = render final states, no loops, no parallax. A CSS media query also
  kills transitions as a backstop.
- Scroll rules: create ScrollTriggers top-to-bottom, scrub *or* toggleActions (never both), always inside `useGSAP`
  with a `scope`, never `markers: true` in a commit.

## Components (all in `client/src/components/ui/`)

Button (primary / ghost / danger, `loading`) · Card (`felt` / `paper`, optional tilt) · Badge (difficulty tones) ·
Modal (focus trap, Esc, `aria-modal`) · Toast (polite live region) · ProgressBar · Skeleton · Spinner · ErrorState.
Icons: **Lucide** only (one SVG set, `aria-hidden` when decorative). No emoji as icons.

## Accessibility bar

Text >= 4.5:1 (checked above); visible amber focus ring on every control; targets >= 44 px; keyboard reachable;
`aria-live="polite"` for toasts and hint reveals; skip link; one `<h1>` per page; decorative layers `aria-hidden`.

## Anti-patterns for this product

Pastel/rounded "toy" styling, neon glow, glass blur over flat dark, gradients on text everywhere, emoji icons, more
than one accent hue, animation that blocks input, anything that suggests the answer before the player earns it.
