Run a comprehensive parallel project review using all available specialist agents.

Arguments: $ARGUMENTS (optional focus area or scope description)

Read and follow `skills/project-review/SKILL.md` exactly. The skill contains the full procedure:

1. **Detect Project Context** — scan `agents/` for available agents, determine project type
2. **Generate Execution Plan** — map agents to 7 review domains, present plan table, wait for user approval
3. **Dispatch Agents in Parallel** — use `Agent` tool with `run_in_background: true` for each domain
4. **Synthesize Results** — collect all findings into prioritized tables (Critical/High/Moderate/Low)
5. **Generate Action Items** — create prioritized action item table with owner, deliverable, priority, phase

Pass `--tasks` flag to automatically convert action items into tracked tasks.

## Platform Notes

- On Claude Code: use native `Agent` tool for parallel dispatch
- On Antigravity/Gemini CLI: delegates to `/meeting "project review" --agents [list] --rounds 2 --dialogue`
