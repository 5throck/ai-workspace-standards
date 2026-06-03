# Meeting Transcript
**Date**: 2026-06-04
**Topic**: publish-to-template workspace-only skill filter gap and workspace root stray file enforcement
**Participants**: architect, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[Architect]** (Round 1)

Both problems share a common pattern: the criteria for "what belongs where" are managed in multiple disconnected places. `publish-to-template.ts` has no awareness of scope, `validate-templates.ts` knows via hardcoding, and SKILL.md frontmatter declares it for some skills only. These three sources never reference each other — that is the root cause.

**Issue 1 design**: Standardize skill classification to a `scope` frontmatter field in SKILL.md: `scope: workspace | common | variant`. The current `workspace-only: true` flag is inconsistent and non-standard. `publish-to-template.ts` should read this field and exclude `scope: workspace` skills from L1 copy. `validate-templates.ts` Check B-07 hardcoded list should be replaced by this frontmatter-based check. `simulate-project-creation` needs `scope: workspace` added immediately.

**Issue 2 design**: Strengthen root protection with two layers. First, convert `audit.ts` stray check from pattern-based to allowlist-based — manage files/folders permitted in root as a whitelist; any `.sh`, `.ps1`, `.ts`, `.py`, `.js` file outside the list is blocked. Second, a `tests/` folder with `.gitkeep` and README makes the convention structural. Question to automation-engineer: should the allowlist live as a constant in `audit.ts` or integrate into the existing `docs/workspace-schema.json`?

**[Automation-Engineer]** (Round 1)

Agreed on `scope` field standardization. Implementation note: SKILL.md frontmatter parsing is already done in `validate-templates.ts` — same helper or simple regex can be reused in `publish-to-template.ts`. Edge case to resolve: default value when `scope` is missing. Proposal: default to `common` (copy as before) for migration safety, with a path toward making `scope` required for all skills.

On allowlist location: `docs/workspace-schema.json` is the right place. `validate-templates.ts` already references it (`workspace-only: references docs/workspace-schema.json`). Adding `audit.ts` as a second reader creates a single SSOT. Add a `"rootAllowlist"` section to `workspace-schema.json`; `audit.ts` reads it for whitelist enforcement.

Also flagging `fix-hooks.sh` and `fix-npx.sh`: these must be moved to `tests/` or deleted before next sync. Architect: what is the intended structure for `tests/`? Current subdirs are `tests/scenarios/` and `tests/unit/` — do we need `tests/debug/` or `tests/fixtures/`?

**[Architect]** (Round 2)

Agreed on `common` as migration default for `scope` — but it must be labeled as a migration-period default. Long-term: make `scope` required. Adding a missing-scope warning to `skill-lifecycle-audit.ts` will naturally drive adoption.

On `tests/` structure: current `tests/scenarios/` and `tests/unit/` are sufficient. Adding `tests/debug/` or `tests/fixtures/` preemptively creates empty folder management overhead. Set root protection rules first; let `tests/` internal structure evolve organically.

Concrete `rootAllowlist` design:
```json
"rootAllowlist": {
  "extensions_blocked": [".sh", ".ps1", ".ts", ".js", ".py"],
  "exceptions": ["scripts/", "tests/", ".claude/", ".gemini/"]
}
```
Question to automation-engineer: `extensions_blocked` approach vs. pure whitelist — which is more stable to implement?

**[Automation-Engineer]** (Round 2)

Whitelist (allowlist) is safer and simpler. A blocklist requires updates whenever new extensions appear; a whitelist blocks anything not explicitly permitted — "default deny" is the more secure posture.

Concrete `rootAllowlist` proposal:
```json
"rootAllowlist": {
  "files": [
    "package.json", "bun.lockb", "bun.lock", "tsconfig.json",
    ".gitignore", ".gitattributes", ".gitmodules",
    "README.md", "README_ko.md", "CLAUDE.md", "GEMINI.md", "AGENTS.md",
    "CHANGELOG.md", "CONSTITUTION.md", ".mcp.json",
    ".sync_context.tmp"
  ],
  "dirs": [
    "scripts", "tests", "agents", "skills", "docs", "memory",
    "templates", ".claude", ".gemini", ".githooks", ".git",
    "node_modules"
  ]
}
```

For `scope` default behavior in `publish-to-template.ts`: when `scope` field is missing, default to `common` AND print `[WARN] skill-name: scope field missing, defaulting to common`. This double-notification (here + skill-lifecycle-audit.ts) drives developers to fill in the field organically.

Final work: 4 file modifications + 2 immediate file removals.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Add `scope: workspace` to `simulate-project-creation/SKILL.md` | Immediate |
| A-02 | automation-engineer | Medium | `publish-to-template.ts`: add `scope`-based skill filter (default `common`, emit WARN on missing) | Phase 1 |
| A-03 | automation-engineer | Medium | `validate-templates.ts` Check B-07: replace hardcoded list with frontmatter-based dynamic check | Phase 1 |
| A-04 | automation-engineer | Low | `skill-lifecycle-audit.ts`: add warning for missing `scope` field | Phase 1 |
| A-05 | architect | Medium | Add `rootAllowlist` section to `docs/workspace-schema.json` | Phase 1 |
| A-06 | automation-engineer | Medium | `audit.ts` stray check: replace 4-pattern check with `workspace-schema.json` `rootAllowlist`-based whitelist | Phase 2 (after A-05) |
| A-07 | automation-engineer | Low | Remove `fix-hooks.sh` and `fix-npx.sh` from workspace root | Immediate |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun run publish-to-template` does NOT copy `simulate-project-creation` to `templates/common/skills/` | Run dry-run after A-01+A-02; confirm skill absent |
| C-02 | `validate-templates.ts` detects any SKILL.md with `scope: workspace` in `templates/common/skills/` | Add test skill with `scope: workspace` to `templates/common/skills/`, run validate-templates |
| C-03 | `audit.ts` fails when a `.sh` file exists in workspace root | Place a temp `.sh` in root, run `bun scripts/audit.ts`, confirm FAIL |
| C-04 | `audit.ts` passes after removing `fix-hooks.sh` and `fix-npx.sh` | Run audit after A-07 |
| C-05 | `publish-to-template.ts` prints `[WARN]` for any skill missing `scope` field | Run publish on workspace with a scope-less skill |
