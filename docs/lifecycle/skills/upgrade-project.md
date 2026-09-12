# Upgrade-Project Skill — Lifecycle Record

## Metadata
- **Skill**: upgrade-project
- **Status**: active
- **Version**: 1.4.1
- **Owner**: pm
- **Created**: 2026-07-31
- **Last Updated**: 2026-09-12

## Description
Upgrades an existing L2/L3 project to the current template version: syncs template improvements into a variant-based project's scripts, agents, skills, docs, and commands through the policy-driven TEMPLATE TREE SYNC engine (`scripts/upgrade-project.ts`, backed by `lib/upgrade-policy.ts`), with country-aware .env.sample delivery and conflict warnings for locally-modified files.

## Dependencies
- `scripts/upgrade-project.ts` — main implementation (v1.24.0)
- `scripts/lib/upgrade-policy.ts` — delivery-policy engine (ADD_IF_MISSING / PROCEDURES / PRESERVE semantics)
- `scripts/lib/env-sample.ts` — country-aware .env.sample merge engine
- `scripts/resolve-variants.ts` — variant.json reconciliation support

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-31 | - | production | Phase A accepted: registered in SKILLS.md; frontmatter standardized to metadata.triggers format | pm |
| 2026-09-12 | production | production | Lifecycle record rewritten from a stale Phase-A stub to a full record matching the real skill (SKILL.md v1.4.1, owner pm, scope workspace); T-20260912-010 | pm |

## Acceptance Criteria

### Production Phase

- [x] SKILL.md exists at `skills/upgrade-project/SKILL.md` with valid frontmatter (name, description, version, owner, status, scope)
- [x] Registered in `docs/VERSION_MANIFEST.md` (v1.4.1, active, workspace scope)
- [x] Upgrade flow preserves project-owned files (licenses, project Codex configs, locally-modified copies conflict-warned)
- [x] Dry-run parity: `--dry-run` reports the same delivery plan as a real run without writing

## Notes
- The skill is workspace-scoped (`scope: workspace`): it operates on a project directory against the workspace template tree and is not propagated to L1/L2.
- This record previously held a Phase-A stub (dated 2026-07-31) that never advanced with the skill; rewritten 2026-09-12 per T-20260912-010. Historical version detail for the underlying script lives in `scripts/SCRIPTS.md` (upgrade-project.ts) — this record tracks the SKILL.md version (1.4.1), which is a separate version line.
