# Upgrade-Project Skill — Lifecycle Record

## Metadata
- **Skill**: upgrade-project
- **Status**: active
- **Version**: 1.6.5
- **Owner**: pm
- **Created**: 2026-07-31
- **Last Updated**: 2026-11-27 (Version 1.6.4 → 1.6.5: body script version pin refreshed `upgrade-project.ts` v1.115.0 → v1.125.0 — the SCRIPTS.md registry advanced and the SVP check flagged the stale pin; citation refresh + last_reviewed stamp, no procedure change. Previous: 2026-10-31 Version 1.6.1 → 1.6.2: TEMPLATE TREE SYNC row documents the trail-migration tolerance rules — JSON_MERGE hook-entry path guard and the `.trail/`-marker SEED_SKIP (retired-surface) seed retirement — per design 2026-10-31-graft-trail-migration, U-20261031-009. Previous: 2026-10-26 Version 1.6.0 → 1.6.1: citation-only correction in the SKILL.md provenance text — spec docs/designs/2026-10-26-project-review-remediation-design.md R4; no behavior change)

## Description
Upgrades an existing L2/L3 project to the current template version: syncs template improvements into a variant-based project's scripts, agents, skills, docs, and commands through the policy-driven TEMPLATE TREE SYNC engine (`scripts/upgrade-project.ts`, backed by `lib/upgrade-policy.ts`), with country-aware .env.sample delivery and conflict warnings for locally-modified files.

## Dependencies
- `scripts/upgrade-project.ts` — main implementation (v1.39.0)
- `scripts/lib/upgrade-policy.ts` — delivery-policy engine (ADD_IF_MISSING / PROCEDURES / PRESERVE semantics)
- `scripts/lib/env-sample.ts` — country-aware .env.sample merge engine
- `scripts/resolve-variants.ts` — variant.json reconciliation support

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-31 | - | production | Phase A accepted: registered in SKILLS.md; frontmatter standardized to metadata.triggers format | pm |
| 2026-09-12 | production | production | Lifecycle record rewritten from a stale Phase-A stub to a full record matching the real skill (SKILL.md v1.4.1, owner pm, scope workspace); T-20260912-010 | pm |
| 2026-09-16 | production | production | SKILL.md v1.5.0: behavior sections refreshed to the underlying script's v1.28.0 semantics (stash -u rollback, pre-scan conflict semantics, honest exit codes, CONTEXT_COMMONIZATION, GOVERNANCE FILES SYNC, COMMON-CONTEXT markers, root-target guard); T-20260915-008 | pm |
| 2026-09-21 | production | production | SKILL.md v1.5.1: `--platform` values corrected to `claude\|antigravity\|codex\|all` (the documented `both` was renamed to `all` in script v1.34.0 and hard-errored), script pin refreshed v1.28.0 → v1.39.0 (2026-09-21 project review C-2/H-10) | pm |
| 2026-09-27 | production | production | SKILL.md v1.5.2: marker table gains the missing COMMON-CODEX row and the new COMMON-HERMES row (managed-block-merge v1.3.0, spec 2026-09-27-hermes-merge-marker-design) — found during the post-v0.7.0 fleet upgrade where HERMES.md could not reach existing L2 projects | pm |
| 2026-10-26 | production | production | SKILL.md v1.6.0 → v1.6.1: citation-only correction (SCRIPTS.md provenance citation; spec docs/designs/2026-10-26-project-review-remediation-design.md R4) — no behavior change | pm |
| 2026-11-26 | production | production | SKILL.md v1.6.3 → v1.6.4: dry-run review step gains the rule that a CONFLICT review or adjudication brief starts from the engine's full dry-run decision table, not a verifier's or a ticket's file list (T-20261125-004) — procedure only, no engine change | pm |
| 2026-11-27 | production | production | SKILL.md v1.6.4 → v1.6.5: body script version pin refreshed (`upgrade-project.ts` v1.115.0 → v1.125.0 — SCRIPTS.md registry advanced; skill-lifecycle-audit SVP pin-drift warning) + last_reviewed stamp refresh — citation only, no procedure change | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] SKILL.md exists at `skills/upgrade-project/SKILL.md` with valid frontmatter (name, description, version, owner, status, scope)
- [x] Registered in `docs/VERSION_MANIFEST.md` (v1.5.0, active, workspace scope)
- [x] Upgrade flow preserves project-owned files (licenses, project Codex configs, locally-modified copies conflict-warned)
- [x] Dry-run parity: `--dry-run` reports the same delivery plan as a real run without writing

## Notes
- The skill is workspace-scoped (`scope: workspace`): it operates on a project directory against the workspace template tree and is not propagated to L1/L2.
- This record previously held a Phase-A stub (dated 2026-07-31) that never advanced with the skill; rewritten 2026-09-12 per T-20260912-010. Historical version detail for the underlying script lives in `scripts/SCRIPTS.md` (upgrade-project.ts) — this record tracks the SKILL.md version (1.5.0), which is a separate version line.
