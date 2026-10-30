# TASKS.md — build board

Rules: do tasks in dependency order, one task per branch/PR, run **Verify**, tick `[x]` only after it passes (see `AGENTS.md` §1).
Lanes run in parallel: **B** = backend (`server/`), **F** = frontend (`client/`), **I** = integration/deploy (both).
Suggested tool per task is a default — any tool can take any task if it reads the same files.

| ID | Lane | Task | Depends | Suggested tool | Target day |
|---|---|---|---|---|---|
| T-01 | I | Repo scaffold, folders, configs, docs committed | — | Claude Code | D0 |
| T-02 | I | Accounts + secrets (human) | — | Praful | D0 |
| T-03 | B | Server skeleton: env, app, health, errors, player cookie | T-01 | Codex | D0/D1 |
| T-04 | B | Mongoose models | T-03 | Codex | D1 |
| T-05 | B | Difficulty config + scoring | T-03 | Codex | D1 |
| T-06 | B | Serializers (security boundary) | T-04 | Claude Code | D1 |
| T-07 | B | AI service: prompt, schema, validate, retry, mock provider | T-05 | Claude Code | D1 |
| T-08 | B | Gemini + OpenAI-compatible providers, try-ai script | T-07, T-02 | Claude Code | D1 |
| T-09 | B | Routes: create + get (+ list stub) | T-06, T-07 | Codex | D1 |
| T-10 | B | Routes: discover, hints, accuse, result (atomic) | T-09 | Claude Code | D1 |
| T-11 | B | Security hardening + security tests | T-10 | Claude Code | D1/D2 |
| T-12 | B | Auth + history + claim (Tier 2) | T-11 | Codex | D2 |
| T-13 | F | Client scaffold: Tailwind theme, router, layout, UI kit, API layer + mock | T-01 | Antigravity | D0/D1 |
| T-14 | F | Home + Create Mystery pages | T-13 | Antigravity | D1 |
| T-15 | F | Investigation Room page | T-13 | Antigravity | D1 |
| T-16 | F | Accusation + Results pages | T-15 | Antigravity | D1/D2 |
| T-17 | F | Auth UI + History (Tier 2) | T-16, T-12 | Antigravity / Codex | D2 |
| T-18 | F | Motion & polish: GSAP, 21st.dev components, optional 3D hero | T-16 | Claude Code (21st.dev + GSAP skills) | D2 |
| T-19 | I | Integration on real server (mock AI) + client tests + Playwright e2e | T-11, T-16 | Claude Code | D2 |
| T-20 | I | Deploy backend + Atlas (skeleton early, final later) | T-03, T-02 | Claude Code + Praful | D1 (skeleton), D2 (final) |
| T-21 | I | Deploy frontend on Vercel + rewrite + prod smoke | T-20, T-14 | Claude Code + Praful | D2 |
| T-22 | I | Production QA, README, screenshots, tag, submit | T-21 | Praful + Claude Code | D3 |

---

## T-01 · Repo scaffold
- [x] **Steps:** follow `specs/00-conventions.md` §2. Commit `SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `TASKS.md`, `specs/`, `prompts/`, `.gitignore`, `server/.env.example`, `client/.env.example`. Create empty folders from §1 with `.gitkeep`.
- **Verify:** `cd client && npm run build` · `cd server && node -e "import('express').then(()=>console.log('ok'))"` · `git status` shows no `.env`.
- **Done when:** both apps install, client builds, Vite dev server shows the default page with Tailwind working (a `bg-amber-500` test div), repo pushed to GitHub.

## T-02 · Accounts + secrets (human)
- [ ] Gemini key from Google AI Studio; check the rate-limit page for the model you'll use.
- [ ] Atlas M0 cluster + user + `0.0.0.0/0` (`specs/01-database.md` §1).
- [ ] Vercel + Render (or Catalyst) linked to GitHub.
- [ ] Optional: Cloudflare Turnstile site key/secret; Groq (or other) fallback key.
- [ ] Fill local `server/.env` (never commit). Store secrets in a password manager.
- **Verify:** `cd server && node -e "require('dotenv').config(); console.log(!!process.env.GEMINI_API_KEY, !!process.env.MONGODB_URI)"` prints `true true` (run as CommonJS: `node --input-type=commonjs -e ...` if needed).

## T-03 · Server skeleton
- [x] Files: `src/index.js`, `src/app.js`, `src/config/env.js`, `src/db/connect.js`, `src/routes/health.js`, `src/middleware/{player,error}.js`, `src/utils/app-error.js`, `tests/helpers/*`, `tests/api/health.test.js`, `vitest.config.js`.
- Spec: `specs/02-backend.md` §1.
- **Verify:** `npm run check && npm test` + curl checks in §1.
- **Done when:** listed in §1 "Done when".

## T-04 · Models
- [x] `src/models/Case.js`, `src/models/User.js`, `tests/unit/model.test.js`. Spec: `specs/01-database.md` §3–4, §8.
- **Verify:** `npx vitest run tests/unit/model.test.js`.

## T-05 · Difficulty + scoring
- [x] `src/config/difficulty.js`, `src/services/scoring.js`, `tests/unit/scoring.test.js`. Spec: `02-backend.md` §2, SPEC §8.
- **Verify:** `npx vitest run tests/unit/scoring.test.js` — all six table cases pass.

## T-06 · Serializers
- [x] `src/serializers/case.serializer.js`, `tests/unit/serializer.test.js`. Spec: `02-backend.md` §3.
- **Verify:** `npx vitest run tests/unit/serializer.test.js`.
- **Done when:** leak assertions pass; `toResult` throws for active cases.

## T-07 · AI service core (no network)
- [x] `src/services/ai/{index,prompt,schema,validate}.js`, `providers/mock.js`, tests `validate`, `ai-service`, `prompt`. Spec: `02-backend.md` §4.1–4.5, mock in §4.6.
- **Verify:** `npx vitest run tests/unit/validate.test.js tests/unit/ai-service.test.js tests/unit/prompt.test.js`.
- **Done when:** every bullet in "Verify T-07" is a passing test.

## T-08 · Real providers
- [ ] `providers/gemini.js`, `providers/openai-compat.js`, `buildProvidersFromEnv`, `scripts/try-ai.mjs`.
- **Verify:** `node scripts/try-ai.mjs easy "A stolen trophy at a college cricket final"` → provider gemini, right counts. Run once per difficulty max. If a fallback key is set: `AI_PROVIDERS=openai_compat node scripts/try-ai.mjs easy "..."`.
- **Done when:** a real Gemini case passes validation for easy, medium and hard (attempts ≤ 2 typical). Paste `meta` output in the PR.
- **Status:** code + 37 offline tests done (167 server tests green). Box stays unticked until the live check passes.
- **Remaining:** (1) Praful creates `server/.env` with `GEMINI_API_KEY` and `AI_PROVIDERS=gemini`; (2) confirm `GEMINI_MODEL` is a current Flash model in AI Studio (default `gemini-2.5-flash` may be retired); (3) run `node scripts/try-ai.mjs easy|medium|hard "<premise>"` once each and paste the output; (4) optional: set the `OPENAI_COMPAT_*` vars and run once with `AI_PROVIDERS=openai_compat`. If Gemini returns 400, check the schema (we strip `maxLength`; other keywords are untested live).

## T-09 · Create + get routes
- [x] `src/routes/cases.js`, `src/controllers/cases.controller.js`, `src/services/case.service.js` (create, loadOwned, get), `src/middleware/validate.js`, part of `tests/api/cases.test.js`.
- **Verify:** `npx vitest run tests/api/cases.test.js -t "create|get"`.

## T-10 · Gameplay routes
- [x] discover, hint, accuse, result in service/controller/routes + remaining `cases.test.js` bullets (incl. concurrency).
- Spec: `02-backend.md` §5, `01-database.md` §5.
- **Verify:** `npx vitest run tests/api/cases.test.js`.
- **Done when:** every bullet in "Verify T-09 / T-10" passes; manual run with `AI_PROVIDERS=mock npm run dev` + curl through the whole flow works.

## T-11 · Security hardening
- [x] helmet, CORS allow-list, 415 guard, rate limiters, Turnstile middleware, log hygiene, `tests/api/security.test.js`, `tests/api/rate-limit.test.js`.
- Spec: `specs/03-security.md` §2–3.
- **Verify:** `npm test` (all green) + secret grep commands in `03-security.md` §5.

## T-12 · Auth + history (Tier 2)
- [ ] `src/services/firebase-token.js`, `src/routes/auth.js` (`POST /session`), `src/middleware/auth.js`, `GET /api/cases` for logged-in users, claim on sign-in, `tests/api/auth.test.js`; remove the unused `User` model, `bcryptjs`, `jsonwebtoken` (SPEC v1.1.0: Firebase Authentication).
- **Verify:** `npx vitest run tests/api/auth.test.js && npm test`.

## T-13 · Client scaffold
- [x] Tailwind v4 tokens, fonts, `App.jsx` routes with lazy pages (placeholders), `Layout`, `NavBar`, UI kit, `api/http.js`, `api/cases.js`, `api/mock/*`, `lib/errors.js`, `config/difficulty.js`, `hooks/useReducedMotion.js`, test setup. Spec: `04-frontend.md` §1–3.
- **Verify:** `VITE_USE_MOCK=true npm run dev` → every route renders a placeholder; `npm run lint && npm run build`.

## T-14 · Home + Create
- [x] `pages/Home.jsx`, `pages/CreateMystery.jsx`, `components/case/GeneratingOverlay.jsx`, `hooks/useHealthWake.js`, `CreateMystery.test.jsx`. Spec: `04-frontend.md` §4.1–4.2.
- **Verify:** mock mode: generate easy → lands on `/case/:id`. `npm test -- CreateMystery`.

## T-15 · Investigation
- [x] `pages/Investigation.jsx`, `hooks/useCase.js`, `components/case/{CaseHeader,StoryPanel,SuspectCard,ClueCard,HintsPanel}.jsx`, `Investigation.test.jsx`. Spec: §4.3.
- **Verify:** mock mode: examine clues, take hints until disabled, progress updates; `npm test -- Investigation`; check 360 px width.

## T-16 · Accusation + Results
- [x] `pages/Accusation.jsx`, `pages/Results.jsx`, components for verdict/score, tests. Spec: §4.4–4.5.
- **Verify:** mock mode full flow correct + incorrect; `npm test`.

## T-17 · Auth UI + History (Tier 2)
- [ ] `auth/` (Firebase + mock backend), `context/AuthContext.jsx`, `pages/{Login,Register,History}.jsx`, NavBar states, Results "My cases". Spec: §4.6.
- **Verify:** mock mode: create account → play → History lists case → sign out → sign in → still listed; with a real Firebase project: same flow, plus Google.

## T-18 · Motion & polish
- [ ] GSAP animations from `04-frontend.md` §5, 21st.dev components restyled, optional lazy 3D hero, reduced-motion support, Lighthouse pass.
- **Verify:** `npm run build` (check gzip sizes in output, initial JS < 300 kB), Lighthouse mobile on Home: Perf ≥ 70, A11y ≥ 90; OS "reduce motion" on → no animations.

## T-19 · Integration + E2E
- [ ] Run client against real server with `AI_PROVIDERS=mock` (`VITE_USE_MOCK=false`), fix contract mismatches, `server/scripts/dev-memory.mjs`, `client/playwright.config.js`, `client/e2e/flow.spec.js`, optional CI workflow.
- **Verify:** `cd server && npm test` · `cd client && npm test && npx playwright test` — all green.

## T-20 · Deploy backend
- [ ] Skeleton deploy on D1 evening (health only), final deploy D2. Spec: `06-deploy.md` §2.
- **Verify:** `curl https://<service>.onrender.com/api/health` → `db: "up"`.

## T-21 · Deploy frontend + smoke
- [ ] `client/vercel.json`, Vercel project, env, rewrite. Spec: `06-deploy.md` §3–4.
- **Verify:** smoke script passes for easy, medium, hard against the Vercel URL.

## T-22 · QA + submit
- [ ] Manual QA script (`05-tests.md` §7) on production, fix blockers only.
- [ ] README: what it is, live URL, screenshots (home, room, result), stack, setup, env table, architecture diagram, how security works, test commands, AI tools used.
- [ ] Create **and solve** a mystery on the live site (screenshot result).
- [ ] `git tag v1.0-submission && git push --tags`.
- [ ] Submit GitHub URL + live URL at https://bit.ly/ai-mystery-room-sub-form — **target 2 Nov 8 PM**, hard deadline 11:59 PM.
