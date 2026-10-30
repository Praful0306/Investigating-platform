# PLAN.md — AI Mystery Room build plan

> Combines `SPEC.md`, `AGENTS.md`, `TASKS.md`, `SCHEDULE.md`, `FEATURES.md` and every part spec in
> `ai-mystery-room-specs.zip` (`specs/00`–`06`, `prompts/`, `.env.example`s) into one ordered build.
> SPEC.md stays the source of truth — this file only says **in what order, with which tools, to what bar**.
> Written 30 Oct 2026 (Day 0). Deadline 2 Nov 11:59 PM IST, internal submit 2 Nov 8 PM, freeze 2 Nov 2 PM.

---

## 0. Where we are

| Item | State |
|---|---|
| Repo | `D:\investicating platform` — **not a git repo yet**, no code |
| Files | `spec.md` (identical to zip `SPEC.md`, needs rename), `AGENTS.md`, `TASKS.md`, `FEATURES.md`, `SCHEDULE.md`, zip with `specs/`, `prompts/`, `CLAUDE.md`, `README.md`, `.env.example`s |
| Toolchain | Node 24.11, npm 11.19, git 2.53. **Missing:** `gh`, `vercel`, `render` CLIs |
| Accounts (T-02, human) | Gemini key, Atlas M0, Vercel, Render — **Praful must do these**; I never type keys |

## 1. Spec gaps found while reading (fix in SPEC first, per AGENTS §2)

| # | Gap | Resolution |
|---|---|---|
| G1 | `CROSS_SITE_COOKIES` is in SPEC §11 + `.env.example` but missing from `env.js` zod schema (02-backend §1) | Add `CROSS_SITE_COOKIES: z.enum(['true','false']).default('false')`; cookie helper uses `sameSite:'none', secure:true` when true |
| G2 | 415 `UNSUPPORTED_MEDIA_TYPE` used in 03-security but absent from SPEC §5.2 error table | Add row to SPEC §5.2 in T-11 commit, log in change log |
| G3 | `tests/unit/model.test.js` and `tests/unit/ai-service.test.js`, `api/rate-limit.test.js`, `api/health.test.js` missing from the 00-conventions tree | Tree is illustrative; follow TASKS.md file lists |
| G4 | `gemini-2.5-flash` may not be the current Flash model by Oct 2026 | Env-driven already; check AI Studio at T-08, set `GEMINI_MODEL` |
| G5 | `express-rate-limit` v7+ needs `ipKeyGenerator()` for IP-keyed limits (IPv6) | Use it in the daily IP limiter; verify with context7 |
| G6 | `@google/genai` key `responseJsonSchema` vs `responseSchema` | Verify current SDK with context7 before T-08 |
| G7 | Root file is `spec.md`; contract says `SPEC.md` | `git mv` in T-01 |

## 2. Tool map — what I use, where

| Tool / skill / connector | Used for | Phase |
|---|---|---|
| **context7 MCP** | Current docs before writing: Express 5, Mongoose 8, `@google/genai`, express-rate-limit, Tailwind v4, GSAP `@gsap/react`, Vitest, Playwright | every phase, before code |
| **ui-ux-pro-max + frontend-design + premium-frontend** | Design system pass (palette check, type scale, layout rhythm, UX rules) → recorded in `specs/04-frontend.md` §1 addendum, not a new file | 4 |
| **21st.dev MCP** (connected, free tier = ~2 copies/day) | Copy + restyle: Aceternity **Spotlight** (#989, pure Tailwind) for hero lamp, **Tilt Flip Card** (#12635) as clue-card reference; dialog if needed. Source noted at top of each file | 4, 7 |
| **gsap-skills** (`gsap-react`, `gsap-timeline`, `gsap-performance`) | Flip, stamp, count-up, overlay loop, typewriter, page enter | 5, 7 |
| **Playwright MCP + built-in browser** | Visual checks at 360/768/1440, keyboard pass, e2e authoring | 5–9 |
| **web-design-guidelines + react-best-practices** (Vercel skills) | Review pass over client code | 7 |
| **security-review / code-review** | Review backend security boundary + diff before deploy | 3, 9 |
| **Vercel MCP** (connected) | Create project, env vars, deployment logs, runtime errors | 9 |
| **Render skills** (`render-deploy`, `render-web-services`, `render-blueprints`) | `render.yaml` blueprint for the API (Render CLI not installed → Praful clicks "Apply blueprint") | 6, 9 |
| **Cloudflare plugin** (optional) | Turnstile keys; Worker cron keep-alive ping during grading | 9 (optional) |
| **prelaunch-verification** | Final gated checklist → `VERIFICATION-REPORT.md` | 9 |
| Not used | shadcn MCP (not a shadcn project), Motion lib (GSAP already chosen — two animation libs blows the 300 kB budget), Catalyst (needs auth; Render chosen), TRELLIS 3D asset (spec makes 3D optional/cut #1) | — |

Blockers needing Praful: GitHub push (GitHub MCP unauthenticated + no `gh` → authorize via `/mcp` or push manually), T-02 keys into `server/.env`, Render/Vercel dashboard clicks that need login.

## 3. The premium bar — "Noir Case File"

Spec tokens (04-frontend §1) are kept exactly; premium comes from craft, not new colors.

**Atmosphere (global, CSS only, ~0 kB JS)**
- Film grain: fixed SVG `feTurbulence` noise overlay, 4–6% opacity, `pointer-events:none`.
- Desk-lamp light: radial amber gradient pinned top-left + vignette; on desktop a soft cursor-follow spotlight (CSS vars updated on `pointermove`, rAF-throttled, off under reduced motion).
- Depth: panels are `felt` with 1px inner highlight + layered shadows; paper cards get a subtle fiber texture, torn/deckled edge mask, a strip of "evidence tape" or brass pin, and ±1.5° rotation.

**Signature moments (GSAP via `useGSAP`, all ≤ 600 ms except overlay)**
1. **Home hero** — title letters fade-rise in stagger, Spotlight sweeps once, CTA glows amber on hover. Floating case-file cards drift on parallax (desktop).
2. **Generating overlay** — magnifier sweeping over a blurred case file, rotating lines every 2.5 s, elapsed counter, typewriter caret.
3. **Story** — typewriter/stagger reveal with **Skip**, seen-flag in `sessionStorage`.
4. **Clue board** — cards laid on felt like an evidence board; Examine = 3D flip (rotateY 180°, preserve-3d) + "+5" chip floating up; **red-string SVG** connecting discovered clues (pure SVG path, redraws on discover — the "wow" touch, cheap).
5. **Hints** — envelope slides out, text fades in; confirm modal shows "−10".
6. **Accusation** — selected suspect gets amber ring + rubber "ACCUSED" stamp drop.
7. **Results** — SOLVED (moss) / UNSOLVED (blood) stamp: scale 1.4→1 + rotate + ink-bleed shadow; score count-up; key clues tick in sequence.
8. Page transitions: 200 ms fade/slide.

**Rules that keep it premium, not noisy:** one style (noir paper-on-felt), no glass/neon mixing; Playfair for display only; mono for case numbers (`CASE #A1F3`); 8-pt spacing; every state (skeleton, empty, error) designed; reduced-motion renders final states; 44 px tap targets; focus rings amber; initial JS < 300 kB gzip; Lighthouse mobile Perf ≥ 70, A11y ≥ 90.

**Deps:** only spec'd ones. Possible single addition: `lucide-react` (tree-shaken icons, ~2–4 kB used) — added with reason in commit. Fonts via Google Fonts (`display=swap`, preconnect) as the CSP in 03-security expects.

## 4. Phases

Each phase = the TASKS.md tasks listed, run through the AGENTS.md loop (plan → build → **run Verify, paste real output** → self-check → commit `T-XX: …` → tick box). Backend and frontend lanes are independent until Phase 6.

### Phase 0 — Foundation · Day 0 (today)
**T-01** scaffold · **T-02** accounts (Praful, in parallel)
- `git init`, extract zip into root (`specs/`, `prompts/`, `CLAUDE.md`, `README.md`, `.env.example`s), `git mv spec.md SPEC.md`, add `PLAN.md`, root `.gitignore`.
- `client/`: Vite React + react-router-dom, axios, gsap, @gsap/react, tailwindcss v4 + @tailwindcss/vite, vitest, testing-library, jsdom, @playwright/test.
- `server/`: express 5, cors, dotenv, mongoose 8, @google/genai, zod, helmet, cookie-parser, express-rate-limit, bcryptjs, jsonwebtoken; dev nodemon, vitest, supertest, mongodb-memory-server (pre-download binary now).
- **Exit:** client builds with a `bg-amber-500` test div; `import('express')` ok; no `.env` in `git status`. **No push** — local commits only until Phase 9.

### Phase 1 — Backend core · Day 0 evening
**T-03** skeleton (env, app, health, error envelope, `mr_pid` cookie) → **T-04** models (`select:false` solution, toJSON strip) → **T-05** difficulty + scoring (cases A–F) → **T-06** serializers (the security boundary, leak assertions).
- **Exit:** `npm test` green for health, model, scoring, serializer.

### Phase 2 — AI engine · Day 1 morning
**T-07** prompt, JSON schema, zod mirror, semantic validator, retry-with-feedback loop, deterministic mock provider (`MOCK_SECRET_EXPLANATION`, culprit `s2`, modes valid / invalid-once / invalid-always / unavailable).
**T-08** Gemini + OpenAI-compatible providers, `buildProvidersFromEnv`, `scripts/try-ai.mjs` → one live run per difficulty (≈3–6 Gemini calls total).
- **Exit:** all validator/ai-service/prompt tests green; real Gemini returns valid easy/medium/hard (attempts ≤ 2).

### Phase 3 — Game API + hardening · Day 1 afternoon
**T-09** create/get (+list stub) → **T-10** discover/hint/accuse/result with guarded `findOneAndUpdate` (parallel-hint test: exactly N succeed) → **T-11** helmet, CORS allow-list, 415 guard, limiters, Turnstile middleware (off when no secret), log hygiene, leak + injection + 403 + no-stack tests, secret grep. SPEC §5.2 gets the 415 row (G2).
- Run `security-review` over `server/` after T-11.
- **Exit:** full `npm test` green; curl through full flow with `AI_PROVIDERS=mock`.

### Phase 4 — Frontend foundation + design system · Day 0 night / Day 1 (parallel to 1–3)
**T-13** — design pass first (ui-ux-pro-max/frontend-design), then tokens in `index.css`, grain/lamp atmosphere, fonts, lazy routes, Layout/NavBar/Footer, UI kit (Button, Card, Badge, Modal w/ focus trap, Toast, ProgressBar, Skeleton, ErrorState, Spinner), `api/http.js`, `api/cases.js`, mock adapter + fixtures matching SPEC §5.3 literally, `lib/errors.js`, `config/difficulty.js`, `useReducedMotion`, test setup. Pull Spotlight from 21st.dev.
- **Exit:** `VITE_USE_MOCK=true` every route renders; lint + build pass.

### Phase 5 — Pages · Day 1
**T-14** Home + Create (+ GeneratingOverlay, useHealthWake) → **T-15** Investigation (useCase, CaseHeader w/ labelled score *preview*, StoryPanel, SuspectCard, ClueCard flip, HintsPanel, sticky mobile bar) → **T-16** Accusation + Results.
Motion is wired at a basic level here (flip, stamp) so the game feels right from the first playable build.
- Browser check each page at 360 / 1440 + keyboard-only.
- **Exit:** whole flow plays in mock mode, correct and incorrect; page tests green.

### Phase 6 — Integration + skeleton deploy · Day 1 evening → Day 2 morning
**T-19** client ↔ real server (`AI_PROVIDERS=mock`, `VITE_USE_MOCK=false`), fix contract drift, `server/scripts/dev-memory.mjs`, client component tests, Playwright e2e (5 scenarios incl. network leak scan + 375×812), GitHub Actions CI.
**T-20 (skeleton)** `render.yaml` + Render service + Atlas; `/api/health` → `db:"up"`.
- **Exit:** server + client + e2e all green; backend reachable online.

### Phase 7 — Premium motion & polish · Day 2
**T-18** — everything in §3 "signature moments" at full quality: red-string evidence board, typewriter, envelope hints, count-up, hero parallax, cursor lamp; optional lazy R3F hero only if budget allows (desktop, `dpr [1,1.5]`, pauses when hidden). Then `web-design-guidelines` + `react-best-practices` review, Lighthouse, reduced-motion check.
- **Exit:** build sizes < 300 kB gzip initial; Lighthouse Perf ≥ 70 / A11y ≥ 90; no console warnings.

### Phase 8 — Tier 2: accounts + history · Day 2 afternoon
**T-12** auth service, `mr_token` JWT cookie, optionalAuth/requireAuth, claim guest cases, `GET /api/cases`, auth limiter, tests → **T-17** AuthContext, Login/Register/History, NavBar states.
- **Exit:** register → play → history lists it → logout → login → still there.

### Phase 9 — Ship · Day 2 evening → Day 3
**T-20 final** + **T-21** `client/vercel.json` (rewrite `/api/*` → Render, SPA fallback, security headers), Vercel project via MCP, `smoke.mjs` × easy/medium/hard, check `req.ip` / `TRUST_PROXY=2`.
**T-22** manual QA script (05-tests §7), `prelaunch-verification` → `VERIFICATION-REPORT.md`, README (live URL, screenshots, architecture diagram, security notes, tests, AI tools used), solve one live mystery, tag `v1.0-submission`, Praful submits form.
**Git policy:** first and only push to GitHub happens here, after everything is verified working. Commit messages are plain `T-XX: summary` under the owner's identity (`praful`) — no Claude attribution lines. (Render/Vercel deploy from GitHub, so the deploy steps in P6/P9 run right after this push, or via Vercel MCP file upload if an earlier preview is needed.) Optional: Cloudflare Worker keep-alive cron during grading.

## 5. Order of work for me (single builder, lanes interleaved)

```
P0 T-01 ─┬─ P1 T-03→T-04→T-05→T-06 ── P2 T-07→T-08* ── P3 T-09→T-10→T-11 ─┐
         └─ P4 T-13 ── P5 T-14→T-15→T-16 ─────────────────────────────────┴─ P6 T-19, T-20 ── P7 T-18 ── P8 T-12→T-17 ── P9 T-21→T-22
* T-08 waits on Praful's Gemini key (T-02); everything else runs on the mock provider.
```
Frontend lane (P4–P5) can run in a parallel session since it only touches `client/` and mock fixtures.

## 6. Cut list (unchanged from SCHEDULE.md) and never-cut
Cut in order: 3D hero → leaderboard/share → auth + history → Turnstile → fallback LLM.
**Never cut:** server-side solution secrecy, backend scoring, validation + retry, their tests, deployment.

## 7. Build log & findings

**T-01 done (30 Oct).** Installed versions differ from the spec's text — decisions:
- Mongoose pinned to **8.x** (spec says 8; npm default is 9).
- **zod 4** installed (spec snippets use zod 3 style): `.strict()` and `.regex()` still work; prefer `z.strictObject` if deprecation warnings appear; check `issues` shape in T-03 tests.
- **express-rate-limit 8**: use `ipKeyGenerator` for IP-keyed limits (gap G5).
- **vitest 5**, jsdom 29, React 19, Vite 8 (lint is `oxlint`, not eslint).
- `mongodb-memory-server` binary (mongod 8.2.6) downloaded and cached.

**Auth decision pending (Phase 8):** user asked for a very polished auth UI and allowed Firebase. SPEC §5.1/§9 specify email+password JWT. If Firebase is used: Firebase Auth on the client (email/password + Google), server verifies the Firebase ID token and maps `uid` → `userId`; SPEC §5.1, §5.4, §6.2, §9 and 03-security S12 must be updated **before** coding it. Guest play stays unchanged.

**T-03 done (30 Oct).** Notes: `tests/helpers/db.js` exports `useMemoryDb()` (called per test file) instead of a global setup that boots Mongo for every file — keeps unit tests fast. Added `tests/unit/error.test.js` (proves Express 5 forwards async throws, no stack/message leak). Body-parser errors (bad JSON / >10kb) map to 400 `VALIDATION_ERROR`. `CROSS_SITE_COOKIES` added to env (gap G1). Helmet, CORS, logger, limiters, 415 guard are deliberately left for T-11 (marked spot in `app.js`).

**Phase 1 done (T-03–T-06, 30 Oct).** 58 server tests green. Each secrecy guard was mutation-checked (removing `select:false` / `toJSON` strip / using a leaky serializer makes tests fail). Test fixtures live in `server/tests/helpers/fixtures.js` (reuse for API/security tests). `git log` has one commit per task, author `praful`, nothing pushed. Next: Phase 2 (T-07 AI service core with mock provider).
