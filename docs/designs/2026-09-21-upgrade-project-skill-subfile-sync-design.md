# Design: upgrade-project skill sub-file sync (v1.37.0)

- **Spec ID**: `2026-09-21-upgrade-project-skill-subfile-sync`
- **Date**: 2026-09-21
- **Status**: implemented
- **Owner**: automation-engineer
- **Script**: `scripts/upgrade-project.ts` 1.36.0 → 1.37.0

## Summary

`upgrade-project.ts` delivers only `skills/<name>/SKILL.md` for L1 common skills. Sub-files
(`references/`, `assets/`, `examples/`, `templates/`) are copied at scaffold time only and are
never delivered to existing projects, so skill updates that add sub-files silently never reach
the fleet. The 2026-09-20 handbook v0.6.0 fleet upgrade hit this exactly: every project received
the updated SKILL.md while `references/KOREAN_LANGUAGE.md` and the localized `copy-code.js`
stayed absent, leaving the Korean language support non-functional in 8 of 11 projects and
requiring an emergency manual re-delivery (8 fleet PRs on 2026-09-21).

## Root Cause

The SYNC_IF_NEWER common-skills pass (`scripts/upgrade-project.ts` ~L1670-1728) compares and
copies only the single file `skills/<name>/SKILL.md`. The variant-skills pass (~L1740+) already
mirrors the whole skill directory via `copySkillDir()`, proving the intended pattern — but that
helper walks only two levels and skips files at depth ≥ 3 (e.g. `references/validation/*`).

## Requirements

1. R1 — Common-skill NEW and UPDATE deliveries must copy the skill's whole directory, not just
   SKILL.md. Template files overwrite same-named project files; project-only files stay (PRESERVE
   philosophy is unchanged).
2. R2 — When template and project SKILL.md versions are equal ("OK"), the pass must still deliver
   template files that are entirely missing from the project (additive catch-up) and must warn —
   not overwrite — when a same-version file's content differs (possible project-local adaptation).
3. R3 — Variant-skill directory mirroring must be recursive so files at depth ≥ 3 are delivered.
4. R4 — Platform mirrors need no new logic: the post-upgrade `sync-skills.ts` invoke already
   distributes project `skills/` to `.claude/.gemini/.agents/.codex`.
5. R5 — Dry-run must remain side-effect free and must report what a real run would deliver.
6. R6 — The G05 local-modification CONFLICT warning on SKILL.md keeps its current semantics.

## Design

Single helper in the common-skills pass:

```ts
const copySkillDirRecursive = (tplSkillDir: string, projSkillDir: string): void => {
  mkdirSync(projSkillDir, { recursive: true });
  cpSync(tplSkillDir, projSkillDir, { recursive: true });
};
```

`cpSync` with `recursive: true` merges the template tree into the project directory: template
files overwrite same-named project files, project-only files and directories are preserved.

Per-skill state machine (common pass):

| Case (project SKILL.md) | Action |
|---|---|
| missing | NEW → whole-dir copy (assetGate allowlist still consulted) |
| older version, or hash mismatch | UPDATE → whole-dir copy; G05 CONFLICT warning unchanged |
| equal version/hash | additive catch-up: recursively copy template files missing in the project; same-version differing files are reported as `⚠️ DRIFT skills/<name>/ …` and left untouched |

Catch-up copies increment `syncChanged` so upgrade summaries stay honest. The variant-skills
pass's `copySkillDir()` body is replaced by the same `cpSync` recursive merge (R3).

## Files Changed

- `scripts/upgrade-project.ts` (+L1 mirror via propagate pipeline) — 1.37.0
- `tests/unit/upgrade-skill-subfile-sync.test.ts` — new integration test
- `scripts/SCRIPTS.md` — registry row bump
- `CHANGELOG.md` — [Unreleased] entry

## Test Plan

Integration test spawns the real script against a temp project seeded from the real
`templates/common/skills/handbook` (following `upgrade-tree-sync.test.ts` conventions):

1. Seeded SKILL.md at 0.5.9 → upgrade → SKILL.md 0.6.0 AND `references/KOREAN_LANGUAGE.md`,
   `references/MAINTENANCE_PLAYBOOK.md`, `assets/js/copy-code.js` delivered (R1).
2. Seeded SKILL.md at 0.6.0 with `references/KOREAN_LANGUAGE.md` deleted → upgrade → file
   delivered by additive catch-up (R2), while a deliberately modified same-version file is
   preserved and reported as DRIFT (R2).
3. Dry-run run of case 1 writes nothing and prints the whole-dir delivery (R5).

`bun test` full suite must stay green; `bun scripts/audit.ts` must pass.

## Accessibility

Non-UI developer tooling (CLI script). Exempt from WCAG 2.1 AA considerations per ADR-0065's
backend/non-UI exemption; no interaction surfaces change.

## Preview Verification

Non-UI change (no rendered output). Exempt per ADR-0070; verification is the integration test
and CLI output assertions above.

## Rollout & Compatibility

No flag changes; output lines add `CATCH-UP`/`DRIFT` annotations that fleet tooling treats as
informational. Next fleet upgrade run self-heals any future same-version sub-file gaps; the
2026-09-21 manual fleet re-delivery (8 PRs) remains the one-time remediation of past drift.
