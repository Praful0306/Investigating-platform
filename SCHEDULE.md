# SCHEDULE.md — 30 Oct → 2 Nov (IST)

Deadline: **Sun 2 Nov, 11:59 PM**. Internal submit target: **2 Nov, 8:00 PM** (4 h buffer for Render/Vercel/Gemini surprises).
Feature freeze: **2 Nov, 2:00 PM** — after that only bug fixes.

Two lanes run in parallel every day: **Backend lane** (Claude Code + Codex) and **Frontend lane** (Antigravity, then Claude Code for polish). Praful is the integrator: merges PRs, runs Verify commands, keeps `TASKS.md` honest.

## Day 0 — Thu 30 Oct (today, afternoon + evening) · "Foundation"
| Time | Who | Task |
|---|---|---|
| 1:00–2:00 PM | Praful | T-02 accounts & keys (AI Studio, Atlas, Vercel, Render/Catalyst, optional Cloudflare/Groq) |
| 2:00–3:30 PM | Claude Code | T-01 scaffold repo, commit all spec files, push to GitHub |
| 3:30–6:00 PM | Codex | T-03 server skeleton |
| 3:30–7:00 PM | Antigravity | T-13 client scaffold + UI kit + mock API |
| 7:00–9:00 PM | Codex | T-04 models, T-05 scoring |
| 9:00 PM | Praful | Merge, run all Verify blocks, tick TASKS.md |
**Exit criteria:** repo public on GitHub; `npm test` green for health/models/scoring; client runs in mock mode with routes.

## Day 1 — Fri 31 Oct · "Engine + screens"
| Time | Who | Task |
|---|---|---|
| 9:00 AM–12:00 PM | Claude Code | T-06 serializers, T-07 AI service core |
| 12:00–1:30 PM | Claude Code | T-08 Gemini provider; run try-ai for 3 difficulties |
| 9:00 AM–1:00 PM | Antigravity | T-14 Home + Create |
| 2:00–4:00 PM | Codex | T-09 create/get routes |
| 2:00–6:00 PM | Antigravity | T-15 Investigation |
| 4:00–7:00 PM | Claude Code | T-10 gameplay routes (atomic) |
| 7:00–8:00 PM | Praful + Claude Code | T-20 **skeleton** deploy to Render + Atlas, health check through public URL |
| 8:00–10:00 PM | Antigravity | T-16 Accusation + Results |
**Exit criteria:** full game playable locally — client (mock mode) and server (mock AI) each complete the flow; real Gemini generates valid cases for all 3 difficulties; backend reachable online.

## Day 2 — Sat 1 Nov · "Join, harden, ship v1"
| Time | Who | Task |
|---|---|---|
| 9:00–11:00 AM | Claude Code | T-11 security hardening + leak tests |
| 9:00 AM–12:00 PM | Claude Code (2nd session) or Praful | T-19 integration: client ↔ real server, fix contract drift |
| 12:00–1:00 PM | Praful | T-20 final backend deploy, T-21 Vercel + rewrite, smoke ×3 |
| 2:00–5:00 PM | Codex | T-12 auth + history (Tier 2) |
| 2:00–6:00 PM | Claude Code | T-18 GSAP + 21st.dev polish, optional 3D hero |
| 5:00–7:00 PM | Antigravity / Codex | T-17 auth UI + history |
| 7:00–9:00 PM | Claude Code | T-19 Playwright e2e + client tests; CI workflow |
| 9:00–10:00 PM | Praful | Redeploy, smoke ×3, play one full case on phone |
**Exit criteria:** live URL plays all 3 difficulties end to end; all tests green; **this alone is submittable**.

## Day 3 — Sun 2 Nov · "Prove it & submit"
| Time | Who | Task |
|---|---|---|
| 9:00 AM–12:00 PM | Praful | T-22 manual QA script on production; log bugs as issues |
| 9:00 AM–2:00 PM | Claude Code / Codex | fix QA bugs only (blockers first) |
| 2:00 PM | — | **Feature freeze** |
| 2:00–5:00 PM | Claude Code + Praful | README with screenshots, architecture, security notes, final SPEC.md touch-ups (change log) |
| 5:00–6:00 PM | Praful | Final deploy, smoke ×3, solve one mystery on live site, screenshot |
| 6:00–7:00 PM | Praful | Tag `v1.0-submission`, check repo public, `.env` absent |
| **7:00–8:00 PM** | Praful | **Submit form** (GitHub URL + live URL) |
| 8:00–11:59 PM | — | Buffer. Keep the backend warm (ping) through the evaluation window |

## Cut list (if behind schedule, drop in this order)
1. 3D hero (T-18 part) → keep CSS hero.
2. Leaderboard / share (Tier 3).
3. Auth + history (T-12, T-17) → guests only (still meets all acceptance criteria).
4. Turnstile → rate limits only.
5. Fallback LLM provider → Gemini only + friendly 503.
**Never cut:** server-side solution secrecy, backend scoring, validation + retry, tests for those, deployment.

## Free-tier budget tips
- Develop and test with `AI_PROVIDERS=mock` — zero Gemini calls.
- Real Gemini calls only in T-08 (≈ 6), smoke runs (3 per deploy), and manual QA (≈ 10). That fits comfortably in a free daily quota.
- Rotate tools when one runs out of its daily free allowance: hand the same task file to the next tool; `AGENTS.md` + the task's Verify block keep the quality the same.
