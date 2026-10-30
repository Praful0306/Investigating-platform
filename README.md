# AI Mystery Room — spec pack

This folder is the complete spec-driven plan for the NxtWave **AI Mystery Room** project (deadline 2 Nov, 11:59 PM).
Copy every file into the root of your new repo (T-01). Then hand tasks to AI tools with the prompts in `prompts/`.

| File | What it's for | Who reads it |
|---|---|---|
| `SPEC.md` | **The required deliverable.** Full spec: features, flow, pages, API contract, data model, AI rules, scoring, security, acceptance criteria | Everyone, first |
| `AGENTS.md` | Working loop + hard rules for every AI tool (Codex/Antigravity read it automatically) | Every AI tool |
| `CLAUDE.md` | Points Claude Code to AGENTS.md + its role | Claude Code |
| `TASKS.md` | 22 tasks with dependencies, files, Verify commands, Done-when lists | Everyone |
| `SCHEDULE.md` | Hour-by-hour plan 30 Oct → 2 Nov, cut list | Praful |
| `FEATURES.md` | Tiered feature recommendations + where Catalyst/Cloudflare/Grok/21st.dev fit | Praful |
| `specs/00-conventions.md` | Folder tree, scaffold commands, git flow | All |
| `specs/01-database.md` | Atlas setup, Mongoose models, atomic updates | Backend lane |
| `specs/02-backend.md` | Express app, AI pipeline (prompt, schema, validator, retry, providers), routes | Backend lane |
| `specs/03-security.md` | Threat model, controls, leak test, secret scans | Backend lane + reviewer |
| `specs/04-frontend.md` | Design system, pages, components, motion, a11y, mock API | Frontend lane |
| `specs/05-tests.md` | Test plan, required tests, e2e, production smoke script | All |
| `specs/06-deploy.md` | Render/Catalyst + Vercel rewrite + Atlas, post-deploy checks | Integrator |
| `prompts/AI_HANDOFF_PROMPTS.md` | Copy-paste prompts for Claude Code, Codex, Antigravity | Praful |
| `server/.env.example`, `client/.env.example` | Env templates (no secrets) | All |

## Start in 5 steps
1. Do T-02 (accounts and keys) yourself.
2. Create an empty public GitHub repo `ai-mystery-room`.
3. Give Claude Code: "Read this spec pack and do T-01 from TASKS.md." It scaffolds and commits these files.
4. Start both lanes: backend tasks to Claude Code/Codex, frontend tasks to Antigravity (mock mode).
5. Follow `SCHEDULE.md`; never skip a task's Verify block.

## Decisions already made (so AI tools don't re-ask)
- Wrong accusation: base 0, clue bonus and hint penalty still apply, min 0 (SPEC §8, D1).
- Guests can play everything; login is optional (Tier 2).
- Same-origin API through a Vercel rewrite; cookies are first-party.
- Gemini is the production generator; fallbacks only for outages.
- One account per provider.
