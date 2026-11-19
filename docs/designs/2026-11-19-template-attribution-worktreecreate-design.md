# Template settings: disable commit/PR attribution, retire the WorktreeCreate hook — design

- **Spec ID**: 2026-11-19-template-attribution-worktreecreate-design
- **Status**: Implemented (approved by user 2026-11-19) — implementation in `templates/` only
- **Date**: 2026-11-19
- **Tiers**: L0 (this doc only; follow-ups listed in §4) · L1 (`templates/common`) · L2 (16 `templates/co-*` variants) · L3 (delivery by upgrade visits)

## 1. Problem

1. Projects scaffolded from the templates add `Co-Authored-By` trailers and "Generated with Claude Code" lines to commits and PRs. No template setting turns this off.
2. Every template `.claude/settings.json` registers `hooks.WorktreeCreate` → `git config core.hooksPath .githooks`. Claude Code treats a WorktreeCreate hook as a *replacement* for worktree creation: the hook must create the worktree and print its path. This hook prints nothing, so every worktree creation fails with "WorktreeCreate hook failed". The `SessionStart` hook already runs the same command, so the WorktreeCreate entry adds nothing.

## 2. Decision

### D1 — `attribution` key (17 files)

Add a top-level `"attribution": {"commit": "", "pr": ""}` right after `"effortLevel"` in `templates/common/.claude/settings.json` and in all 16 `templates/co-*/.claude/settings.json`. Each variant carries a full copy of the settings file. `effortLevel` sits at line 171 in co-abap, line 18 in co-price, and line 2 in the others.

Delivery: `scripts/lib/upgrade-policy.ts` `JSON_MERGE_FILES` includes `.claude/settings.json`, and `scripts/upgrade-project.ts` `mergeSettingsData` deep-merges with template precedence. The next upgrade adds the new key to existing projects.

### D2 — remove `hooks.WorktreeCreate` (same 17 files)

Delete the whole `WorktreeCreate` event block. Nothing requires the hook to be present:
- `scripts/helpers/validate-platform-parity.ts` lists `hooks.WorktreeCreate` only in its `claude_only` list.
- `hook-dedupe.ts` and `lifecycle-sync-audit` mention it only in comments.
- `tests/unit/hook-dedupe.test.ts` uses it only as fixture data.

### D3 — instruction rule

Add to `templates/common/CLAUDE.md`, under "Git & PR Additions (Claude Code)" and before the `<!-- COMMON-CLAUDE:END -->` marker:

> Never add `Co-Authored-By` trailers or 'Generated with Claude Code' lines to commit messages or PR descriptions.

### D4 — release bookkeeping

Add a `templates/CHANGELOG.md` `[Unreleased]` entry (Changed: attribution key + CLAUDE.md rule; Removed: WorktreeCreate hook). Under release-template rules, `templates/VERSION` (0.30.0) moves only at the next `release-template` cut, not in this change.

## 3. Known gap — removal does not propagate on upgrade

The settings JSON_MERGE is additive: hook arrays are unioned and project-only entries are kept. Existing L3 projects therefore **keep the broken WorktreeCreate hook** after upgrade. Only the D1 addition reaches them. Until §4.1 lands, the workaround is to delete the block by hand in each affected project's `.claude/settings.json`.

## 4. Follow-ups (root-side, out of scope here — CLAUDE.md §9 isolation)

1. **Retired-hook removal list.** Add a list of retired hooks in `scripts/lib/hook-dedupe.ts`, applied by the `scripts/upgrade-project.ts` JSON_MERGE pass. It drops project hook entries that exactly match a retired (event, matcher, command) tuple; the first entry is `WorktreeCreate` / `""` / `git config core.hooksPath .githooks`. An exact match means customized project hooks are never touched. Each drop is logged as a MERGE decision row.
2. **Variant generator.** `scripts/helpers/generate-variant.ts:1518` still emits the WorktreeCreate block, so newly generated variants would bring the hook back. Remove it there, and emit `attribution` next to `effortLevel`.

## 5. Scope

Only one root file is touched: this design doc. It lives in `docs/designs/` because the spec registry requires that location. All implementation edits are under `templates/`.

## 6. Acceptance

- All 17 settings files parse as JSON, contain `attribution` with empty `commit`/`pr`, and contain no `WorktreeCreate`.
- `bun scripts/sync-variant-settings.ts --check`, `bun scripts/helpers/validate-platform-parity.ts`, and `bun run test:unit` (hook-dedupe fixture) still pass.
- `templates/common/CLAUDE.md` contains the D3 rule inside the COMMON-CLAUDE block.
