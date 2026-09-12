Run a comprehensive project review: machine validator baseline, then scope-triaged specialist agents.

Arguments: $ARGUMENTS (optional scope: `full` | `scoped:<domains>` | `baseline-only`, or a focus description)

Read and follow `skills/project-review/SKILL.md` exactly. The skill contains the full procedure:

1. **Machine Baseline** — run the validator battery (audit, validate-templates, verify-scripts, lifecycle audits, drift check) before any agent dispatch
2. **Detect Project Context** — scan `agents/` for available agents, determine project type and scope mode
3. **Generate Execution Plan** — map agents to the 4 paired review slots, present plan table
4. **Dispatch Agents (max 4, resilient parallel)** — `Agent` tool with `run_in_background: true`; sequential fallback if concurrency-blocked
5. **Collect, Classify, Persist** — findings tables with mandatory Class column (`one-time` | `systemic` | `script-gap`); persist report to `docs/reports/YYYY-MM-DD-project-review-<scope>.md`
6. **Wire Outcomes** — fix-now via PM Gateway; deferred items via `bun scripts/ticket.ts create --manual`; `script-gap` findings get a `validator-hardening:` ticket
7. **Post-Fix Verification** — re-run touched validators, append verification section, log to the daily memory file

## Platform Notes

- On Claude Code: use native `Agent` tool for parallel dispatch
- On Antigravity/Gemini CLI: delegates to `/meeting "project review" --agents [list] --rounds 2 --dialogue`
