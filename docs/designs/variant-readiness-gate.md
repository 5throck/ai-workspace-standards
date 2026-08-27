# Variant Readiness Gate (VRG) — Design

**Status:** Accepted
**Date:** 2026-08-27
**Owner:** Platform Team
**Supersedes:** ad-hoc "validate-templates.ts catches omissions" assumption (proven insufficient — see Motivation)

## 1. Motivation

`templates/co-safety` was promoted/reflected as a variant while it was **not properly variant-ized**:

- `variant.json` `agents[].file` paths were **flat** (`agents/msds-agent.md`) even though the
  agent files live **nested** (`agents/domains/functional/msds/msds-agent.md`, `agents/_core/...`,
  `agents/_shared/...`). The manifest therefore referenced files that do not resolve.
- `PROMOTION_CHECKLIST.md` (referenced by `variant.json.promotionChecklist`) was missing.
- `scripts/project-to-variant.ts` ran `validate-templates.ts` but only *warned* on issues and
  never blocked, so an incomplete variant was accepted.

The root cause: there was **no single, enforced gate** that a variant must pass before it is
considered usable. Structural validation (`validate-templates.ts`) validates *all* templates but
does not assert that a *specific* variant is internally consistent and ready for use.

## 2. Goal

A variant MUST pass the **Variant Readiness Gate** before it is considered a valid, usable variant.
The gate is enforced from three lifecycle perspectives so an improperly variant-ized template can
never be reflected, scaffolded, or upgraded:

| Perspective | Script | Enforcement |
|-------------|--------|-------------|
| **variant-ization** | `scripts/project-to-variant.ts` (lightweight) · `scripts/l3-to-variant-pipeline.ts` (full) | **Blocked** on failure (unless `--force`) |
| **new-project** | `scripts/new-project.ts` | **Blocked pre-flight** — a project may only be scaffolded from a READY variant |
| **upgrade-project** | `scripts/upgrade-project.ts` | **Blocked pre-flight** — a project may only be upgraded against a READY template variant |

A fourth, continuous enforcement point backs these up: `scripts/validate-templates.ts` runs the
gate for **every** variant (check `VRG-01`) on each validation run. This catches a non-READY
variant even when it was edited directly (not regenerated), so the fix cannot silently regress.

## 3. Canonical implementation

`scripts/validate-variant-readiness.ts`

```
bun scripts/validate-variant-readiness.ts --variant <name>
bun scripts/validate-variant-readiness.ts --dir templates/<name> [--json]
```

Exit code: `0` = READY (no blocking errors), `1` = NOT READY (one or more blocking errors).

### Blocking checks (ERROR → exit 1)

| # | Check | Rationale |
|---|-------|-----------|
| A1 | `variant.json` exists | No manifest → not a variant |
| A2 | Required fields present (`name`, `description`, `status`) | Minimum schema |
| A3 | `status` ∈ `stable\|planned\|deprecated\|draft\|beta` | Valid lifecycle value |
| A4 | Every `agents[].file` resolves to an existing file | Manifest must point at real, on-disk agents (including nested paths) |
| A5 | Every `skills[].file` resolves to an existing `SKILL.md` | Manifest must point at real skills |
| B1 | `PROMOTION_CHECKLIST.md` exists | Promotion contract must ship with the variant |
| B2 | `README.md` exists | Minimum documentation |
| B3 | `AGENTS.md` exists, non-stub, has `VARIANT-AGENTS-START` marker | Variant roster must be generated, not a stub |
| C1 | If `docs/countries/` exists → `country_config` present and `supported` covers shipped profiles | Country profiles must be declared |

### Advisory checks (WARN → non-blocking)

| # | Check | Rationale |
|---|-------|-----------|
| A6 | `variant.json.promotionChecklist` (if set) references an existing file | Keep reference consistent |
| C2 | `country_config.profiles_dir` / `default` set | Completeness |
| D1 | Orphan agent files on disk not declared in `variant.json` | Manifest/disk drift |

## 4. Generator contract (so the gate passes on creation)

To avoid generating variants that immediately fail the gate, the variant-ization generators MUST:

1. **Scan agents recursively** and emit the **real on-disk relative path** (e.g.
   `agents/domains/functional/msds/msds-agent.md`), not a flat `agents/<name>.md`.
   - `scripts/project-to-variant.ts` — fixed at the `agents` manifest build (recursive `walk`).
2. **Normalize skills** so each entry has a resolvable `file` (`skills/<name>/SKILL.md` or the
   platform-specific location where the SKILL.md actually lives).
3. **Emit `promotionChecklist: "PROMOTION_CHECKLIST.md"`** in `variant.json` and **create a starter
   `PROMOTION_CHECKLIST.md`** when generating a new variant.

These are implemented; the gate then verifies the output independently.

## 5. History / rollout

- 2026-08-27: Discovered co-safety (and all 11 other `co-*` variants) carried flat agent paths and
  missing `PROMOTION_CHECKLIST.md`. All 12 variants were batch-corrected (nested paths + generated
  checklists) and now pass the gate. The gate was wired into all three lifecycle scripts as a
  blocking check.

## 6. References

- `scripts/validate-variant-readiness.ts` (canonical implementation)
- `docs/governance/variant-lifecycle.md` (lifecycle stages; VRG is a beta→stable prerequisite)
- `docs/creating-a-variant.md` (authoring guide; Step 6 includes the gate)
- `docs/lifecycle/skills/project-to-variant.md` (lightweight pipeline; gate is enforced)
- `scripts/test-variant-readiness.ts` — VRG regression test: a well-formed variant exits 0 (READY);
  a variant missing `PROMOTION_CHECKLIST.md` or with an unresolved `agents[].file` exits 1 (NOT READY)
- `scripts/audit.ts` (v2.25.0), `scripts/validate-md-language.ts` (v1.8.0),
  `scripts/validate-templates.ts` (v1.15.0) — variant-scanning checks skip untracked
  `templates/co-*` directories so WIP template scaffolds on disk do not block commits;
  the tracked variant set is computed once via `git ls-files` at module load
