# CLAUDE.md

Follow `AGENTS.md` exactly — it holds the working loop, hard rules, and commands for this repo.
`SPEC.md` is the source of truth. `TASKS.md` lists tasks; do one task at a time and run its Verify block before claiming done.

Claude Code specifics:
- You own the hardest-correctness parts by default: AI pipeline, security, integration and final review (see `prompts/AI_HANDOFF_PROMPTS.md`).
- Use plan mode for any task touching more than 3 files.
- Frontend work: use the 21st.dev MCP and the GSAP / frontend skills when available, but keep components inside `client/src/components/` and obey the bundle budget in SPEC §10.
