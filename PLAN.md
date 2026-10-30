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

**T-07 done (30 Oct).** 130 server tests green. Deviations from the spec's reference code (all tested, SPEC contract unchanged):
- Name checks (explanation / hints / story give-away) use **whole-word, Unicode-aware** matching instead of substring, so a culprit "Ann" doesn't reject a hint saying "annual"; short first names (≤2 chars) fall back to the full name.
- `sanitizePremise` collapses **any run of 3+ quotes** (spec's `"""`→`"` lets `"""""` re-form a delimiter and break out of the prompt block).
- Added a per-attempt **timeout race** (spec only passes an AbortSignal, so a provider that ignores it would hang the request).
- Removed the spec's redundant `if (attempts >= maxAttempts) break;` (the `while` guard already covers it).
- Zod mirror also enforces the Mongoose max lengths (over-long AI text is retried instead of failing on save); strings are re-validated after HTML stripping; empty-after-strip is an error.
- `ProviderError(message, status, retryable)` lives in `src/utils/provider-error.js`; mock exposes `calls` and `name` for tests.
- 9 mutation checks (script kept outside the repo) prove the tests catch each break. Next: T-08 real providers (needs Praful's Gemini key for the live run).

**T-08 code done, live check pending (30 Oct).** 167 server tests green, 8 mutation checks all caught. Findings:
- `responseJsonSchema` is the right Gemini key (gap G6 resolved from installed SDK typings + docs); `abortSignal` goes inside `config`; `ApiError.status` carries the HTTP code.
- Gemini's documented JSON-schema subset has **no `maxLength`** → the Gemini provider strips it before sending (validator still enforces lengths). Untested live: if Gemini rejects another keyword, a 400 becomes a non-retryable provider error.
- Provider errors keep only the HTTP status (never provider text, URLs or keys); 429/5xx are marked retryable, abort/timeout → 504.
- `buildProvidersFromEnv` skips providers with missing settings (warning names the variables, never values) and **refuses `mock` in production**.
- `scripts/try-ai.mjs` prints counts/meta, hides the solution unless `--show-solution`.
- Not wired into `src/index.js` yet — T-09 passes `createAiService(buildProvidersFromEnv(env))` into `createApp`.
- **Blocked on Praful:** `server/.env` with `GEMINI_API_KEY`, and confirming the current Flash model name (G4).

**T-09 done (30 Oct).** 215 server tests green (45 in `cases.test.js`), 12 mutation checks all caught, plus a live curl run of the real entry point (`dev-memory.mjs` → `index.js`, mock AI): create → get → list → 403 stranger → 400/404 cases all behave per SPEC §5. Notes:
- Routes: `POST /api/cases`, `GET /api/cases` (real history list, filter `userId` if `req.user` else `playerId`; T-12 only has to set `req.user`), `GET /api/cases/:id`.
- `validate({params, body})` replaces `req.body` with the parsed body; a bad `:id` → `INVALID_ID`, other failures → `VALIDATION_ERROR`; body uses `z.strictObject` (zod 4) so extra fields like `score`/`playerId` are rejected.
- Premise uses the existing `sanitizePremise` (control chars, whitespace, and 3+ quote runs collapse) — reused instead of a second regex.
- `createCase` generates first, saves second: an AI failure leaves no document. `loadOwned(id, {playerId, user}, {withSolution})` is ready for T-10.
- Outside T-09's file list, on purpose: `src/index.js` now builds the AI service from env and **refuses to boot with no usable provider** (and refuses `mock` in production) — `tests/unit/boot.test.js`; `scripts/dev-memory.mjs` (T-19 will reuse it for Playwright). `tests/helpers/app.js` now builds the app with a mock AI (`mode`, `provider`).
- Rate limits, helmet, CORS, 415 guard and Turnstile are still T-11; `create` is unprotected until then.

**T-10 done (30 Oct) — Phase 3 core finished.** 270 server tests green (100 in `cases.test.js`); 15 mutation checks all caught (the one survivor, `$push` vs `$addToSet`, is an equivalent mutant while the "not found yet" filter is in place — removing both together is caught); live curl of a full game on the real entry point: discover (+idempotent repeat), hints until `NO_HINTS_LEFT`, early result 409, stranger 403, accuse → result, second accuse 409, post-close hint/discover 409, and 6 truly simultaneous hint requests → exactly 2×200 + 4×409. Notes:
- Discover filters on `progress.discoveredClueIds: {$ne: clueId}` (spec used a bare `$addToSet`, which can't say who discovered it) so `alreadyDiscovered` is exact under concurrency.
- Accuse scores from the loaded progress and guards the update on `status:'active'` + exact `hintsUsed` + `$size` of discovered clues; a miss re-reads and rescores (bounded loop, 15 > 9 clues + 3 hints + 1). Three deterministic race tests force a hint / clue / rival accusation to land between load and save (`interleaveOnce` in `cases.test.js`); a randomized mixed-race test checks "no lost updates, score matches final state" over 12 rounds.
- All six SPEC §8 score cases (A–F) are asserted end-to-end through the HTTP API.
- Error precedence: ownership (403/404) → unknown clue/suspect (404) → closed (409). Status errors win over `NO_HINTS_LEFT`.
- `toResult`/`toProgress`/`toPublicClue` only; hint response is `{index, text}` built from the post-update document, never client-chosen.
- Still open before the backend is "done": T-11 (helmet, CORS, 415 guard, rate limits, Turnstile, leak/injection/403 suite, secret grep) — until then create/gameplay are unthrottled; T-08 live Gemini check (needs Praful's key).

**T-11 done (30 Oct) — backend Phase 3 complete.** 346 server tests green (62 in `security.test.js`, 14 in `rate-limit.test.js`); 26 mutation checks all caught (one initially survived — see below); spec §5 greps clean (repo secrets, client bundle, raw HTML) and the secret grep was proven to fire on a planted key; live run on the real entry point with default limits confirmed helmet headers, 415, CORS preflight, the real create limiter (6th create → 429 + `Retry-After: 600`) and clean log lines. SPEC.md got its own commit first (v1.0.1: the `415 UNSUPPORTED_MEDIA_TYPE` row, gap G2). Notes:
- `createApp({ ai, limits, turnstile, clientUrl, logger })`: everything tests vary is a parameter; `logger:null` is the test default. Limiters are built per app, so counters never leak between tests. `tests/helpers/app.js` turns limits effectively off unless a test sets them.
- Middleware order: logger → helmet → CORS → **global limiter (before body parsing)** → 415 guard → JSON (10 kb) → cookies → player → routes. The limiter runs before the parser so floods and junk bodies are refused cheaply.
- Deviation from the spec's route order: **validation runs before Turnstile**. A Turnstile token is single-use (Cloudflare docs), so verifying it for a request that is then rejected would burn the visitor's token. The limiters still run first, so invalid requests count toward the limits.
- Turnstile fails closed (only an explicit `success === true` on an HTTP-OK reply passes; 5 s timeout) and is off unless `TURNSTILE_SECRET` is set; `tests/helpers/setup.js` blanks it so a developer's `.env` can't switch it on in tests.
- Log line: `METHOD /path STATUS NNms ip=…` — query string, body, cookies, headers are never logged; the ip is there because 06-deploy says to check `req.ip` after deploy (TRUST_PROXY). 500s go to `logger.error` as error name + ≤300-char message + stack frames; Mongoose ValidationErrors log only the field names (their messages quote short values in full, e.g. invalid enums — Mongoose truncates only long ones).
- `express-rate-limit` v8: the per-IP limiters use the library's IPv6-safe default key; the per-player key has no IP in it, so no `ipKeyGenerator` wrapper is needed. Auth limiter (10/15 min/IP) is deliberately **not** built yet — T-12 adds it with the routes it protects (untested code is worse than missing code).
- The one surviving mutation (removing the ValidationError special case) exposed a weak test: Mongoose 8 truncates long values itself, so the 101-char title proved nothing. The test now uses a short secret enum value, and the mutation is caught.
- Still open: T-08 live Gemini check (needs Praful's `server/.env` key + current model name), T-12 auth/history (and its limiter), then the whole frontend (T-13…T-18) and integration (T-19).

**T-13 done (30 Oct) — Phase 4 complete (frontend foundation).** 208 client tests (11 files) green; 34 mutation checks all caught; lint clean (oxlint, 0 warnings); build 86.6 kB gzip initial JS (budget 300); checked in a real browser at 1440 and 360 px (no horizontal overflow, 44 px targets, fonts load, dialog focus trap / Esc / focus-return, toasts, skeleton). Notes:
- **Design record:** `design-system/ai-mystery-room/MASTER.md`. The ui-ux-pro-max `--design-system` run recommended pastel *Claymorphism* (wrong product, rejected, not persisted); verified matches were *Vintage Analog / Retro Film* (grain + warm light, our surface treatment) and *Playfair + Inter* (same as the spec). No palette match, so the spec's noir tokens stand (contrast table in MASTER.md).
- **Mock backend** (`client/src/api/mock/`): same function names, shapes, error codes and latency (800 ms / 2.5 s create) as the server; state kept in sessionStorage. Three hand-written fair-play cases (Easy "The Silent Sitar" = SPEC §5.3 example, Medium "The Poisoned Chai", Hard "The Last Scene"). **Drift protection:** tests import the REAL server serializers, scoring, validator and difficulty table and require the mock to match field-for-field (the fixtures even pass the server's fair-play validator).
- **API layer:** `api/cases.js` picks mock via `VITE_USE_MOCK=true` or `vite --mode mock` (`npm run dev:mock`); the mock is a lazy chunk and is dead-code-eliminated from production builds. `toApiError` also maps proxy HTML errors (no envelope) to a generic server error, 429 to `RATE_LIMITED`, and cancellations to `CANCELED`.
- **Shell:** lazy routes under one `Layout` (Suspense inside it, so the nav stays while a chunk loads), skip link, focus moves to `<main>` after navigation (not on first load; StrictMode-safe), per-page titles, 404. NavBar shows only the logo mark below 420 px (brand name stays as aria-label).
- **Bug found by looking:** `body` had an opaque background that painted over the fixed lamp/vignette layers; the page colour now lives on `<html>` only.
- **Dev gallery** at `/__kit` (dev server only; verified absent from `dist/`) for inspecting every token/component/state.
- Dependency added: `lucide-react` (one tree-shaken SVG icon set; spec requires icons from one set, no emoji).
- Placeholders for pages come next: T-14 Home + Create (scroll-driven GSAP storytelling on Home, per the brief), T-15 Investigation, T-16 Accusation + Results; Firebase auth UI in T-17 after SPEC §5.1/§9 are updated.

**T-14 done (30 Oct) — Home + Create.** 303 client tests (16 files) green; 50 mutation checks run (44 + 6 re-runs after fixing gaps), all caught except one environment-limited case (below); lint clean; build: initial JS 86.7 kB gzip, GSAP lives in a shared chunk (~70 kB gzip) only the Home/Create routes download (Home total ≈ 163 kB, budget 300). Checked in a real browser at 1440 and 360 px (scrolled through every state of the pinned story, ran a full generate → case flow in mock mode, console: 0 errors / 0 warnings).
- **Home:** hero (SplitText letter-by-letter headline in a line mask, evidence board with pins and a red string that draws itself, pointer + scroll parallax, "Waking up the detective…" pill after 3 s), a **pinned scroll-driven story** on desktop (premise types itself → clue card flips → suspect stamped ACCUSED → SOLVED; the active step follows the scroll), difficulty cards revealed on scroll, closing CTA, thin amber page-progress bar. Phones and `prefers-reduced-motion` get plain steps and plain content; every section has its own reduced-motion guard.
- **Create:** premise (10–300, counter, error only after blur), 5 sample chips, native-radio difficulty cards, generating overlay (focus-taking modal, rotating lines every 2.5 s, mm:ss, "Hard cases take a bit longer…" after 25 s), inline error banner with Try again, 60 s cooldown with countdown after a 429, optional Cloudflare Turnstile (only when `VITE_TURNSTILE_SITE_KEY`; token cleared and widget reset after every failed attempt; Generate waits for the token).
- **Deviations from the spec text:** the h1 is the tagline ("Every case is new. Every culprit is hiding.") with "AI Mystery Room" as the eyebrow (SPEC lists title + tagline; one headline reads stronger); the footer GitHub link is **not** added yet (no URL until the final push, and no dead links is a rule).
- **Three bugs found only by looking at it in a browser, each now guarded by a test (`styles.test.js` + Home tests):** (1) the page-enter animation kept `transform` on the page wrapper, which makes it the containing block for `position:fixed`, so ScrollTrigger's pinned section scrolled away invisibly → fill-mode is now `backwards`; (2) an opaque `body` background painted over the fixed lamp/vignette layers; (3) SplitText's line mask clipped descenders (g, y, p) → `.hero-line-mask` extends the clip box. Also: a CSS opacity transition fought GSAP on phones (now desktop-only), and the string now runs behind the cards instead of across their text.
- **Rules kept for GSAP:** no Tailwind transform/scale/rotate classes on elements GSAP animates (Tailwind v4 uses the separate CSS `scale`/`rotate` properties, which stack with GSAP's); every animation is created inside `useGSAP` with a scope; `gsap.matchMedia()` for the desktop-only pin; no `markers`.
- **Lint caught real issues:** `useSample` (looked like a hook), and two set-state-in-effect patterns (now reset in the cleanup).

**T-15 done (30 Oct) — Investigation room.** 392 client tests (20 files) green (3 consecutive full runs, plus a final one); 29 mutation checks, 4 initially missed (open-on-mount, unknown clue reply, preview uses case difficulty, no toast for an already-open clue) -> tests added, all caught on re-run; lint clean; build: initial JS 84 kB gzip, Investigation chunk 6.8 kB gzip, no secrets/solution fields in dist. Checked in a real browser at 1440 and 360 px (flip, +5 toast, hint confirm modal, hint reveal, sticky accuse bar on phones only, case-not-found page, console 0 errors, no horizontal scroll).
- **Built:** `useCase` (state keyed by id, merges clue/hint replies without refetching, ignores unknown clues, stale answers never overwrite), `ClueCard` (GSAP 3D flip; the description is not in the DOM until the server reveals it), `HintsPanel` (confirm dialog, aria-live, sealed placeholders), `StoryPanel` (first-visit reveal + Skip), `SuspectCard` (slot-banded avatar hue so suspects always look different), `CaseHeader` (score is a labelled preview), `AccuseBar`, skeleton and error states; closed case redirects to the result.
- **Test timeouts:** lazy pages import GSAP, so on this slow machine the default 1 s `findBy` wait failed intermittently. Set `asyncUtilTimeout` 5 s and `testTimeout` 15 s. One further one-off failure (header test, ~1.1 s) happened once in four full runs and did not reproduce in 3 more; it was not diagnosed.

**T-16 done (30 Oct) — Accusation + Results.** 460 client tests (24 files) green; 30 mutation checks, 4 missed and 2 skipped first time (double-confirm test was too fast to catch a second click, cancelled-share test checked the wrong wording, stale-answer test was masked by a refetch, two multi-line patterns did not match) -> tests fixed, all caught on re-run; one mutant (`onComplete` in the count-up) was equivalent, so the redundant code was deleted. Lint clean; build: initial JS 84 kB gzip, Accusation 2.7 kB, Results 3.3 kB gzip; no secrets in dist. Real browser at 1440 and 360 px: correct and wrong accusations, confirm dialog + Escape, arrow keys, reload of the result, closed case redirects from both the room and the accuse page.
- **Built:** Accusation (native radio group styled as suspect cards, optional reasoning kept in sessionStorage only and never sent, confirm dialog "Accuse {name}?", one request only, "closed elsewhere" goes to the result, other errors toast and allow a retry), Results (SOLVED/UNSOLVED stamp, accused vs culprit, explanation, key clues Found/Missed in words, score table with count-up and the server total, reasoning, New mystery, Share via share sheet or clipboard), `useResult` (carried result used only for its own case, stale-safe), shared `CaseError`.
- **Bug found only in the browser:** opening a closed case's room or accuse page threw `Cannot read properties of null (reading 'querySelectorAll')`: the entrance animation ran while the page was redirecting and had no element yet. It had been in Investigation since T-15; jsdom never saw it because tests run with reduced motion. Guarded in all three pages and covered by motion-on tests. Lesson: redirect and error branches need a motion-on test.
- **Deviations:** "My cases" button is left for T-17 (needs auth). In this software-rendered browser the entrance animation crawled for several seconds (GSAP smooths very slow frames); it completed correctly, but check real-device smoothness in T-18 (Lighthouse).

**T-12 + T-17 done (30 Oct) — Firebase Authentication (SPEC v1.1.0), server then client.** The owner chose Firebase (email + password and Google), so SPEC §4.6/§5.1/§5.2/§5.4/§6.1/§6.2/§9/§11 and the part specs were rewritten first (own commit). Server: 433 tests; client: 729 tests (37 files); lint clean.
- **Server (T-12):** `jose` verifies Firebase ID tokens (RS256 pinned, issuer, audience, expiry, `sub`, `iat`/`auth_time` not in the future; Google's keys cached; Google unreachable = 503 not 401). No `User` collection, no passwords, `Case.userId` is the Firebase uid. A bad or expired token is a 401, never a quiet guest. `POST /api/auth/session` (60 / 15 min / IP) claims this browser's unowned guest cases. `bcryptjs` and `jsonwebtoken` removed. 28 server mutations, all caught (4 missed first time: algorithm pin, name cap, size limit, empty header).
- **Client (T-17):** `auth/` has a Firebase backend and a mock backend with the same interface (`npm run dev:mock` runs the whole sign-in flow with no Firebase project); Firebase and the mock are lazy chunks, the mock is absent from production builds, and the SDK is not in the entry chunk. `AuthProvider` claims guest cases once per person per visit (toast: "Saved to your account"), registers the token provider before the first claim, and requests carry `Authorization: Bearer`. Pages: Sign in, Create account (strength meter, Google, forgot-password dialog that never reveals which emails exist), My cases (works for guests too, with a banner), NavBar account menu, Results "My cases" for signed-in players. `?next=` goes through `safeNext` (same-site paths only, never the sign-in pages). Firebase error codes become plain sentences; the SDK's own message is never shown.
- **Client mutation checks:** 41 run, 5 missed first time. Fixed with tests: double-submit guards on Login and Register (the button disables itself, so only a direct form submit shows the guard). Left as equivalent: Login's `silent` branch (an empty message renders nothing), email trim (`type=email` trims by itself) and the over-30 name check (`maxLength` makes it unreachable).
- **Real browser, mock mode, 1440 and 360 px:** register, weak and strong password meter, history lists the case, account menu, sign out, wrong password, forgot password, sign in again, Google, no console errors, no horizontal scroll.
- **NOT verified live:** real Firebase sign-in and real Google. It needs a Firebase project: set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (client) and `FIREBASE_PROJECT_ID` (server), enable Email/Password and Google in Firebase Auth, and add the deploy domain to Authorized domains. The server's token check was tested against a local key pair standing in for Google's keys, and Google's real key endpoint was confirmed reachable.
- **Test timeouts:** async waits 10 s and test timeout 20 s (pages import GSAP; the full suite loads this machine).

**T-18 done (30 Oct) — motion and polish.** Most of the spec's animation list already shipped with the pages (clue flip, hint fade-in, verdict stamp, score count-up, page enter, generating overlay, hero parallax, scroll story, all behind `useReducedMotion`). This task was the measured pass. Client: 737 tests (38 files), lint clean.
- **Lighthouse (mobile, production build served locally, simulated slow 4G + 4x CPU), before -> after:** Home Performance 84 -> 88, Sign in 87 -> 91, Create 87; Accessibility 100 everywhere; Best Practices 96-100; SEO 91 -> 100; CLS 0 to 0.01; TBT 20-150 ms. T-18's targets (Performance >= 70, Accessibility >= 90) were already met; the house targets (Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 95) are met except Home Performance (88).
- **What changed:** `public/robots.txt` (the SPA fallback was serving HTML for it, which cost the SEO score); fonts are now self-hosted with `@fontsource` (Latin only, 9 files, 21-24 kB each) instead of the render-blocking Google Fonts stylesheet (about 940 ms of blocking on the test profile); the hero text starts after 0.15 s instead of 0.55 s, so the LCP element's render delay fell from 2.7 s to 0.6 s. `seo.test.js` guards all three (no third-party font request, robots.txt rules, head tags, zoom allowed).
- **Reduced motion, checked in a real browser:** with the OS setting on the hero is fully visible at once and no scroll pin exists; with it off the entrance animation and the pinned story run. The CSS-level switch-off is covered by `styles.test.js`.
- **Left as is, on purpose:** (1) Home Performance stays at 88 because its simulated LCP is dominated by downloading and running the app's JavaScript on a throttled CPU (main thread about 2.8 s; GSAP is the largest piece). Removing that means shipping less animation on the first screen or server-rendering the hero, which is not worth the risk now. (2) The optional lazy 3D hero and restyling 21st.dev components were skipped: both are optional in the task and would add weight for no required gain. (3) The only console error in the Lighthouse runs is the `/api/health` ping failing because no backend was running; it does not occur with the backend up.
- **Lighthouse is not a project dependency.** It was run through `npx` against `vite preview` (steps: `npm run build`, `npx vite preview --port 4173`, then `npx lighthouse@13.6.0 http://localhost:4173/ --form-factor=mobile`). Scores from the real Vercel deployment should be re-checked in T-22.

**T-19 done (30 Oct) — integration and end-to-end.** `cd server && npm test` 433 green; `cd client && npm test` 737 green; `npx playwright test` 6 green in about 1.1 minutes; lint and build clean.
- **How it runs:** `client/playwright.config.js` starts the REAL server (`server/scripts/dev-memory.mjs`: mock AI on an in-memory MongoDB, port 5000) and the REAL client dev server (port 5173, `VITE_USE_MOCK=false`, `/api` proxied), so the browser talks to the actual API with no mock in between. Locally running servers on those ports are reused; with `CI=true` fresh ones always start. `npm run e2e` is the shortcut. Needs `npx playwright install chromium` once.
- **Scenarios (`client/e2e/flow.spec.js`):** (1) easy full flow home -> create -> 2 clues -> 1 hint -> accuse the right suspect -> SOLVED, total 100 (100 + 2x5 - 10); (2) medium, wrong suspect -> UNSOLVED, base 0, clue points kept, total 5; (3) reloading a finished case, and opening its room or accuse page, lands on the result; (4) a finished case appears in My cases with "Solved" and "105 pts"; (5) a second browser is refused with "Not your case file"; (6) phone viewport 375 x 812: sticky Accuse bar, full flow, no horizontal scroll. Scenario 1 also records every `/api/` response before the accusation request and fails if any contains the solution marker, `culpritId`, `keyClueIds`, `"solution"` or `"explanation"` (and checks it saw more than 3 responses so it cannot pass by looking at nothing).
- **Contract mismatches found: none.** The client written against the mock API worked first time against the real server. (Two test expectations of mine were wrong and were fixed: the guest banner is correctly hidden when the site has no sign-in configured.)
- **The leak check was proven able to fail:** with `culpritId` deliberately added to the public case serializer, scenario 1 failed on exactly that field; the serializer was then restored (verified clean).
- **CI:** `.github/workflows/ci.yml` (Node 22): server (`check` + tests), client (lint, tests, build, bundle secret grep, no `dangerouslySetInnerHTML`), repo secret grep (SPEC `03-security.md` §5), then e2e with Chromium and trace upload on failure. No real keys anywhere. The workflow could not be run here (no GitHub Actions locally), so its first real run happens after the single final push; read its first result then.
- **Not covered by e2e, on purpose:** real Firebase and Google sign-in (no project yet; the sign-in flow is covered in mock mode by the unit tests and the browser pass in T-17), the real Gemini output (T-08), Turnstile.
- **Spec change:** `specs/03-security.md` §4 now lists the four public `VITE_FIREBASE_*` values, says our own code stores no tokens (Firebase keeps its own session in IndexedDB), and gives the CSP the app needs now (fonts self-hosted, Firebase and Google sign-in origins). Test sign-in with the CSP on before shipping it in T-21.
- **Test-suite lessons:** a function returned from `beforeEach` is run as cleanup (`mockReset()` returns the mock!); GSAP registers ScrollTrigger at import time, so the matchMedia fake is installed when the setup file loads; the matchMedia fake now understands min/max-width.
- **Known limit (honest):** "step 1 starts highlighted" is set by an explicit initial `data-active` write *and* by ScrollTrigger's first `onUpdate`; jsdom fires that update immediately, so a test cannot tell the two apart (the mutation removing the explicit write survives). In a real browser the explicit write is what shows step 1 before any scroll. Verified by eye, not by test.
- Not used: 21st.dev (the hero is hand-built to the noir system, saving the free copy quota); Motion library (GSAP only, to keep one animation engine).
