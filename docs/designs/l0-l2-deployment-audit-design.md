# Design: L0-L2 Deployment Audit

**Date**: 2026-07-08
**Status**: Proposed
**Spec ID**: 2026-07-08-l0-l2-deployment-audit
**Scope**: workspace root (L0), templates/common/ (L1), templates/co-*/ (L2), scripts/, docs/templates/*.json, docs/adr/

**Review History**:
| Round | Date | Reviewer | Result |
|-------|------|----------|--------|
| 1 | 2026-07-08 | PM | Feedback — need PASS criteria, outputs, evidence, scope, summary |
| 2 | 2026-07-08 | PM | Feedback — capability-based criteria, single output, contract-based D5, known issues externalization, Finding→Rec traceability, skip policy, reproducibility, coverage metrics |
| 3 | 2026-07-08 | PM | Feedback — reduce capability coupling, detection rules, Parse→Resolve→Validate for ADR, workspace fingerprint, illustrative output, verification workflow |
| 4 | 2026-07-08 | PM | Approved with minor suggestions — schema_version, detection result status, CI exit code policy |

---

## Table of Contents

1. [Background](#1-background)
2. [Scope](#2-scope)
3. [Architecture Overview](#3-architecture-overview)
4. [Audit Domains](#4-audit-domains)
5. [Audit Methodology](#5-audit-methodology)
6. [Evidence Collection](#6-evidence-collection)
7. [Findings & Recommendations](#7-findings--recommendations)
8. [Severity Classification](#8-severity-classification)
9. [Audit Status Definitions](#9-audit-status-definitions)
10. [Recommendations](#10-recommendations)
11. [Verification Workflow](#11-verification-workflow)
12. [Audit Checklist](#12-audit-checklist)
13. [Audit Summary (Illustrative Output)](#13-audit-summary-illustrative-output)
- [Appendix A: Revision History](#appendix-a-revision-history)

---

## 1. Background

The workspace employs a **three-layer template inheritance architecture** for managing AI agent ecosystem variants:

```
L0 (Workspace Root)          ← Single Source of Truth
  └── L1 (templates/common/) ← Shared base layer (published from L0)
       └── L2 (templates/co-*/) ← 7 variant templates (scaffolded from L1)
```

**Seven L2 variants** exist in the workspace:

| Variant | Directory | Status |
|---------|-----------|--------|
| co-consult | `templates/co-consult/` | stable |
| co-deck | `templates/co-deck/` | beta |
| co-design | `templates/co-design/` | stable |
| co-develop | `templates/co-develop/` | stable |
| co-game | `templates/co-game/` | beta |
| co-security | `templates/co-security/` | stable |
| co-work | `templates/co-work/` | stable |

**Audit Rationale**:

- The **variant-registry** centralized infrastructure has been recently proposed and partially implemented, introducing new registry, plugin, and validator layers that need verification.
- **co-game** and **co-deck** have been added as new beta variants, requiring validation of their integration into the deployment chain.
- Multiple known issues exist across governance JSON files, scripts, and ADR compliance — a systematic audit is needed to assess current state.

---

## 2. Scope

### 2.1 In Scope

| Area | Path | Description |
|------|------|-------------|
| L0 Governance | workspace root | `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` |
| L0 Scripts | `scripts/` | Deployment, sync, audit, pipeline scripts |
| L1 Template | `templates/common/` | Shared base layer structure and content |
| L2 Variants | `templates/co-*/` | All 7 variant templates |
| Registry Infrastructure | `scripts/helpers/registries/` | Variant type, capability, promotion, validation registries |
| Plugin Infrastructure | `scripts/helpers/plugins/` | Plugin interface and implementations |
| Validator Infrastructure | `scripts/validators/` | 7 domain validators and orchestration |
| Governance JSON | `docs/templates/*.json` | `common-contract.json`, `variant-contract.json`, `VERSION_REGISTRY.json`, `common.lifecycle.json`, `propagation-map.json` |
| ADR References | `docs/adr/0031-*.md`, `0039-*.md`, `0040-*.md` | Fork Model, Hierarchy, Deployment Strategy |

### 2.2 Out of Scope

| Area | Path | Reason |
|------|------|--------|
| Project Instances | `Projects/` | Instantiated projects, not templates |
| Session Logs | `memory/` | Transient session artifacts |
| Skill Content | `skills/` bodies | Skill structure may be in-scope; content is out |
| Generated Artifacts | `generated/` | Runtime pipeline output, scaffold temp files |
| Release Artifacts | `official/` | Promoted release bundles |
| IDE Settings | `.vscode/`, `.idea/` | Editor configuration |
| CI/CD Pipeline | `.github/`, CI configs | Pipeline configuration itself |

---

## 3. Architecture Overview

### 3.1 Deployment Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                     L0 (Workspace Root)                        │
│  CONSTITUTION.md, CLAUDE.md, GEMINI.md, AGENTS.md               │
│  scripts/dev-sync.ts, scripts/propagate-to-templates.ts        │
│  scripts/audit.ts, scripts/l2-to-variant-pipeline.ts           │
└──────────────────────┬──────────────────────────────────────────┘
                       │ L0→L1 (automated, continuous)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     L1 (templates/common/)                      │
│  CLAUDE.md, GEMINI.md, AGENTS.md (L0-filtered copies)          │
│  agents/pm.md (pure-extends), platform skills, commands         │
│  docs/context.md, common-contract.json                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ L1→L2 (scaffold-time delivery only)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               L2 (templates/co-consult/ ... co-game/)           │
│  variant.json, agents/pm.md (variant overrides)                │
│  Variant-specific agents, skills, docs                          │
│  Platform parity files (.claude/, .gemini/)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Domain Dependency Graph

```
Domain 1 (Script Chain)
    │
    ▼
Domain 2 (Governance JSON)          Domain 3 (ADR Compliance)
    │                                    │ (parallel — independent)
    ▼                                    │
Domain 4 (Registry Architecture)        │
    │                                    │
    ▼                                    ▼
Domain 5 (Variant Integrity) ◄──────────┘
    │
    ▼
Domain 6 (Known Issues Baseline)
```

### 3.3 Skip Policy

| Precedent State | Downstream Domain | Action |
|------------------|-------------------|--------|
| Domain 2 FAIL | Domain 4 | `SKIP (dependency failed)` |
| Domain 2 FAIL | Domain 5 | `SKIP (dependency failed)` |
| Domain 4 FAIL | Domain 5 | Registry-related items `SKIP`, structural items execute normally |
| Domain 3 | — | **Independent** — always executes regardless of Domain 2 |

**Execution Order**: Domain 1 → Domain 2 → (Domain 3 in parallel) → Domain 4 → Domain 5 → Domain 6

---

## 4. Audit Domains

> **PASS Criteria Principle**: All PASS criteria are **capability-based** — they describe *what capability must exist*, not *how it is implemented*. Implementation examples are provided with an `Example:` prefix for reference only.

### 4.1 Domain 1: Deployment Script Chain

**Objectives**: Verify the deployment pipeline's functional integrity — all critical deployment, sync, and audit capabilities are present and operational.

**PASS Criteria**:

| # | Capability | Example Implementation |
|---|-----------|----------------------|
| 1 | Workspace-to-template deployment synchronization capability exists | `scripts/propagate-to-templates.ts` accepts `--apply`, `--check-drift`, `--governance-l1`, `--docs`, `--prune` |
| 2 | Full audit orchestration capability exists (runs audit gate before sync) | `scripts/dev-sync.ts` invokes `audit.ts` and blocks on failure |
| 3 | L2 scaffold creation capability exists | `scripts/create-l2-scaffold.ts` accepts `--variant`, copies L1 overlay, generates stubs |
| 4 | L2-to-variant promotion pipeline capability exists | `scripts/l2-to-variant-pipeline.ts` executes phases 1–7 |
| 5 | Opt-in L1-to-L2 synchronization capability exists | `scripts/sync-skills-to-l2.ts` accepts `--variant`, `--skill`, `--apply`, `--check-drift` |

**Report Section**: `"deployment_script_chain"`

### 4.2 Domain 2: Governance JSON Consistency

**Objectives**: Verify cross-referential integrity between governance JSON files and actual filesystem state.

**PASS Criteria**:

| # | Capability | Validation Method |
|---|-----------|-----------------|
| 1 | `VERSION_REGISTRY.json` uses nested object format keyed by variant name (not flat array) | Parse JSON → check `typeof variants` |
| 2 | `VERSION_REGISTRY.json` contains entries for all variants resolved from `templates/co-*/` directory listing | List `templates/co-*/` → compare with `Object.keys(variants)` |
| 3 | `common.lifecycle.json` `propagatedTo` matches all variants in `templates/` | List `templates/` → compare with `propagatedTo` array |
| 4 | `propagation-map.json` `governance-agents.target_variants` matches all variants | List `templates/` → compare with `target_variants` array |
| 5 | Files declared in `common-contract.json` exist in `templates/common/` | Parse contract → `fs.existsSync()` per declared path |
| 6 | Files required by `variant-contract.json` exist in all L2 variants | Parse contract → `fs.existsSync()` per variant per required file |

**Report Section**: `"governance_consistency"`

### 4.3 Domain 3: ADR Compliance

**Objectives**: Verify compliance with three critical ADRs governing the L0→L1→L2 architecture.

**Validation Method**: **Parse → Resolve → Validate** (grep-only is insufficient for structural checks).

1. **Parse**: Extract structured data (YAML frontmatter, JSON content, marker patterns) from target files.
2. **Resolve**: Verify referenced paths exist and dependency chains are intact.
3. **Validate**: Compare resolved state against ADR rules.

**PASS Criteria**:

| # | ADR Rule | Validation |
|---|----------|-----------|
| 1 | ADR-0031 Principle 1: All L2 variants are scaffold-time forks with no auto-propagation L1→L2 | Verify `sync-skills-to-l2.ts` requires explicit `--variant` + `--skill` flags; no auto-propagation script exists |
| 2 | ADR-0039: All L2 `agents/pm.md` extends chain resolves to a valid L1 file | Parse `extends:` YAML → resolve path relative to variant dir → verify `templates/common/agents/pm.md` exists |
| 3 | ADR-0039: All L2 `agents/pm.md` contains `VARIANT-SECTION` / `END VARIANT-SECTION` markers | Parse YAML body → scan for marker pattern |
| 4 | ADR-0040: Zero `CONSTITUTION.md` references in `templates/` directory (excluding ADR documentation files) | Grep `CONSTITUTION.md` in `templates/` → filter ADR doc references → count actionable hits |
| 5 | ADR-0040: Governance deployment mechanism exists for CLAUDE.md/GEMINI.md to L1 | Verify `propagate-to-templates.ts --governance-l1` or equivalent capability |

**Report Section**: `"adr_compliance"`

### 4.4 Domain 4: Variant Registry Architecture

**Objectives**: Verify the 5-layer variant registry infrastructure (proposed in `variant-registry-architecture-design.md`) has been correctly implemented.

#### 4.4.1 Registry Architecture (Layer 1 — SSOT Data)

| # | Capability | Example Location |
|---|-----------|-----------------|
| 1 | Variant type enumeration capability exists (single SSOT for all variant types) | `scripts/helpers/registries/variant-type-registry.ts` |
| 2 | Capability definition capability exists (registry of all known capabilities) | `scripts/helpers/registries/capability-registry.ts` |
| 3 | Promotion policy capability exists (per-type promotion rules and thresholds) | `scripts/helpers/registries/promotion-policy.ts` |
| 4 | Validation policy capability exists (per-type required capabilities and agents) | `scripts/helpers/registries/validation-policy.ts` |
| 5 | Cross-registry integrity validation capability exists | `scripts/helpers/registries/index.ts` — `validateRegistryIntegrity()` |

#### 4.4.2 Plugin Architecture (Layer 2 — Procedural Behavior)

| # | Capability | Example Location |
|---|-----------|-----------------|
| 1 | Plugin interface definition with lifecycle hooks for variant-type-specific behavior exists | `scripts/helpers/plugins/variant-plugin.ts` — `VariantPlugin` interface |
| 2 | At least 1 plugin implementation exists | `scripts/helpers/plugins/game-plugin.ts` |
| 3 | Plugin registration capability exists | `scripts/helpers/plugins/index.ts` — `registerPlugin()` |

#### 4.4.3 Validator Architecture (Layer 3 — Validation Rules)

| # | Capability | Example Location |
|---|-----------|-----------------|
| 1 | 7 distinct validator modules exist with declared dependency ordering | `variant-json-validator.ts` (root), `extends-validator-wrapper.ts`, `capability-validator.ts`, `orphan-reference-validator.ts`, `duplicate-validator.ts`, `platform-parity-validator.ts`, `golden-reference-validator.ts` |
| 2 | Validator interface definition with `prerequisites` field exists | `scripts/validators/types.ts` — `ValidatorDefinition` |
| 3 | Validator orchestration with prerequisite-skip logic exists | `scripts/validators/index.ts` — `runAllValidators()` |

#### 4.4.4 Workspace Integration (Layer 4 — Transactional)

| # | Capability | Example Location |
|---|-----------|-----------------|
| 1 | Transactional write capability with preflight validation exists | `scripts/helpers/workspace-integration.ts` — preflight before writes |
| 2 | Rollback capability on write failure exists | Snapshot-based or diff-based restoration mechanism |

#### 4.4.5 Pipeline Integration (Layer 5 — Pipeline)

| # | Capability | Example Location |
|---|-----------|-----------------|
| 1 | Pipeline workspace-write phase is separated from artifact generation (Phase 7 not auto-executed) | `scripts/l2-to-variant-pipeline.ts` — Phase 7 skip/default |
| 2 | Plugin-based type validation phase exists in pipeline | Phase 3.7 or equivalent |
| 3 | Machine-readable JSON report output capability exists | Per-check PASS/WARN/FAIL/SKIP status + `duration_ms` |

**Report Section**: `"registry_architecture"` (sub-sections 4.4.1–4.4.5)

### 4.5 Domain 5: Variant Structural Integrity

**Objectives**: Verify all L2 variants satisfy the structural contract defined in `variant-contract.json`.

**Validation Method**: `variant-contract.json` required files list → per-variant existence and structure check.

**PASS Criteria** (per variant):

| # | Contract Requirement | Validation |
|---|---------------------|-----------|
| 1 | `variant.json` exists and is parseable JSON with required fields (`name`, `variant_type`, `status`, `version`) | Parse JSON → check required keys |
| 2 | `AGENTS.md` exists and contains `COMMON-AGENTS:START/END` markers | `fs.existsSync()` + grep markers |
| 3 | `agents/pm.md` exists with `extends:` pointing to L1, and path resolves to existing file | Parse YAML `extends:` → `path.resolve()` → `fs.existsSync()` |
| 4 | `CLAUDE.md` exists | `fs.existsSync()` |
| 5 | `GEMINI.md` exists | `fs.existsSync()` |
| 6 | Platform parity: `.claude/settings.json` and `.gemini/settings.json` both exist | `fs.existsSync()` both |
| 7 | Specialist agents meet structural contract per `common-contract.json` | Per-agent section count and required sections |
| 8 | Skills meet structural contract per `common-contract.json` (where skills exist) | Per-skill section count and required frontmatter fields |
| 9 | Zero L0 leakage: no `CONSTITUTION.md` references in variant files (excluding ADR docs) | Grep + filter |

**Report Section**: `"variant_integrity"` (7 variants × N items)

### 4.6 Domain 6: Known Issues Baseline

**Objectives**: Assess the resolution, regression, and acknowledgment status of previously identified issues.

**Input**: `docs/templates/known-issues.json` (external data source — issues are NOT hardcoded in this design document).

**PASS Criteria** (per issue in `known-issues.json`):

| # | Criterion | Validation |
|---|-----------|-----------|
| 1 | Issue status is `Resolved` or `Accepted` (with documented rationale) | Check status field |
| 2 | `Resolved` issues: no regression evidence (original symptom not present) | Re-verify original symptom location |
| 3 | `Accepted` issues: risk assessment is documented | Check for rationale in associated design doc or code comment |

**Report Section**: `"known_issues_baseline"`

---

## 5. Audit Methodology

### 5.1 Capability Detection Rules

Auditors use these four detection rules in priority order (safest first):

| Priority | Rule | Method | When to Use | Evidence Collected |
|----------|------|--------|-------------|-------------------|
| 1 | **CLI Capability** | `bun <script> --help` or `--dry-run`, check expected exit code | Script with CLI interface | stdout/stderr capture + exit code |
| 2 | **Export Inspection** | Static import/require analysis or `bun --eval` to list exports | Module with programmatic API | Exported symbol list |
| 3 | **AST Inspection** | Parse TypeScript source, traverse for interface/function declarations | Structural validation without execution | AST node list (function name, parameters) |
| 4 | **Runtime Smoke Test** | Execute script in controlled environment with mock inputs | End-to-end behavior verification | Return value, exit code, side effects |

### 5.2 Capability Detection Result Status

Each capability check produces one of four result statuses:

| Status | Meaning | Action |
|--------|---------|--------|
| `SUPPORTED` | Capability fully detected via any detection rule | Check passes |
| `PARTIAL` | Capability partially detected (e.g., interface exists but not tested) | Check passes with note |
| `NOT_SUPPORTED` | Capability not found | Check fails |
| `NOT_APPLICABLE` | Check not relevant for this environment or configuration | Check skipped, not counted |

### 5.3 ADR Compliance Validation

ADR compliance requires **three-step validation** beyond simple pattern matching:

1. **Parse**: Extract structured data from target files (YAML frontmatter, JSON content, marker patterns).
2. **Resolve**: Verify referenced paths exist and dependency chains are intact (e.g., `extends:` chain resolves to a real file).
3. **Validate**: Compare resolved state against ADR rules (e.g., chain terminates at L1, zero L0 leakage).

Grep-only checks are insufficient for structural validation — they cannot distinguish between a syntactically valid `extends:` value and one that points to a non-existent file.

### 5.4 CI Exit Code Policy

When this audit is integrated into CI/CD, the following exit code policy applies:

| Highest Severity Finding | Exit Code | CI Behavior |
|-------------------------|-----------|-------------|
| Critical | 2 | Pipeline fails, block merge |
| Major | 1 | Pipeline fails with warning |
| Minor / Observation | 0 | Pipeline passes, annotated in report |
| No findings (PASS) | 0 | Pipeline passes |

---

## 6. Evidence Collection

### 6.1 Output Directory Structure

```
artifacts/audit/
├── audit-report.json            # Single consolidated report (all domain results)
├── audit-summary.md             # Human-readable summary + final verdict
└── evidence/                   # Raw evidence files
    ├── audit-output.json        # bun audit.ts --json
    ├── drift-report.json        # bun propagate-to-templates.ts --check-drift
    ├── validation-output.json   # bun validate-templates.ts --variant all
    ├── capability-capture.json  # CLI/export/AST detection results
    └── workspace-fingerprint.txt # Reproducibility metadata
```

### 6.2 Audit Report Schema

```json
{
  "schema_version": "1.0",
  "metadata": {
    "audit_version": "1.0.0",
    "git_commit": "<full SHA>",
    "timestamp": "<ISO 8601>",
    "workspace_fingerprint": {
      "git_commit": "<full SHA>",
      "changed_files": ["list of unstaged changes, if any"],
      "manifest_sha256": "<SHA256 of propagation-map.json + common-contract.json concatenated>"
    }
  },
  "capability_detection_status": "SUPPORTED | PARTIAL | NOT_SUPPORTED | NOT_APPLICABLE",
  "ci_exit_code": 0,
  "domains": {
    "deployment_script_chain": {
      "status": "PASS | PASS WITH WARNINGS | FAIL | SKIP | NOT RUN",
      "checks": [
        {
          "id": "D1-C01",
          "description": "Workspace-to-template deployment synchronization capability exists",
          "status": "PASS | FAIL",
          "evidence": "evidence/capability-capture.json#D1-C01",
          "capability_detection": "SUPPORTED"
        }
      ]
    },
    "governance_consistency": {
      "status": "PASS",
      "checks": [
        {
          "id": "D2-C01",
          "description": "VERSION_REGISTRY.json uses nested object format",
          "status": "PASS | FAIL",
          "evidence": "evidence/governance-consistency.json#D2-C01"
        }
      ]
    },
    "adr_compliance": {
      "status": "PASS",
      "checks": [...]
    },
    "registry_architecture": {
      "status": "PASS",
      "subdomains": {
        "registry_layer1": { "status": "PASS", "checks": [...] },
        "plugin_layer2": { "status": "PASS", "checks": [...] },
        "validator_layer3": { "status": "PASS", "checks": [...] },
        "workspace_integration_layer4": { "status": "PASS", "checks": [...] },
        "pipeline_integration_layer5": { "status": "PASS", "checks": [...] }
      }
    },
    "variant_integrity": {
      "status": "PASS",
      "variants": {
        "co-consult": { "status": "PASS", "checks": [...] },
        "co-deck": { "status": "PASS", "checks": [...] },
        "co-design": { "status": "PASS", "checks": [...] },
        "co-develop": { "status": "PASS", "checks": [...] },
        "co-game": { "status": "PASS", "checks": [...] },
        "co-security": { "status": "PASS", "checks": [...] },
        "co-work": { "status": "PASS", "checks": [...] }
      }
    },
    "known_issues_baseline": {
      "status": "PASS",
      "issues": [
        {
          "id": "ISSUE-001",
          "title": "...",
          "severity": "Critical",
          "expected_status": "Resolved",
          "actual_status": "Resolved | Still Exists | Accepted",
          "regression_check": "PASS | FAIL"
        }
      ]
    }
  }
}
```

### 6.3 Workspace Fingerprint

For reproducibility, each audit run records:

| Field | Source | Description |
|-------|--------|-------------|
| `git_commit` | `git rev-parse HEAD` | Full SHA of the commit being audited |
| `changed_files` | `git diff --name-only` | List of unstaged changes (empty if clean) |
| `manifest_sha256` | SHA256 of concatenated `propagation-map.json` + `common-contract.json` | Fingerprint of governance configuration state |

---

## 7. Findings & Recommendations

### 7.1 Traceability: Finding → Recommendation → Known Issue

| Finding ID | Domain | Severity | Description | Recommendation ID | Phase |
|------------|--------|----------|-------------|-------------------|-------|
| F-001 | Governance | Critical | VERSION_REGISTRY format mismatch risk between writers | R-A1 | A |
| F-002 | Governance | Major | `common.lifecycle.json` missing co-deck and co-game from `propagatedTo` | R-A2 | A |
| F-003 | Script Chain | Minor | `create-l2-scaffold.ts` contains markdown fencing artifact on line 2 | R-B1 | B |
| F-004 | ADR | Major | `deploy-to-l1.ts` referenced in ADR-0040 but never implemented | R-B2 | B |
| F-005 | Script Chain | Minor | No rollback mechanism for L0→L1 propagation | R-B3 | B |
| F-006 | Registry | Observation | Variant Registry design document status "Proposed" despite partial implementation | R-C1 | C |

### 7.2 Finding Details

**F-001**: `integration-helpers.ts` writes `VERSION_REGISTRY.json` variants as a flat array, while `validate-templates.ts` reads it as a nested object keyed by name. Running the writer against the current file would corrupt the structure.

**F-002**: `common.lifecycle.json` `propagatedTo` contains only 5 variants. co-deck and co-game are missing despite existing in `templates/`.

**F-003**: Line 2 of `create-l2-scaffold.ts` contains `` ```typescript `` — a spurious markdown code fence opener. Does not affect bun runtime.

**F-004**: ADR-0040 defines a dedicated `deploy-to-l1.ts` for CLAUDE.md/GEMINI.md/pm.md deployment with section filtering and reference transforms. The script has never been created. Governance deployment currently relies on `propagate-to-templates.ts --governance-l1`.

**F-005**: `propagate-to-templates.ts` copies files without backups. `--force` always overwrites. No transaction or snapshot-based rollback.

**F-006**: `variant-registry-architecture-design.md` status is "Proposed", yet `registries/`, `plugins/`, `validators/`, and `workspace-integration.ts` have been implemented.

---

## 8. Severity Classification

| Severity | Definition | CI Exit Code |
|----------|-----------|-------------|
| **Critical** | Deployment failure or data corruption possibility | 2 |
| **Major** | Functional defect or explicit regulatory violation | 1 |
| **Minor** | Quality issue, non-standard, improvement opportunity | 0 |
| **Observation** | Improvement suggestion, documentation status | 0 |

---

## 9. Audit Status Definitions

| Status | Meaning |
|--------|---------|
| **PASS** | All checks passed, no findings |
| **PASS WITH WARNINGS** | Critical/Major = 0, Minor > 0 or Observation > 0 |
| **FAIL** | Critical > 0 or Major > 0 |
| **SKIP** | Precedent domain failed — dependency not satisfied |
| **NOT RUN** | Intentionally not executed (out of scope for this run) |

### Domain Status Aggregation Rules

| Check Results | Domain Status |
|---------------|---------------|
| All checks PASS | PASS |
| Any FAIL (Critical or Major) | FAIL |
| Any FAIL (Minor or Observation), no Critical/Major | PASS WITH WARNINGS |
| Domain not executed | SKIP or NOT RUN |

---

## 10. Recommendations

### Phase A — Urgent (Critical/Major)

| ID | Description | Target |
|----|-------------|--------|
| R-A1 | Refactor `integration-helpers.ts` VERSION_REGISTRY writer to use nested object format | Fix F-001 |
| R-A2 | Update `common.lifecycle.json` `propagatedTo` to include all 7 variants | Fix F-002 |

### Phase B — Medium-term (Major/Minor)

| ID | Description | Target |
|----|-------------|--------|
| R-B1 | Remove markdown fencing artifact from `create-l2-scaffold.ts` line 2 | Fix F-003 |
| R-B2 | Implement `deploy-to-l1.ts` per ADR-0040, or formally deprecate ADR-0040 in favor of existing `--governance-l1` | Fix F-004 |
| R-B3 | Add snapshot-based rollback mechanism to `propagate-to-templates.ts` | Fix F-005 |

### Phase C — Long-term (Observation)

| ID | Description | Target |
|----|-------------|--------|
| R-C1 | Update `variant-registry-architecture-design.md` status from "Proposed" to reflect implementation progress | Fix F-006 |

---

## 11. Verification Workflow

### 11.1 Finding Lifecycle

Each finding follows a defined lifecycle from identification to closure:

| Field | Description |
|-------|-------------|
| Finding ID | `F-XXX` — unique identifier for tracking |
| Owner | Responsible agent or person assigned |
| Recommendation ID | `R-XX` — linked recommended action |
| Target Version | Target fix version or date |
| Status | Lifecycle state (see below) |
| Verification Evidence | Reference to re-audit results confirming fix (commit SHA) |
| Verification Date | Timestamp of final confirmation |
| Notes | Regression notes, exception rationale |

### 11.2 Status Flow

```
Open ──dispatch──▶ In Progress ──fix complete──▶ Pending Verification
                                                        │
                                              ┌─────────┘
                                              ▼
                                          Verified ──no regression──▶ Closed
                                              │
                                              ▼ (regression found)
                                          In Progress (re-open)
```

### 11.3 Verification Procedure

1. Identify Finding with `status: "Pending Verification"`
2. Execute relevant audit checks from the domain(s) that produced the finding
3. Record results in `artifacts/audit/audit-report.json` with new commit SHA
4. If no regression: set `status: "Verified"`, record verification evidence
5. If regression found: set `status: "In Progress"` (re-open), assign back to owner
6. After verification period (no regression for 1 audit cycle): set `status: "Closed"`

---

## 12. Audit Checklist

### 12.1 Domain 1: Deployment Script Chain

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| D1-C01: Deployment sync capability | PASS | evidence/capability-capture.json |
| D1-C02: Audit orchestration capability | PASS | evidence/capability-capture.json |
| D1-C03: L2 scaffold capability | PASS | evidence/capability-capture.json |
| D1-C04: Promotion pipeline capability | PASS | evidence/capability-capture.json |
| D1-C05: Opt-in L1→L2 sync capability | PASS | evidence/capability-capture.json |

### 12.2 Domain 2: Governance JSON Consistency

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| D2-C01: VERSION_REGISTRY nested object format | PASS | evidence/governance-consistency.json |
| D2-C02: VERSION_REGISTRY all variants present | PASS | evidence/governance-consistency.json |
| D2-C03: lifecycle.json propagatedTo complete | PASS | evidence/governance-consistency.json |
| D2-C04: propagation-map.json target_variants complete | PASS | evidence/governance-consistency.json |
| D2-C05: common-contract files exist in L1 | PASS | evidence/governance-consistency.json |
| D2-C06: variant-contract required files in all L2 | PASS | evidence/governance-consistency.json |

### 12.3 Domain 3: ADR Compliance

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| D3-C01: ADR-0031 scaffold-time fork (no auto-propagation) | PASS | evidence/adr-compliance.json |
| D3-C02: ADR-0039 extends chain resolves to L1 | PASS | evidence/adr-compliance.json |
| D3-C03: ADR-0039 VARIANT-SECTION markers | PASS | evidence/adr-compliance.json |
| D3-C04: ADR-0040 zero L0 leakage in templates/ | PASS | evidence/adr-compliance.json |
| D3-C05: ADR-0040 governance deployment mechanism | PASS | evidence/adr-compliance.json |

### 12.4 Domain 4: Variant Registry Architecture

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| D4.1-C01: Variant type enumeration (Layer 1) | PASS | evidence/capability-capture.json |
| D4.1-C02: Capability definition (Layer 1) | PASS | evidence/capability-capture.json |
| D4.1-C03: Promotion policy (Layer 1) | PASS | evidence/capability-capture.json |
| D4.1-C04: Validation policy (Layer 1) | PASS | evidence/capability-capture.json |
| D4.1-C05: Cross-registry integrity validation (Layer 1) | PASS | evidence/capability-capture.json |
| D4.2-C01: Plugin interface definition (Layer 2) | PASS | evidence/capability-capture.json |
| D4.2-C02: At least 1 plugin implementation (Layer 2) | PASS | evidence/capability-capture.json |
| D4.2-C03: Plugin registration (Layer 2) | PASS | evidence/capability-capture.json |
| D4.3-C01: 7 validator modules (Layer 3) | PASS | evidence/capability-capture.json |
| D4.3-C02: Validator interface (Layer 3) | PASS | evidence/capability-capture.json |
| D4.3-C03: Validator orchestration (Layer 3) | PASS | evidence/capability-capture.json |
| D4.4-C01: Transactional write (Layer 4) | PASS | evidence/capability-capture.json |
| D4.4-C02: Rollback capability (Layer 4) | PASS | evidence/capability-capture.json |
| D4.5-C01: Phase 7 separated (Layer 5) | PASS | evidence/capability-capture.json |
| D4.5-C02: Plugin-based validation phase (Layer 5) | PASS | evidence/capability-capture.json |
| D4.5-C03: JSON report output (Layer 5) | PASS | evidence/capability-capture.json |

### 12.5 Domain 5: Variant Structural Integrity

Repeated per variant (co-consult, co-deck, co-design, co-develop, co-game, co-security, co-work):

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| D5-C01: variant.json exists, parseable, required fields | PASS | evidence/validation-output.json |
| D5-C02: AGENTS.md with COMMON-AGENTS markers | PASS | evidence/validation-output.json |
| D5-C03: agents/pm.md extends resolves to L1 | PASS | evidence/adr-compliance.json |
| D5-C04: CLAUDE.md exists | PASS | evidence/validation-output.json |
| D5-C05: GEMINI.md exists | PASS | evidence/validation-output.json |
| D5-C06: Platform parity (.claude + .gemini settings) | PASS | evidence/validation-output.json |
| D5-C07: Agent structural contract met | PASS | evidence/validation-output.json |
| D5-C08: Skill structural contract met | PASS | evidence/validation-output.json |
| D5-C09: Zero L0 leakage | PASS | evidence/adr-compliance.json |

### 12.6 Domain 6: Known Issues Baseline

| Check | Expected | Evidence Source |
|-------|----------|----------------|
| ISSUE-001: VERSION_REGISTRY format mismatch | Resolved | evidence/known-issues-verify.json |
| ISSUE-002: lifecycle.json co-deck/co-game missing | Resolved | evidence/known-issues-verify.json |
| ISSUE-003: create-l2-scaffold.ts markdown fencing | Resolved | evidence/known-issues-verify.json |
| ISSUE-004: deploy-to-l1.ts not implemented | Accepted | evidence/known-issues-verify.json |
| ISSUE-005: No L0→L1 rollback | Accepted | evidence/known-issues-verify.json |
| ISSUE-006: Registry design doc "Proposed" | Resolved | evidence/known-issues-verify.json |
| ISSUE-007: L2 auto-sync prohibited (by-design) | Accepted | evidence/known-issues-verify.json |

---

## 13. Audit Summary (Illustrative Output)

> **Note**: The following is an **illustrative example** showing the expected format and content of an audit summary. This is not actual audit results.

```
## Audit Summary

**Audit Version**: 1.0.0 | **Schema Version**: 1.0
**Git Commit**: d54ddc8... | **Timestamp**: 2026-07-08T12:00:00Z

### Domain Results
| Domain                                | Status               | Checks      |
|---------------------------------------|----------------------|-------------|
| Deployment Script Chain               | PASS                 | 5/5         |
| Governance JSON Consistency            | FAIL                 | 3/6         |
| ADR Compliance                         | PASS WITH WARNINGS   | 4/5         |
| Registry Architecture (4.1-4.5)       | PASS                 | 16/16       |
| Variant Structural Integrity (7 vars)  | PASS                 | 58/63       |
| Known Issues Baseline                  | FAIL                 | 4/7         |

### Overall
| Metric         | Value                  |
|----------------|------------------------|
| Overall Status | FAIL                   |
| Passed Checks  | 184 / 191              |
| Coverage       | 96%                    |
| Skipped        | 7                      |
| Critical       | 1                      |
| Major          | 1                      |
| Minor          | 4                      |
| Observation    | 1                      |
| CI Exit Code   | 2                      |

### Finding → Recommendation Traceability
| Finding | Severity | Recommendation | Phase |
|---------|----------|---------------|-------|
| F-001   | Critical | R-A1           | A     |
| F-002   | Major    | R-A2           | A     |
| F-003   | Minor    | R-B1           | B     |
| F-004   | Major    | R-B2           | B     |
| F-005   | Minor    | R-B3           | B     |
| F-006   | Observation | R-C1        | C     |
```

---

## Appendix A: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 → 1.0 | 2026-07-08 | v1→v2: Added PASS criteria, outputs, evidence, scope, summary; split Domain 4 into sub-domains; Known Issues → Baseline; severity 4-level classification |
| 1.0 → 2.0 | 2026-07-08 | v2→v3: Capability-based PASS criteria (not version-based); single output (`audit-report.json`); `artifacts/audit/` directory; contract-based Domain 5; `known-issues.json` externalization; Finding→Recommendation ID traceability; Skip policy; reproducibility metadata; coverage metrics |
| 2.0 → 3.0 | 2026-07-08 | v3→v4: Reduced capability coupling (implementation examples as `Example:` only); 4-tier Capability Detection Rules; ADR Parse→Resolve→Validate; Workspace Fingerprint; Illustrative Output marking; Verification Workflow |
| 3.0 → 3.1 | 2026-07-08 | v4→v4.1: Added `schema_version` to audit-report.json; standardized Capability Detection Result Status (SUPPORTED/PARTIAL/NOT_SUPPORTED/NOT_APPLICABLE); added CI Exit Code Policy |
