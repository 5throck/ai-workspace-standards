# Meeting Transcript
**Date**: 2026-05-29
**Topic**: (1) Migration of variant-related files from templates/common to docs, (2) 2-tier migration of templates/common/scripts
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1 — Variant File Migration to docs/

**PM**: (Opening)

Two agenda items for this meeting:
- Agenda 1 (Round 1): Migration of VARIANT_CONTRACT.md, VARIANT_LIFECYCLE.md, VERSION_REGISTRY_SCHEMA.md, and the variant/ directory from templates/common/ to docs/.
- Agenda 2 (Round 2): 2-tier migration of templates/common/scripts/.

Architect, please provide a structural view on the scope and target location within docs/.

---

**Architect**: (Round 1)

Migration criterion: "Is this file copied when scaffolding a new project?" — If No, move to docs/governance/. If Yes, keep in templates/common/.

Files to migrate:
- templates/common/VARIANT_CONTRACT.md → docs/governance/variant-contract.md
- templates/common/VARIANT_LIFECYCLE.md → docs/governance/variant-lifecycle.md
- templates/common/VERSION_REGISTRY_SCHEMA.md → docs/governance/version-registry-schema.md
- templates/common/variant/ (5 phases.md files) → docs/governance/variant/

Files to retain in templates/common/: CLAUDE.md, GEMINI.md, CONSTITUTION.md, CHANGELOG.md, README.md, SECURITY.md — all are scaffold-time copy targets.

Key judgment: these governance documents are design records, not runtime artifacts.

---

**Auditor**: (Round 1)

Architect's criterion is clear and verifiable. However, the reference update scope is wider than expected.

Known references to VARIANT_CONTRACT.md and VARIANT_LIFECYCLE.md exist in:
- templates/common/scripts/validate-templates.ts
- templates/common/CONSTITUTION.md (cross-reference links)
- agents/lifecycle-manager.md (jurisdiction section)
- docs/lifecycle/ files

After migration, all of these must be updated. Link validation via validate-docs-links or bun run validate is mandatory after migration.

Additional concern: templates/common/variant/phases.md files and variant-folder-level phases.md files may coexist — their SSOT relationship must be clarified before migration, or the migration will create confusion about which is authoritative.

---

**Automation-engineer**: (Round 1)

validate-templates.ts does not directly reference VARIANT_CONTRACT.md by file path — it validates variant folder structure (agents/, skills/, scripts/) rather than reading the governance docs. Script modification burden is therefore low.

variant/phases.md files: new-project.sh copies variant template folders (templates/co-design/, etc.) directly, not templates/common/variant/. These phases.md files are likely design documents only, not consumed by any script. Verified: they are not referenced by build or scaffold scripts.

Summary: migrating the 3 governance MD files carries minimal script modification risk. Markdown link updates remain the primary concern.

---

**PM**: (Round 1 — Close)

Round 1 decisions:
- Migration criterion confirmed: "scaffold copy target?" — No → docs/governance/.
- Migration targets confirmed: 3 governance docs + variant/ directory.
- Script modification burden: low. Markdown link updates + link validation: mandatory.
- Open item: phases.md SSOT clarification must happen alongside migration.

---

### Round 2 — 2-Tier Migration of templates/common/scripts/

**PM**: (Round 2 — Open)

Automation-engineer, in templates/common/scripts/ there are mixed .sh, .ps1, and .ts files. Applying the L0 2-tier strategy (Tier 1: native shell for bootstrap, Tier 2: .ts + bun), what files are currently misaligned and what is the migration sequence?

---

**Automation-engineer**: (Round 2)

Current classification:

Tier 1 (keep .sh/.ps1, bootstrap/setup): install-bun, setup, audit, dev-sync, gen-pr-body, sync-md. These must work without Bun present.

Problem files: .ts files that still have active (non-deprecated) .sh/.ps1 wrappers alongside them. L0 deprecated these wrappers for Tier 2; L1 has not done so yet.

Pure Tier 2 candidates (.ts only, wrappers should be deprecated/deleted): validate-templates.ts, sync-skills.ts, publish-to-template.ts, qa-gate.ts, gen-pr-body.ts, list-template-versions.ts, agent-create.ts, agent-lifecycle-audit.ts, and all lifecycle/ops scripts.

Tier 1 only (must NOT have .ts versions): install-bun, setup — Bun is not yet available when these run.

Migration sequence:
1. Create Tier classification table in SCRIPTS.md
2. Mark Tier 2 .sh/.ps1 wrappers as deprecated
3. Extend verify-scripts.ts to catch Tier violations
4. Sync validation with L0 validate-templates.ts

---

**Architect**: (Round 2)

Key structural addition: L1 (templates/common/scripts/) contains scripts that do not exist in L0 — agent-create.ts, agent-delete.ts, agent-lifecycle-audit.ts, dispatch.ts, retry-handler.ts, skill-lifecycle-audit.ts, etc. These are variant-project-only scripts.

L1 migration is not simply "copy L0 strategy to L1." L1-only scripts must be defined as a separate category: "L1-only Tier 2." These scripts run only in L2 project environments where Bun is already installed, so all are Tier 2. Any .sh/.ps1 wrappers for these are deprecated.

Required: add "L1-only Tier 2" section to L1 SCRIPTS.md explicitly listing these scripts.

Also critical: publish-to-template.ts must have an exclude list for L1-only scripts to prevent L0 from overwriting them during sync.

---

**Auditor**: (Round 2)

Architect's "L1-only Tier 2" framing is essential. Validation perspective:

verify-scripts.ts (already exists in L1) should be extended to auto-detect Tier violations: "Tier 2 script has non-deprecated .sh/.ps1 wrapper → error."

Acceptance criteria:
1. L1 SCRIPTS.md has Tier 1 / Tier 2 / L1-only Tier 2 sections clearly defined
2. All Tier 2 .sh/.ps1 wrappers are either deprecated-headered or deleted
3. bun run verify-scripts passes with no Tier violations
4. publish-to-template.ts has exclude list for L1-only scripts

---

**PM**: (Synthesis)

This meeting produced the following decisions:

**Agenda 1 — Variant file migration to docs/**
- Migration criterion: "scaffold copy target?" — No → docs/governance/
- Migration targets: VARIANT_CONTRACT.md, VARIANT_LIFECYCLE.md, VERSION_REGISTRY_SCHEMA.md, variant/ → docs/governance/
- Script modification burden: low; markdown link updates and link validation are mandatory
- phases.md SSOT clarification must be resolved during migration

**Agenda 2 — 2-tier migration of templates/common/scripts/**
- Tier 1: install-bun, setup, audit, dev-sync, gen-pr-body, sync-md — keep .sh/.ps1
- Tier 2: all lifecycle/ops .ts scripts — deprecate or delete .sh/.ps1 wrappers
- L1-only Tier 2: agent-create.ts, dispatch.ts, agent-lifecycle-audit.ts, etc. — separate category in SCRIPTS.md
- verify-scripts.ts to be extended for Tier violation detection
- publish-to-template.ts needs L1-only exclude list

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| M-01 | automation-engineer | Migrate 3 variant governance docs + variant/ directory from templates/common/ to docs/governance/; update all markdown references | Phase 4 |
| M-02 | docs-writer | Clarify phases.md SSOT — check duplication between docs/governance/variant/ and variant template folders; designate single source | Phase 4 |
| M-03 | automation-engineer | Update L1 scripts/SCRIPTS.md with Tier 1 / Tier 2 / L1-only Tier 2 sections; mark deprecated wrappers | Phase 4 |
| M-04 | automation-engineer | Extend verify-scripts.ts (L1) to detect Tier violations (Tier 2 with non-deprecated .sh/.ps1) | Phase 4 |
| M-05 | auditor | After M-01~M-04: run link validation + validate-templates to confirm all checks pass | Phase 5 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | VARIANT_CONTRACT.md, VARIANT_LIFECYCLE.md, VERSION_REGISTRY_SCHEMA.md exist in docs/governance/ | ls docs/governance/ |
| AC-02 | No broken markdown links after migration | bun run validate or validate-docs-links |
| AC-03 | phases.md SSOT documented — single authoritative source designated | Review docs/governance/variant/ and variant template folders |
| AC-04 | L1 SCRIPTS.md has Tier 1 / Tier 2 / L1-only Tier 2 sections | Manual review |
| AC-05 | bun run verify-scripts passes with no Tier violations | Script output |
| AC-06 | publish-to-template.ts has L1-only exclude list | Code review |
