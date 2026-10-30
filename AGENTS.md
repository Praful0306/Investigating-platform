# AGENTS.md — rules for every AI coding tool on this repo

Read by Codex, Antigravity, Claude Code (via CLAUDE.md), Cursor, Copilot, etc. Humans follow it too.

## 0. Read order before touching code
1. `SPEC.md` (source of truth — contract, data model, scoring, security).
2. `specs/00-conventions.md` (folder layout, code style, git flow).
3. The part spec for your task (`specs/01-…` to `specs/06-…`).
4. `TASKS.md` — find your task ID, its dependencies, verify commands and done criteria.

## 1. The loop (do this for every task)
1. **Pick** one task from `TASKS.md` whose dependencies are `[x]` done. Work on only that task.
2. **Plan** in 3–8 bullet points: files you will create/change, and how you will verify. Do not start a second task.
3. **Build** the smallest change that meets the task's done criteria. Match the existing code style.
4. **Verify** by running every command in the task's *Verify* block. Paste the real output in your reply. If a command fails, fix and re-run. Never claim a pass you did not see.
5. **Self-check** against the task's *Done when* list and the security rules below.
6. **Commit** with message `T-XX: <short summary>` on the task branch. Tick the box in `TASKS.md`.
7. **Report** in 5 lines: what changed, verify output summary, anything left, next task ID.
8. **Stop** and wait, unless told to continue to the next task.

## 2. Hard rules (never break)
- Never change the API contract, data model, difficulty table or scoring in code without first updating `SPEC.md` in the same PR and saying so.
- Never send `solution`, `culpritId`, `explanation`, `keyClueIds`, unrevealed hints or undiscovered clue descriptions to the client before accusation. Always use the serializers in `server/src/serializers/`.
- Never `res.json(mongooseDoc)`.
- Never put secrets in client code, tests, fixtures, commits or logs. Only `.env.example` with placeholders is committed.
- Never compute score on the client except as a labelled "preview".
- Never skip, delete or `.skip` a failing test to get green. Fix the code or explain why the test is wrong.
- Never add a new dependency without a one-line reason in the commit message. Prefer what is already installed.
- Never rewrite files outside your task's scope. If you must, list them in the report.
- Do not invent endpoints, fields or env vars. If the spec is unclear, write the question in your report and choose the simplest option consistent with SPEC.md.

## 3. Commands
```
# server
cd server && npm install
npm run dev            # nodemon, port 5000
npm test               # vitest run (uses mongodb-memory-server + AI_PROVIDERS=mock)
npm run check          # node --check on src + tests in CI mode

# client
cd client && npm install
npm run dev            # Vite on 5173, proxies /api -> http://localhost:5000
npm run build          # must pass with zero errors
npm run lint
npm test               # vitest + testing-library

# end-to-end (needs both running with AI_PROVIDERS=mock)
cd client && npx playwright test

# production smoke
node server/scripts/smoke.mjs https://<your-vercel-app>.vercel.app
```

## 4. Style
- JavaScript (ESM). No TypeScript (keeps the stack the guide asks for; JSDoc types welcome).
- Server: small files, `async/await`, errors via `AppError(code, status, message)` and the central error middleware.
- Client: function components, hooks, Tailwind classes, no inline style objects except for animation values.
- Names: camelCase variables, PascalCase components, kebab-case non-component files.

## 5. When working with limited (free-tier) context
- Load only SPEC.md + your part spec + the files you touch.
- Prefer finishing one task fully over starting three.
- If you run out of budget mid-task, commit WIP to the branch with `WIP T-XX:` and write in `TASKS.md` under the task exactly what remains.
