# AI handoff prompts — copy, paste, replace `T-XX`

All tools get the same contract: `AGENTS.md` → `SPEC.md` → one part spec → one task in `TASKS.md`. Paste the matching prompt into a fresh chat/session with the repo open.

---

## 1. Universal task prompt (any tool)
```
You are working on the AI Mystery Room repo. Before writing code:
1. Read AGENTS.md and follow its loop and hard rules exactly.
2. Read SPEC.md (source of truth).
3. Read specs/<PART_FILE>.md.
4. Open TASKS.md and do ONLY task T-XX. Its dependencies are done.

Then:
- Reply first with a 3–8 bullet plan (files + how you'll verify). Then implement.
- Run every command in the task's Verify block and paste the real output.
- Check every "Done when" item and the security rules in AGENTS.md §2.
- Commit on branch t-XX-<slug> with message "T-XX: <summary>" and tick the box in TASKS.md.
- Finish with a 5-line report: changes, verify result, open questions, next task ID.
Do not start another task. Do not change SPEC.md contracts. If anything is ambiguous, pick the simplest option consistent with SPEC.md and list it under open questions.
```
`<PART_FILE>`: `01-database`, `02-backend`, `03-security`, `04-frontend`, `05-tests`, `06-deploy`.

---

## 2. Claude Code (Pro) — owner of AI pipeline, security, integration, polish
Start each session with `/clear`, then:
```
Read CLAUDE.md, AGENTS.md, SPEC.md and specs/02-backend.md. Use plan mode.
Do task T-07 from TASKS.md only. The mock provider must be deterministic and must put the
marker MOCK_SECRET_EXPLANATION in the explanation. Run the Verify block and show output.
```
Polish session (T-18):
```
Read CLAUDE.md, SPEC.md §4 and specs/04-frontend.md §1, §4, §5. Do task T-18.
Use the 21st.dev MCP to find a hero, evidence-card and dialog component; copy them into
client/src/components/ui/ and restyle with the @theme tokens. Use GSAP via @gsap/react useGSAP
for: clue flip, verdict stamp, score count-up, generating overlay. Respect useReducedMotion.
3D hero only if bundle budget allows (lazy, desktop only). Verify with npm run build sizes and
a Lighthouse run on Home. Don't change any API calls.
```
Review session (after other tools' PRs):
```
Review the diff of branch t-XX-* against SPEC.md and AGENTS.md hard rules. Focus on: secrets,
solution leaks, score computed anywhere except server/src/services/scoring.js, contract drift
from SPEC §5, missing error states. Run the task's Verify block. List problems with file:line and fix
only real bugs.
```

## 3. Codex (free tier) — well-bounded backend tasks + tests
Give it the smallest context: `AGENTS.md`, `SPEC.md`, the one part spec, `TASKS.md`.
```
Follow AGENTS.md. Implement TASKS.md task T-05 using specs/02-backend.md §2 and SPEC.md §8.
Write tests/unit/scoring.test.js with it.each over the six table cases A–F.
Run: cd server && npx vitest run tests/unit/scoring.test.js  — paste output. Commit "T-05: scoring".
```
Good Codex tasks: T-03, T-04, T-05, T-09, T-12, test files for any task.

## 4. Antigravity (free) — frontend lane
```
Follow AGENTS.md. Work only inside client/. Read SPEC.md §3–§5 and specs/04-frontend.md.
Do TASKS.md task T-15 (Investigation Room). Run the app with VITE_USE_MOCK=true so you don't need
the backend. Use the API functions in src/api/cases.js only — never call fetch/axios directly in pages.
Use the browser to check 360px and 1440px widths and keyboard-only use. Then run:
npm run lint && npm run build && npm test -- Investigation   and paste output.
```
Good Antigravity tasks: T-13, T-14, T-15, T-16, T-17.

## 5. When a tool hits its free limit mid-task
```
Commit current work as "WIP T-XX: <what's done>". In TASKS.md under T-XX add a "Remaining:" list
with exact next steps and any failing command output. Stop.
```
Next tool's prompt: the universal prompt + "Continue T-XX from the Remaining list in TASKS.md."

## 6. Bug-fix prompt (QA day)
```
Bug: <what happened>, steps: <1,2,3>, expected: <...>, actual: <...>, screenshot/log: <...>.
Follow AGENTS.md. Find the root cause, write a failing test first if it is server-side, fix it,
run the full test suite (server npm test, client npm test), and report. Don't refactor unrelated code.
```
