# FEATURES.md — what makes this a solid small-scale real app

Research summary: the brief is graded on (1) a spec another AI can follow, (2) the 6 acceptance criteria, especially **solution secrecy** and **backend scoring**, and (3) a working deployed game. Extra features only help if they don't put those at risk. So features are tiered by value ÷ risk.

## Tier 1 — Required (from the guide)
- Premise + difficulty → Gemini-generated case (3/5/2, 4/7/3, 5/9/3).
- Investigation room: story, suspects, clues, hints, progress.
- Clue discovery, hints, single accusation.
- Backend scoring: 100/150/200 + 5/clue − 10/hint, min 0.
- Result: verdict, culprit, explanation, score. New mystery.
- AI output validation; culprit kept server-side; graceful API failure handling.
- Deployed: Vercel + backend host + Atlas.

## Tier 2 — Recommended (makes it feel like a real product; all in the plan)
| Feature | Why it matters | Cost |
|---|---|---|
| **Guest-first identity cookie + case ownership** | Stops strangers playing/reading your case by URL; no login wall for graders | S |
| **Validation with retry-and-feedback** | Turns flaky LLM output into reliable cases; saves quota vs blind retries | M |
| **LLM fallback chain** (Gemini → OpenAI-compatible: Groq / Cloudflare Workers AI / Grok / Catalyst) | Demo survives a Gemini 429 during grading | S (one adapter) |
| **Rate limiting + daily cap** (+ optional Cloudflare Turnstile) | Protects the free quota from bots and refresh-spamming | S |
| **Optional login (email/password, httpOnly JWT)** + **My cases history** | Real-app feel; resumes unfinished cases across devices; guest cases auto-claimed on login | M |
| **Clue cards that flip, hints with cost confirmation, accusation confirm** | Game feel + prevents accidental point loss | S |
| **Cold-start "waking up the detective" + health pre-warm** | Free hosts sleep; this avoids a "broken site" first impression | S |
| **Noir design system, GSAP motion, 21st.dev components, reduced-motion support** | Polish graders notice; accessible | M |
| **Automated tests incl. a leak test + production smoke script** | Proves the security and scoring claims | M |
| **CI on GitHub Actions** | Green badge in README; catches regressions from multiple AI tools | S |

## Tier 3 — Nice-to-have (only after the live site passes smoke ×3)
| Feature | Notes |
|---|---|
| 3D hero scene (React Three Fiber) | Home only, lazy, desktop only, reduced-motion fallback |
| Leaderboard per difficulty | Uses the existing score index; display names only for logged-in users |
| Share result card | Web Share API / copy text; no solution spoilers in the share text |
| Detective notebook | Player notes per case stored in `sessionStorage` (or on the case for logged-in users) |
| Suspect "interrogation" (ask one question per suspect via Gemini) | Fun, but each question costs an AI call and risks leaking the culprit — needs answers pre-generated at creation time instead of live. Post-deadline idea. |
| Daily featured mystery | Pre-generate one case per day via a cron; everyone plays the same one |
| Sound/ambience toggle | Off by default |
| Admin stats page | Count of cases by difficulty, avg score, AI attempts/latency from `ai` meta |

## Deliberately out of scope
Payments, social login, real-time multiplayer, image generation (quota + latency), PWA/offline, i18n. Each is a large risk for a 3-day build.

## Where your available services fit
| Service you have | Best use here | Keep in mind |
|---|---|---|
| **Claude Code Pro** | Hardest-correctness work: AI pipeline, security, integration, polish, review of other tools' PRs | Use plan mode; one task at a time |
| **Codex (free)** | Well-specified backend tasks + tests (models, scoring, routes, auth) | Give it SPEC + task section only |
| **Antigravity (free)** | Frontend pages from `04-frontend.md`, browser checks | Keep it inside `client/` |
| **21st.dev MCP** | Hero, cards, dialogs, buttons → restyle to tokens | Copy in, don't add heavy deps |
| **GSAP / frontend skills** | Flip, stamp, count-up, overlay | Respect reduced motion |
| **Zoho Catalyst** | Alternative backend host (AppSail); LLM endpoint as a fallback provider if available | Pick one backend host |
| **Cloudflare** | Turnstile, Workers AI fallback, keep-alive cron | Frontend stays on Vercel per the brief |
| **Grok / Groq** | Fallback LLM via the OpenAI-compatible adapter | Groq has a free tier; xAI Grok usually needs credits |
| **MongoDB Atlas M0** | The database (required) | 512 MB is plenty |

**One account per service.** Opening several accounts on the same provider to multiply free limits breaks most providers' terms (Google, Cloudflare, Render, Vercel), and a suspension during grading would sink the demo. The plan stays within one free account each by using the mock provider for all dev/tests and a fallback chain for resilience.
