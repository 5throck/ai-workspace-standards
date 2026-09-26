# Meeting Command Retirement — Root Command Stubs (T-20260926-027)

- **Spec ID**: 2026-09-26-meeting-command-retirement
- **Date**: 2026-09-26
- **Status**: implemented
- **Decision ticket**: T-20260926-027
- **References**: `docs/analysis/2026-09-26-meeting-command-retirement-audit.md`, AGENTS.md §6 retirement note (2026-09-26, PR #1092), T-20260925-003 (`.agents/commands` L0-resident ruling), T-20260910-022 (co-safety fork-model adjudication)

## 1. Decision

**Retire the three root meeting command stubs. Do not re-point.**

Rationale:

1. Retirement is the recorded direction. AGENTS.md (SSOT) states "the legacy `/meeting` slash command is retired (2026-09-26)" (PR #1092), and the reference audit classifies `/meeting` call advertising (`cmd_ad`) as replacement targets.
2. The stubs carry no platform-specific implementation. All three are verbatim copies of the skill SSOT body and self-reference circularly ("the actual implementation resides in `.claude/commands/meeting.md`"). The facilitation content lives in `skills/meeting-facilitation/SKILL.md`, which remains the invocation path.
3. Re-pointing (bumping `.agents` 1.4.0 → 1.4.3, rewriting descriptions) would keep a retired invocation surface alive and preserve the circular-stub design. The skill is discoverable without the command files.

## 2. Scope

In scope (same-commit coherence with the deletion):

- **R1** Delete the root command files: `.claude/commands/meeting.md`, `.gemini/commands/meeting.md`, `.agents/commands/meeting.md`, `.codex/prompts/meeting.md`.
- **R2** Delete the L1 propagation copies: `templates/common/.claude/commands/meeting.md`, `templates/common/.gemini/commands/meeting.md`, `templates/common/.codex/prompts/meeting.md`.
- **R3** Remove the special-sync that recreates them: `scripts/sync-skills.ts` Phase 1 `meeting-facilitation` branch and its header note. Without this, the next sync re-materializes `.claude|gemini/commands/meeting.md` from the skill SSOT.
- **R4** Update `scripts/validate-templates.ts`: drop `meeting.md` from the hardcoded `allSharedCommands` list (Check 6 would fail on the missing file); remove `checkSharedFileSync` (Check 8) and its call site (dead after deletion).
- **R5** Update `docs/templates/common-contract.json`: remove the `common_commands` `"meeting"` entry; drop the stale "delegates to `.claude/commands/meeting.md`" clause from the `meeting-facilitation` platform-skill description.
- **R6** Fix the skill SSOT dangling text: `skills/meeting-facilitation/SKILL.md` — remove command-file delegation and `/meeting` advertising from description/Context/When-to-Use/Execution-Steps; keep Governance Rules, Output Format, Related Skills; bump 1.4.3 → 1.4.4; re-deliver the five platform mirrors (`.claude/.gemini/.agents/.codex/skills` + `templates/common/skills`); bump `skills/SKILLS.md` and `docs/VERSION_MANIFEST.md` rows.
- **R7** Update the L0 twin docs that point at the deleted files: `CLAUDE.md` (command table row, explicit invocation), `GEMINI.md` (explicit invocation, `/meeting` Antigravity intercept rule), `CODEX.md` (intercept example, explicit invocation); mirror the same edits into `templates/common/{CLAUDE,GEMINI}.md`.
- **R8** Update in-surface cross-references in `memlog.md` and `project-review.md` (root `.claude/.gemini/.agents/.codex` + L1 `templates/common/.claude/.gemini/.codex`) from `/meeting` delegation to meeting-facilitation skill references.
- **R9** `templates/README.md` / `templates/README_ko.md`: replace the stale `meeting.md` shared-sync example (references a nonexistent `templates/co-develop` copy) with a real L0↔L1 pair (`memlog.md`).

Out of scope (stays as-is, separate work):

- **O1** co-safety fork-model overlays (`templates/co-safety/{.claude,.gemini}/commands/meeting.md`, `.codex/prompts/meeting.md`) — adjudicated variant divergence derived from co-safety's own `skills/meeting-facilitation` fork (T-20260910-022). This is the L2 layer, not the root stubs.
- **O2** `Projects/` copies and L2 variant doc prose (`cmd_ad` 186, `session_prose` 182 per the audit) — delivered copies re-sync via `/sync`; prose replacement is the audit's remaining program.
- **O3** Historical records (`memory/`, `CHANGELOG.md`) — immutable.
- **O4** `templates/co-safety/skills/meeting-facilitation` fork skill — variant-owned.

## 3. Behavior Change

`/meeting` stops resolving as a slash command on all root surfaces. Meeting facilitation is invoked through the meeting-facilitation skill (explicit skill invocation; `metadata.triggers` unchanged). No runtime code depends on the command files: the only producer was sync-skills Phase 1 (removed, R3) and the only structural consumer was validate-templates Check 8 (removed, R4).

## 4. Verification

- `bun scripts/verify-platform-lifecycle.ts` — Check G parity after symmetric removal.
- `bun scripts/validate-templates.ts` — Check 6 shared commands, C-CM-04 contract coverage (both directions).
- `bun scripts/skill-lifecycle-audit.ts` — registry row vs SKILL.md frontmatter at 1.4.4.
- `bun scripts/test-runner.ts unit` — full unit suite.
- Grep sweep: no non-historical `/meeting` command references outside the out-of-scope layers (O1–O4).

## 5. Risks

- Existing Projects keep a stale `/meeting` copy until their next `/sync` upgrade — acceptable per audit principle 4 (Projects land via re-sync).
- The audit's remaining doc-replacement program (L2/Projects prose) proceeds independently; this change removes the structural root so no new `/meeting` command copies are delivered.
