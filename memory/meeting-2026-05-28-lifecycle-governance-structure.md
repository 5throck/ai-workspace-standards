# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Unified Lifecycle Governance Structure — Workspace Root & Templates (5 Lifecycle Domains)
**Participants**: PM (facilitator), Architect, Automation-Engineer, Scaffolding-Expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

This meeting follows two prior lifecycle integration reviews:
- B-series (2026-05-28): agent/skill lifecycle ↔ variant lifecycle integration
- C-series (2026-05-28): script lifecycle ↔ variant lifecycle integration

The user identified that all 5 lifecycle management domains (variant, agent, skill, script, README)
need to be reviewed for coverage across **workspace root** and **templates** layers — and that
prior meetings only examined cross-lifecycle coupling, not cross-layer coverage.

---

## Pre-Analysis Findings (Lifecycle Coverage Matrix — Current State)

| Lifecycle Domain | Workspace Root | templates/common | co-* Variants | L2 Projects |
|-----------------|:--------------:|:----------------:|:-------------:|:-----------:|
| Variant | ❌ N/A | ❌ not tracked | ✅ validate-templates.ts (partial) | ❌ |
| Agent | ✅ audit.sh | ❌ | ❌ not in validate-templates | ❌ |
| Skill | ✅ audit.sh | ❌ | ❌ not in validate-templates | ❌ |
| Script | ✅ verify-scripts.ts | ✅ L0/L1 drift only | ❌ not in validate-templates | ❌ |
| README | ✅ readme-lifecycle-audit.ts | ✅ basic only | ❌ explicitly excluded | ❌ |

Critical finding: audit.sh calls only 3 of 5 lifecycle checks (agent, skill, memory).
verify-scripts.ts and readme-lifecycle-audit.ts are NOT called by audit.sh.
Workspace root lifecycle orchestration is also incomplete.

---

## Transcript

### PM (Opening)

Meeting convened to review how the 5 lifecycle management domains (variant, agent, skill, script, README) are applied across workspace root and templates layers, and to propose a unified governance structure. Prior meetings (B-series, C-series) identified cross-lifecycle integration gaps; this meeting addresses cross-layer coverage gaps.

---

### Architect (Round 1)

Summarized the current coverage matrix from direct code analysis. Key findings:

1. Co-* variant column is the largest gap — only variant lifecycle is partially covered; agent/skill/script/README are not called from validate-templates.ts.

2. readme-lifecycle-audit.ts explicitly excludes templates subdirectories (line 136 condition) but no alternative check exists for variant-level README files.

3. Proposed formalizing the coverage matrix as a LIFECYCLE_GOVERNANCE.md document — without this, gaps will recur as new lifecycle domains or variants are added.

Question to Automation-Engineer: Should validate-templates.ts be extended as the template-layer lifecycle orchestrator, or should a separate orchestrator be created?

---

### Automation-Engineer (Round 1)

Confirmed the audit.sh gap — only agent-lifecycle-audit.ts, skill-lifecycle-audit.ts, and verify-memory.ts are called (lines 187–213). verify-scripts.ts and readme-lifecycle-audit.ts are absent.

Strongly endorsed extending validate-templates.ts rather than creating a new orchestrator. Rationale: a new orchestrator would create confusion about when to call which tool, and would require CI/pre-commit pipeline changes.

Proposed: audit.sh = workspace root lifecycle orchestrator; validate-templates.ts = template layer lifecycle orchestrator. Both should cover all 5 domains.

Exit code strategy for adding verify-scripts + readme-lifecycle-audit to audit.sh: use the existing `|| ((errors++))` pattern throughout audit.sh — no pre-commit impact.

Question to Scaffolding-Expert: Is adding a validate-templates.ts pre-check to new-project.sh feasible?

---

### Scaffolding-Expert (Round 1)

Confirmed the pre-check is feasible — 5–8 lines of change in new-project.sh. The variant status check already exists; adding `bun scripts/validate-templates.ts --variant "$VARIANT_NAME"` and checking exit code is straightforward.

Raised a more fundamental structural issue: the governance matrix should be machine-readable, not just documentation. validate-templates.ts should use presence-driven logic — if agents/ directory exists, run agent lifecycle audit; if skills/ exists, run skill lifecycle audit. This avoids hardcoding and makes new variant additions self-describing.

Also raised the templates/common gap: common has no lifecycle state file or version tracking. Since common changes affect all variants (L0→L1 propagation), this is a traceability blind spot.

Question to Architect: Should templates/common be treated as a separate lifecycle entity requiring its own lifecycle state file?

---

### Architect (Round 2)

Answered yes — templates/common needs a lightweight `common.lifecycle.json`. Rationale: SCRIPTS.md already defines L0→L1 propagation semantics; common should similarly have a version so that "which version of common was this variant built on" is trackable.

Proposed 3-Layer Architecture:

```
Layer 0: Workspace Root (C:/git/)
  Orchestrator: audit.sh (needs expansion)
  Domains: agent ✅, skill ✅, script ❌→add, README ❌→add

Layer 1: Templates
  Sub-layer 1a: templates/common/
    Orchestrator: none → add common.lifecycle.json
    Domains: script (drift only) ✅, others ❌→add
  Sub-layer 1b: templates/co-*/
    Orchestrator: validate-templates.ts (needs expansion)
    Domains: variant ✅(partial), agent ❌, skill ❌, script ❌, README ❌

Layer 2: L2 Projects
  Orchestrator: project-level audit.sh (copied from L1 at creation)
  Domains: determined by L1 snapshot at creation time
```

Two key design decisions:
1. validate-templates.ts becomes presence-driven orchestrator (per Scaffolding-Expert proposal)
2. New LIFECYCLE_GOVERNANCE.md (human-readable) + lifecycle-governance.json (machine-readable) split

Question to Automation-Engineer: Exit code strategy for adding verify-scripts + readme-lifecycle-audit to audit.sh?

---

### Automation-Engineer (Round 2)

Confirmed exit code strategies for both scripts:
- verify-scripts.ts: errors exit 1, warnings exit 0 (safe to add with || pattern)
- readme-lifecycle-audit.ts: errors exit 1, warnings exit 0 (same)

Proposed lifecycle-governance.json as machine-readable SSOT separate from LIFECYCLE_GOVERNANCE.md. validate-templates.ts reads lifecycle-governance.json to determine which domains are mandatory vs. optional per layer and variant status.

Final priority ordering:
- P0: audit.sh + LIFECYCLE_GOVERNANCE.md/json
- P1: validate-templates.ts 5-domain orchestration + common.lifecycle.json
- P2: new-project.sh lifecycle-governance.json-driven pre-check

---

### Scaffolding-Expert (Round 2)

Endorsed lifecycle-governance.json approach. Key addition: new-project.sh should read lifecycle-governance.json at project creation time to dynamically determine which lifecycle checks the selected variant must pass — no hardcoding of variant-type-specific rules.

Proposed adding `"propagatedTo": ["co-develop", "co-work", "co-design", "co-security"]` to common.lifecycle.json. This enables validate-templates.ts to compare common version against each variant's scripts-snapshot.json (C-02) and flag variants built on outdated common.

Noted that LIFECYCLE_GOVERNANCE.md should serve as the "new variant addition checklist" — consolidating guidance currently scattered across VARIANT_LIFECYCLE.md, VARIANT_CONTRACT.md, SCRIPTS.md, and agent/skill audit docs.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| D-01 | architect | `templates/common/LIFECYCLE_GOVERNANCE.md` + `templates/common/lifecycle-governance.json` — 5-domain × 3-layer matrix, machine-readable governance policy, common.lifecycle.json schema design included | P0 |
| D-02 | automation-engineer | Add `verify-scripts.ts` + `readme-lifecycle-audit.ts` calls to `audit.sh` lifecycle section (complete workspace root lifecycle orchestration) | P0 |
| D-03 | scaffolding-expert | Create `templates/common/common.lifecycle.json` with version, status, and `propagatedTo` variant list | P1 |
| D-04 | automation-engineer | Extend `validate-templates.ts` with presence-driven 5-domain orchestration — reads `lifecycle-governance.json` to determine mandatory/optional checks per variant | P1 |
| D-05 | scaffolding-expert | Add lifecycle-governance.json-driven variant pre-check to `new-project.sh/.ps1` | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-D01 | LIFECYCLE_GOVERNANCE.md contains 5-domain × 3-layer coverage matrix; lifecycle-governance.json is parseable by validate-templates.ts | Document review + JSON parse test via bun |
| AC-D02 | audit.sh execution invokes verify-scripts and readme-lifecycle-audit in lifecycle section | Check audit.sh execution log |
| AC-D03 | templates/common/common.lifecycle.json exists and is read by validate-templates.ts | Run validate-templates.ts, confirm common lifecycle check output |
| AC-D04 | Variants with agents/ directory automatically trigger agent lifecycle audit; variants with skills/ trigger skill lifecycle audit | Add orphaned agent to co-security template, confirm validate-templates.ts detects it |
| AC-D05 | When lifecycle-governance.json defines mandatory domains, new-project.sh rejects variants that fail those checks | Attempt project creation with a deprecated-status variant — confirm rejection |

## Open Questions

- common.lifecycle.json status field value: reuse existing `draft|beta|stable|deprecated` or introduce `"base"` as a new state — Architect to decide in D-01 design phase.
- Exact schema for lifecycle-governance.json — included in D-01 deliverable.
- Integration between scripts-snapshot.json (C-02) and common.lifecycle.json propagatedTo for version drift detection — recommend designing C-02 and D-01 concurrently.
