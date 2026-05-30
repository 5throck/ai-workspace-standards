# Meeting Transcript
**Date**: 2026-05-30
**Topic**: SSOT Design for Phase Numbering — Preventing Cross-Document Drift
**Participants**: PM, Architect, Auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Diagnose why phase numbering drift is a recurring structural problem
2. Round 2: Design a SSOT mechanism that prevents drift automatically

---

## Round 1: Structural Diagnosis

**PM**: (Round 1 — Open)

The Phase 2 fix manually synchronized three documents that each declared different phase numbering. The fix works today, but if any document is edited in isolation next month, the drift will recur. Architect, please diagnose why this is structurally inevitable under the current setup and what the correct information architecture looks like.

---

**Architect**: (Round 1)

The problem is not "which document is correct" — it is that no document is designated as the source of truth. Currently three documents independently declare phase structure:

- `agents/pm.md`: "PM owns phases 0, 2, 6" (implicitly assumes 7-phase)
- `templates/common/phase-definitions.md`: explicitly lists phases 0–6 (7-phase)
- `docs/constitution/05-multi-agent-architecture.md`: listed phases 0–5 (6-phase, now manually corrected)

The Phase 2 fix synchronized them, but the next person to edit `pm.md` alone has no mechanism telling them their change must be reflected in two other documents. There is no declared dependency graph.

The same structural problem applies to agent tiers. `docs-writer` was upgraded to Medium tier — this was documented in `CLAUDE.md` and `AGENTS.md` but not in the constitution §5.2. Again: no single source of truth, no automatic propagation.

The solution is a machine-readable schema that declares these invariants once, and a validator that checks all dependent documents against it at commit time.

---

**Auditor**: (Round 1)

Architect's diagnosis is correct. From a validation perspective, the current `audit.ts` and `validate-templates.ts` check:
- File existence
- Frontmatter field presence
- Roster matches (AGENTS.md vs agents/ directory)

They do not check:
- Whether `pm.md`'s declared phase list matches any canonical definition
- Whether constitution §5.4 phase count matches what phase-definitions.md declares
- Whether agent tier declarations across documents are consistent

The result is that manual edits can introduce drift that passes all current validation gates. The drift is only caught when a human notices it — which in this case required a 7-agent parallel review to surface.

Adding schema-based cross-document validation to `validate-templates.ts` (which already runs in pre-commit) would catch these at commit time rather than at review time.

---

**PM**: (Round 1 — Close)

Both agree: the root cause is the absence of a machine-readable source of truth for cross-document invariants. The fix is not another manual synchronization pass — it is a schema file that makes the invariants explicit and a validator that enforces them automatically. Round 2 will design that schema.

---

## Round 2: SSOT Schema Design

**PM**: (Round 2 — Open)

Architect, propose the structure of `workspace-schema.json`. Auditor, identify the validation checkpoints that must be added to pre-commit. We also need to decide: extend `variant-contract.json` or create a new file?

---

**Architect**: (Round 2)

Separate file is the right choice. `variant-contract.json` answers "what files must exist in a variant." `workspace-schema.json` answers "what are the invariant values that must be consistent across all documents." Different concerns, different files.

Proposed `workspace-schema.json` structure:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12",
  "version": "1.0.0",
  "workflow": {
    "phases": {
      "canonical": ["0", "1-2", "3", "4", "5", "6"],
      "count": 7,
      "pm_owned": ["0", "2", "6"],
      "autonomous": ["1-2", "3", "4", "5"],
      "definitions": {
        "0":   "Project Initiation",
        "1-2": "Planning & Architecture",
        "3":   "Design Handoff",
        "4":   "Execution",
        "5":   "Quality Assurance",
        "6":   "Lifecycle Finalization"
      }
    }
  },
  "agent_tiers": {
    "pm":                  "high",
    "architect":           "high",
    "auditor":             "medium",
    "docs-writer":         "medium",
    "automation-engineer": "low",
    "scaffolding-expert":  "low",
    "lifecycle-manager":   "medium",
    "security-expert":     "medium"
  }
}
```

Scope constraint: variant-specific phase names (e.g., co-security's Phase 3 is Threat Modeling, not Design Handoff) belong in `variant.json`, not here. This schema covers only the shared invariants.

---

**Auditor**: (Round 2)

I support the separate file approach and the scope constraint. One important boundary condition: co-security has a `red-team-lead` agent that is high-tier, but workspace-schema.json only lists workspace-root agents. Variant-specific agents should be validated against their own `variant.json`, not the workspace schema.

The validation checkpoints I recommend adding to `validate-templates.ts`:

| Target Document | Check |
|----------------|-------|
| `agents/pm.md` | `Can Lead Phases:` list = `workflow.phases.pm_owned` |
| `templates/common/phase-definitions.md` | Declared phase list = `workflow.phases.canonical` |
| `docs/constitution/05-*.md` | Phase count number = `workflow.phases.count` |
| All `agents/*.md` at workspace root | `tier:` frontmatter value = `agent_tiers[name]` |

These four checks cover the exact documents where drift was found in Phase 1/2/3. Any future edit to any of these documents will be validated against the schema at commit time.

---

**PM**: (Round 2 — Close)

Final decisions:
1. Create `workspace-schema.json` as a new file (not extending `variant-contract.json`)
2. Scope: workspace-root phase structure and agent tiers only; variant-specific values stay in `variant.json`
3. Add four cross-document checks to `validate-templates.ts`
4. Variant-specific agent tiers (like co-security's red-team-lead) are out of scope for this schema

Open question assigned to Architect: how to handle variant-specific agent tiers in the A-01 design.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | architect | Create `workspace-schema.json` at repo root and `templates/common/` with phase structure and workspace-root agent tiers | Immediate |
| A-02 | automation-engineer | Add schema validation checks to `validate-templates.ts`: pm.md phase list, phase-definitions.md canonical list, constitution phase count, agent tier declarations | Immediate (after A-01) |
| A-03 | automation-engineer | Add `bash scripts/*.sh` reference detection to `audit.ts` — block commits with stale shell references | Immediate |
| A-04 | architect | Add `phases.phase3_name` field to each variant `variant.json` for variant-specific phase naming | Within 1 week |
| A-05 | auditor | Create `docs/governance/script-quality-gate.md` and add reference to `workspace-schema.json` as SSOT | Within 1 week |

## Open Questions

- How to handle variant-specific agent tiers (e.g., co-security `red-team-lead: high`) — Architect to decide during A-01 design whether to add a `variant_agent_tiers` extension point to `workspace-schema.json` or leave it in `variant.json`

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `workspace-schema.json` exists at repo root with canonical phase list and agent tiers | File present and valid JSON |
| AC-02 | `validate-templates.ts` errors if `pm.md` declares phase ownership inconsistent with schema | Test: change `pm.md` to `Can Lead Phases: [0, 1, 2]` — pre-commit should fail |
| AC-03 | `validate-templates.ts` errors if constitution phase count mismatches schema | Test: change §5.4 to "6 phases" — pre-commit should fail |
| AC-04 | `audit.ts` blocks commits containing `bash scripts/*.sh` references | Test: stage a file with `bash scripts/audit.sh` — commit should fail |
| AC-05 | `docs/governance/script-quality-gate.md` exists with security, registration, and test checklists | File present with all three sections |
