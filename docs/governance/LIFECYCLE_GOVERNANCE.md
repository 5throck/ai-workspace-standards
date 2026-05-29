# Lifecycle Governance

> **Doc intent:** Human-readable governance specification for the 5-domain × 3-layer lifecycle model.
> Machine-readable policy is in [`lifecycle-governance.json`](lifecycle-governance.json).
> Last Updated: 2026-05-30

---

## Overview

This workspace enforces lifecycle governance across **5 domains** and **3 layers**. Every artifact — agents, skills, scripts, variant templates, and READMEs — has a defined lifecycle state, a validating tool, and an orchestrator that enforces it at the appropriate layer.

**5 Lifecycle Domains:**
1. **Variant** — template readiness and promotion state
2. **Agent** — agent role status (`draft`, `active`, `deprecated`, `archived`)
3. **Skill** — skill capability status (same states as Agent)
4. **Script** — script registry entry and executable verification
5. **README** — structural completeness, i18n consistency, and freshness

**3 Layers:**
- **Layer 0 — Workspace Root** (`C:/git/`): the workspace itself, orchestrated by `audit.sh`
- **Layer 1 — Templates** (`C:/git/templates/`): split into `common/` (shared base) and `co-*/` (variant instances)
- **Layer 2 — L2 Projects**: scaffolded from L1 via `new-project.sh`, each carrying a project copy of `audit.sh`

---

## Coverage Matrix

| Domain | Workspace Root (L0) | templates/common (L1a) | co-* Variants (L1b) | L2 Projects |
|--------|:-------------------:|:----------------------:|:-------------------:|:-----------:|
| **Variant** | N/A | ❌ gap | ⚠️ partial | N/A |
| **Agent** | ✅ active | N/A | ❌ gap | ✅ active |
| **Skill** | ✅ active | N/A | ❌ gap | ✅ active |
| **Script** | ❌ gap | ⚠️ partial | ❌ gap | ❌ gap |
| **README** | ❌ gap | ⚠️ partial | ❌ gap | ❌ gap |

**Legend:**
- ✅ `active` — check is wired into the orchestrator and passing
- ⚠️ `partial` — check exists but coverage is incomplete (see domain sections)
- ❌ `gap` — check is not wired in; audit.sh or validate-templates.ts does not call it
- N/A — domain is not applicable at this layer

**Target state (all cells):** ✅ active or N/A

---

## Per-Domain Specifications

### 1. Variant Domain

**What it tracks:** Whether a template variant (`templates/co-*/`) has a valid `variant.json` with required fields (`name`, `description`, `status`, `version`, `lifecycle.statusSince`, `lifecycle.lastTransition`) and whether its lifecycle state is consistent with its content.

**Lifecycle states:**
- `draft` — under construction, not ready for project creation
- `beta` — functional but pending stabilization
- `active` — stable, suitable for L2 project creation
- `deprecated` — no new projects; existing projects may continue
- `archived` — frozen, no new activity

**Validating tool:** `scripts/validate-templates.ts`

**Applicable layers:** L1b (`co-*` variants). L0 and L2 are not variant containers. `templates/common/` itself has no `variant.json` — its lifecycle is tracked via `lifecycle-governance.json` (this file's companion).

**Current gaps:**
- `validate-templates.ts` checks `variant.json` field presence but does not enforce state transition rules (e.g., `draft` → `beta` requires agent/skill directories).
- `templates/common/` has no version or status tracking.

---

### 2. Agent Domain

**What it tracks:** Each agent file (`agents/<name>.md`) must declare a `status:` field in its YAML frontmatter. The audit checks that all agents have a valid status, that deprecated agents are not referenced in `AGENTS.md` as active, and that `sync-agent-status.ts` can reconcile the roster.

**Lifecycle states:**
- `draft` — role defined but not yet deployed
- `active` — in regular use
- `deprecated` — superseded; kept for reference
- `archived` — removed from active roster

**Validating tool:** `scripts/agent-lifecycle-audit.ts`
**Sync tool:** `scripts/sync-agent-status.ts`

**Applicable layers:** L0 (workspace root agents), L1b (variant-scoped agents), L2 (project agents). `templates/common/` does not host agents directly.

**Current gaps:**
- L1b variants are not audited by `agent-lifecycle-audit.ts` during `validate-templates.ts` runs.

---

### 3. Skill Domain

**What it tracks:** Each skill file (`skills/<name>/SKILL.md` or equivalent) must declare a `status:` field in its frontmatter. The audit checks that all skill directories have a valid SKILL.md, that deprecated skills are not actively invoked, and that `sync-skill-status.ts` can reconcile the registry.

**Lifecycle states:** Same as Agent (`draft`, `active`, `deprecated`, `archived`)

**Validating tool:** `scripts/skill-lifecycle-audit.ts`
**Sync tool:** `scripts/sync-skill-status.ts`

**Applicable layers:** L0, L1b, L2. `templates/common/` does not host skills directly.

**Current gaps:**
- L1b variants are not audited by `skill-lifecycle-audit.ts` during `validate-templates.ts` runs.

---

### 4. Script Domain

**What it tracks:** Every script in `scripts/` must have a corresponding entry in `scripts/SCRIPTS.md`. The verification tool checks that: all registered scripts exist as files, all existing scripts are registered, and no registered script is marked active but missing.
Additionally, script creation must follow the **Hybrid Scripting Architecture**:
- **Tier 1**: Bootstrap & Native Scripts (Native Shell, `.sh`/`.ps1`) for environment setup.
- **Tier 2**: Ops & Automation Scripts (Bun/TS + `package.json`) for routine pipeline tasks.

**Lifecycle states:**
- `active` — registered, file present, callable
- `deprecated` — registered but flagged for removal
- `missing` — registered but file absent (error state)
- `unregistered` — file present but not in SCRIPTS.md (warning state)

**Validating tool:** `scripts/verify-scripts.ts`

**Applicable layers:** L0 (primary), L1b (drift detection between L0 and variant script copies), L2 (optional, non-mandatory).

**Current gaps:**
- `audit.sh` at L0 does not call `verify-scripts.ts`. This is the most critical gap: new scripts can be added without registry entries going undetected until manual audit.
- L1b `validate-templates.ts` does not check variant script registries.

---

### 5. README Domain

**What it tracks:** Each `README.md` must have required sections (Overview, Usage, Prerequisites), a paired `README_ko.md` for i18n consistency, and a `Last Updated` date that is not stale (threshold: 90 days).

**Lifecycle states:**
- `pass` — all checks green
- `stale` — Last Updated date older than threshold
- `missing-sections` — required sections absent
- `i18n-drift` — `README.md` and `README_ko.md` section count divergence exceeds tolerance
- `missing-pair` — one language file exists without the other

**Validating tool:** `scripts/readme-lifecycle-audit.ts`

**Applicable layers:** L0, L1a (partial), L1b, L2.

**Current gaps:**
- `audit.sh` at L0 does not call `readme-lifecycle-audit.ts`.
- `templates/co-*/README.md` files are explicitly excluded from the current audit scope in `readme-lifecycle-audit.ts`.
- L2 projects do not have `readme-lifecycle-audit.ts` wired into their local `audit.sh` copies.

---

## Orchestrator Mapping

| Orchestrator | Layer | Domains Currently Enforced | Domains Missing |
|---|---|---|---|
| `scripts/audit.sh` | L0 Workspace Root | agent, skill, memory | script, readme |
| `scripts/validate-templates.ts` | L1b co-* Variants | variant (partial) | agent, skill, script, readme |
| `scripts/audit.sh` (project copy) | L2 Projects | agent, skill | script (optional), readme (optional) |
| *(none)* | L1a templates/common | *(none)* | variant, script, readme |

### Remediation Priority

1. **High — add `verify-scripts.ts` to `audit.sh` (L0):** Prevents undocumented scripts from accumulating. One-line addition to `audit.sh`.
2. **High — remove README exclusion in `readme-lifecycle-audit.ts` for L1b:** Template READMEs are the most widely copied — staleness there propagates to all derived projects.
3. **Medium — wire agent + skill audits into `validate-templates.ts`:** Run per-variant subdirectory scans before approving a variant as `active`.
4. **Medium — add script registry to `validate-templates.ts`:** Variants with scripts not listed in any registry are a drift source.
5. **Low — add `common.lifecycle.json` to `templates/common/`:** Gives the shared base layer a version and status anchor.

---

## New Variant Addition Checklist

Use this checklist when creating a new `templates/co-<name>/` variant. Steps are ordered; validation is the final gate.

- [ ] Create the variant directory: `templates/co-<name>/`
- [ ] Create `variant.json` with required fields:
  - `name`, `description`, `status` (start with `"draft"`), `version` (start with `"0.1.0"`)
  - `lifecycle.statusSince` (today's date), `lifecycle.lastTransition` (today's date)
- [ ] Create `agents/` directory with at least `pm.md` (status: `draft`)
- [ ] Create `AGENTS.md` roster listing all agent files
- [ ] Create `skills/` directory with at least `agent-lifecycle-manager/`
- [ ] Create `.claude/commands/meeting.md` (copy from `templates/common/.claude/commands/meeting.md`)
- [ ] Create `.gemini/commands/meeting.md` (copy from `templates/common/.gemini/commands/meeting.md`)
- [ ] Create `docs/<variant>.context.md` with architecture overview
- [ ] Create `README.md` (English) with sections: Overview, Usage, Prerequisites, Last Updated
- [ ] Create `README_ko.md` (Korean) with matching section structure
- [ ] Add variant entry to workspace `templates/common/VERSION_REGISTRY.json` if applicable
- [ ] Run `bun scripts/validate-templates.ts --variant co-<name>` — all mandatory checks must pass
- [ ] Promote `variant.json` `status` from `"draft"` to `"beta"` once validation passes
- [ ] Submit PR; `validate-templates.ts` runs in CI as a required check

> See `lifecycle-governance.json` → `variantValidationPolicy` for which checks are mandatory vs. warning-only before `new-project.sh` allows project creation from this variant.

---

## References

| Resource | Purpose |
|---|---|
| [`lifecycle-governance.json`](lifecycle-governance.json) | Machine-readable policy (layer/domain matrix, currentStatus, mandatoryBeforeProjectCreation) |
| [`VARIANT_LIFECYCLE.md`](VARIANT_LIFECYCLE.md) | Variant promotion rules and state transition diagram |
| [`VARIANT_LIFECYCLE_INTEGRATION.md`](VARIANT_LIFECYCLE_INTEGRATION.md) | Integration guide for embedding lifecycle checks in CI/CD |
| [`VERSION_REGISTRY.json`](VERSION_REGISTRY.json) | Canonical version registry for all tracked variants |
| [`VERSION_REGISTRY_SCHEMA.md`](VERSION_REGISTRY_SCHEMA.md) | Schema documentation for VERSION_REGISTRY.json |
| `../../scripts/audit.sh` | L0 orchestrator — workspace-level audit pipeline |
| `../../scripts/validate-templates.ts` | L1b orchestrator — template variant validation |
| `../../scripts/agent-lifecycle-audit.ts` | Agent domain validator |
| `../../scripts/skill-lifecycle-audit.ts` | Skill domain validator |
| `../../scripts/verify-scripts.ts` | Script domain validator |
| `../../scripts/readme-lifecycle-audit.ts` | README domain validator |
| `../../CONSTITUTION.md` | Workspace design philosophy and shared standards |
| `../../AGENTS.md` | Canonical agent roster for L0 |
