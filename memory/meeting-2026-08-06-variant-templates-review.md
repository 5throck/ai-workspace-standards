# Meeting: Templates (<variant>) Status Assessment & Improvement Plan

**Date**: 2026-08-06  
**Facilitator**: PM  
**Participants**: PM, Architect, Automation Engineer, Security Expert, Docs Writer, Auditor, Lifecycle Manager  
**Topic**: Comprehensive health status assessment of the 7 workspace variant templates (`templates/co-*`) and derivation of L0→L1→L2 propagation and enhancement plans.

---

## Agenda

1. Review structural integrity and schema validity across all 7 L2 variants (`co-consult`, `co-deck`, `co-design`, `co-develop`, `co-game`, `co-security`, `co-work`).
2. Analyze propagation drift between L0 (workspace root), L1 (`templates/common/`), and L2 (`templates/co-*/`).
3. Identify cross-variant performance, security, and documentation optimization opportunities.
4. Synthesize prioritized action items and execution strategy.

---

## Variant Status Assessment Overview

- **Structural & Schema Validation (`bun scripts/validate-templates.ts`)**: PASS (0 errors). All 7 variants adhere to `variant.json` schema requirements, `context.md` section guidelines, and PM Gateway YAML extends hierarchy (ADR-0033).
- **L0→L1 Script & Skill Propagation (`bun scripts/propagate-to-templates.ts`)**: 29 files in `templates/common/` have pending L0 updates (including recent `dev-sync.ts` v1.5.0, `test-runner.ts` v1.1.0, and `gateguard` hook updates).
- **L1→L2 Platform Settings Drift (`bun scripts/propagate-to-templates.ts --check-drift`)**: Detected `gemini-settings/settings.json` drift across all 7 variants due to recent platform hook additions.
- **Git Tracking Alignment**: Resolved `.gitignore` wildcard issue so that `test-driven-development` skills in `co-develop` and `co-game` are fully tracked.

---

## Agent Findings & Perspectives

### 📐 Architect — Variant Architecture & Domain Consistency
1. **L0→L1 Propagation Execution**: Execute `bun scripts/propagate-to-templates.ts --apply` to publish the latest `dev-sync.ts` (v1.5.0) and `test-runner.ts` (v1.1.0) scripts to `templates/common/`.
2. **L1→L2 Settings Drift Sync**: Update `.gemini/settings.json` in all 7 L2 variants to align platform hooks (`BeforeTool`, `AfterTool`) with L1 standards.
3. **Variant Agent Manifest Standardization**: Ensure `variant.json` `agent_manifest` definitions explicitly declare pipeline order and retry policies across all variants.

### ⚙️ Automation Engineer — Script Propagation & Test Runner Delivery
1. **Script Synchronization**: Verify that all 137 verified scripts in `scripts/` propagate cleanly to `templates/common/scripts/` without encoding or line-ending mismatches.
2. **Scaffolding E2E Testing**: Run `bun scripts/simulate-project-creation.ts` to test scaffolding for all 7 variants in clean temporary environments.

### 🛡️ Security Expert — Variant Security Controls & Hooks
1. **Pre-commit Hook Sync**: Ensure `.githooks/pre-commit` and `SYNC_ACTIVE` commit protection logic are identical across `templates/common/` and all L2 variants.
2. **Secret Scan Verification**: Re-verify `gitleaks` scanning patterns for all variant-specific skills to ensure zero credential leakage in template code.

### 📝 Documentation Writer — Variant Documentation & i18n Alignment
1. **Templates README Update**: Update `templates/README.md` and `templates/README_ko.md` to reflect recent script version bumps (dev-sync v1.5.0, test-runner v1.1.0).
2. **Variant Context Docs Integrity**: Ensure `docs/context.md` files in each variant maintain clean English documentation and correct relative links.

### 🛠️ Consistency Auditor — Cross-Platform Parity & Audit Gates
1. **Platform Skill Version Sync**: Verify `.claude/skills/` and `.gemini/skills/` version headers are identical across `templates/common/` and all 7 L2 variants.
2. **Stray Artifact Guard**: Confirm that no L0-only agents (like `lifecycle-manager`) leak into L2 variant `agents/` directories.

---

## Synthesized Decisions & Action Items

| # | Action Item | Primary Owner | Target Area | Priority |
|:---:|---|:---:|:---:|:---:|
| **1** | Execute `propagate-to-templates.ts --apply` to sync L0 updates to L1 `templates/common/` | `automation-engineer` | `templates/common/` | **High** |
| **2** | Propagate updated `gemini-settings/settings.json` to all 7 L2 variants | `automation-engineer` | `templates/co-*/` | **High** |
| **3** | Update `templates/README.md` and `templates/README_ko.md` version manifests | `docs-writer` | `templates/` | **Medium** |
| **4** | Run E2E scaffolding simulation (`bun scripts/simulate-project-creation.ts`) | `scaffolding-expert` | `scripts/simulate-project-creation.ts` | **Medium** |
| **5** | Verify full template audit (`bun scripts/validate-templates.ts`) | `auditor` | Workspace-wide | **High** |

---

## Meeting Conclusion

The 7 workspace variants (`co-consult`, `co-deck`, `co-design`, `co-develop`, `co-game`, `co-security`, `co-work`) are **structurally sound and healthy** with zero schema errors. Executing the 5 propagation and documentation action items will complete L0→L1→L2 template synchronization.
