---
schemaVersion: 1.0.0
spec-id: agent-tier-drift-check
---

# Agent Tier Drift Check (Check F) Design

## 1. Overview

Adds a computed drift check for agent tier metadata to
`scripts/lifecycle-sync-audit.ts` (new **Check F**), making
`docs/workspace-schema.json` → `agent_tiers` the single source of truth
(SSOT) for agent tiers. The check compares every tier declaration surface
against the SSOT and reports errors, so a tier change can no longer land
with only some of its copies updated.

## 2. Background

During the 2026-09-15 PM tier change (high → medium), the tier value was
declared in six places and nothing compared them:

| # | Surface | Notes |
|---|---------|-------|
| 1 | `agents/*.md` frontmatter `tier:` blocks | 5 platforms (claude, gemini, antigravity, gemini-cli, codex) |
| 2 | `AGENTS.md` §1 Agent Roster, Tier column | docs-writer row uses `**Medium**` (bold) |
| 3 | `AGENTS.md` §4.1 Subagent Roster, Tier column | same 8 agents |
| 4 | `docs/workspace-schema.json` `agent_tiers` | only machine-consumed copy (`scripts/hooks/agent-model-gate.ts` v1.1.0 reads it at runtime) |
| 5 | `docs/lifecycle/agents/<name>.md` records, `**Tier**:` field | live drift found: pm record still said `high` after the change |
| 6 | `templates/common/agents/*.md` (L1) tier blocks | enforced by nothing; `scripts/new-project.ts` stub-merge lets L1 frontmatter win, so an L0/L1 divergence silently changes resolved projects |

Existing validation gaps: `validate-templates.ts` WS-01 Check 4 compares
frontmatter against `agent_tiers` but only warns for complex (per-platform)
tier blocks — all 8 L0 agents use them, so real drift was warning-only.
`audit.ts` `checkPmConsistency` verifies field presence, not tier values.
`validate-pm-extends.ts` parity checks are existence-only.

## 3. Decision

**SSOT**: `docs/workspace-schema.json` → `agent_tiers` (one tier value per
agent). Rationale: it is the only machine-readable copy, it is already the
runtime input of the tier gate (agent-model-gate.ts v1.1.0), and WS-01
already treats it as the reference. Frontmatter per-platform values must be
uniform and equal the SSOT value.

**Detection, not auto-fix (v1)**: Check F reports `error`-level
`SyncIssue`s with `Fix:` hints. Auto-rewriting prose surfaces (AGENTS.md
roster rows, lifecycle records) belongs to docs-writer/lifecycle-manager
workflows; non-goals below.

## 4. Check F specification

Implemented as `runCheckF(): SyncIssue[]` in
`scripts/lifecycle-sync-audit.ts`, following the Check E shape
(error/warning issues, `IS_WORKSPACE_ROOT` guard, surfaced to `audit.ts`
through the existing lifecycle-sync-audit delegation). Checks, all
error-level:

- **(a) L0 frontmatter ↔ SSOT** — for each agent in `agent_tiers`:
  `agents/<name>.md` frontmatter tier block declares all 5 platforms, all
  values are uniform, and the value equals the SSOT tier.
- **(b) L1 tier ↔ SSOT** — `templates/common/agents/pm.md` tier (uniform
  across platforms) equals the SSOT `pm` value (merge-winner, so this is a
  silent-behavior surface). `templates/common/agents/i18n-specialist.md`
  (L1-only, not in `agent_tiers`): declares all 5 platforms, values uniform
  and in the valid enum.
- **(c) AGENTS.md rosters ↔ SSOT** — for each agent in `agent_tiers`, the
  §1 Agent Roster row and §4.1 Subagent Roster row containing
  `agents/<name>.md` carry a Tier cell (bold markers stripped) equal to the
  SSOT tier (capitalized as displayed).
- **(d) Lifecycle record ↔ SSOT** — `docs/lifecycle/agents/<name>.md`
  contains a `**Tier**: <value>` field equal to the SSOT tier.

Reusable infrastructure: `parseFrontmatter` from
`scripts/validators/schema-validator.ts`; issue vocabulary and CLI
conventions of lifecycle-sync-audit.ts (Check E as the structural
template); `checksRun` count and header banner updated accordingly.
Script version 1.9.0 → 1.10.0 with `scripts/SCRIPTS.md` registry sync
(Check A).

## 5. Remediation (one-time, shipped with the check)

- `docs/lifecycle/agents/pm.md`: `**Tier**: high` → `medium`; stale
  acceptance-criteria prose line updated to the medium-tier model set.
  All other agent records swept via the new check.
- `AGENTS.md` docs-writer roster cells `**Medium**` → `Medium`
  (§1 and §4.1) — removes the parser hazard.
- `skills/agent-lifecycle-manager/SKILL.md`: required-frontmatter template
  declared only 3 platforms (gemini, codex missing) — corrected to 5;
  Step 5 gains the Check F command and an ordered tier-change procedure
  (schema first, then frontmatter, roster rows, lifecycle record; check
  must pass).
- `agents/lifecycle-manager.md`: Drift Reporting duty and Required Tools
  reference Check F.
- `docs/workspace-schema.json` `_notes.variant_agents`: removed the stale
  claim that variants declare `agent_tiers` in `variant.json` (no
  variant.json has that key; variant agent tiers live in variant agent
  frontmatter only).

## 6. Requirements / Acceptance

1. With all surfaces in sync, `bun scripts/lifecycle-sync-audit.ts` passes
   with 8 checks and zero errors.
2. Changing one surface (e.g. schema `pm` → `high`) produces
   error-level Check F findings naming each drifted surface (frontmatter,
   L1, rosters, lifecycle record) and their expected values; reverting
   clears the findings.
3. `bun scripts/audit.ts` passes end-to-end, including Check A version
   parity for the modified script.

## 7. Non-goals

- Auto-fix (`--fix`) for Check F findings — future work if drift
  frequency justifies it; detection blocks drift from landing via the
  audit gate.
- Extending the SSOT to variant-specific agent tiers (they live in variant
  agent frontmatter; out of scope).
- Promoting WS-01 Check 4 complex-block warnings to errors (Check F
  covers the same comparison at error level at audit time).

## 8. Accessibility & Preview

Backend governance tooling with no user-facing UI. ADR-0065 accessibility
requirements and ADR-0070 preview verification are not applicable.
