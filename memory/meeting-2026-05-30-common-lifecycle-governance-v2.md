# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Common Skills/Agents Lifecycle Governance — Deep Dive (Session 2)
**Participants**: PM, Architect, Lifecycle Manager, Scaffolding Expert
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Governance implications of the common layer — lifecycle management risks
2. Round 2: Override policy design, common-contract.json, and scaffolding merge logic

---

## Round 1: Lifecycle Governance Implications

**PM**: (Round 1 — Open)

This meeting addresses two open questions from Session 1, but frames them as template lifecycle governance design questions rather than implementation checklists. Lifecycle Manager leads.

---

**Lifecycle Manager**: (Round 1)

Creating `templates/common/agents/` is not a folder operation — it is establishing a dependency contract between the common layer and every variant. Once this contract exists, changes to common agents propagate to all variants. This mirrors npm major version upgrades.

Three governance questions must be answered before implementation:

1. **Change propagation scope policy**: When common/agents/pm.md changes, which variants are affected? Can a variant opt out?

2. **Version management policy**: Does common have versioning? Can a variant pin to a specific version of common, or does it always follow latest?

3. **Common boundary declaration**: What is in common vs. variant-specific must be declared in machine-readable form — not just a meeting consensus list. Something like variant-contract.json but for the common layer.

The risk of not answering these: today we put 2 agents in common. In 6 months, someone adds auditor, security-expert, docs-writer. The common layer swells and variants become shells. The reverse risk: every variant overrides everything in common, and common becomes dead code.

---

**Scaffolding Expert**: (Round 1)

Supporting Lifecycle Manager's analysis with a concrete scaffolding risk.

The current new-project.sh copy order (common/ → variant/ overlay) works for file replacement. But if we plan to delete variant pm.md files when they're "identical to common," we need to first verify they're truly identical. Analysis needed:

- co-security/agents/pm.md: has authorization gate sections not in workspace agents/pm.md
- co-develop/agents/pm.md: may have variant-specific dispatch rules
- co-design/agents/pm.md: likely identical to workspace pm.md
- co-work/agents/pm.md: likely identical to workspace pm.md

The `override: true` flag from Session 1 is insufficient. We need to know WHY an override exists and WHAT KIND of override it is — additive (safer) or replacement (riskier).

Risk of override accumulation: if every variant overrides, common is not used. Risk of blind deletion: if we delete co-security's pm.md thinking it can use common, we lose authorization gates that protect users from misuse.

---

**Architect**: (Round 1)

Proposing `common-contract.json` as the machine-readable governance document for the common layer.

```json
{
  "version": "1.0.0",
  "description": "Declares which files are provided by the common layer and their governance rules",
  "common_agents": {
    "pm": { "version": "2.1.0", "overridable": true },
    "lifecycle-manager": { "version": "1.3.0", "overridable": false }
  },
  "common_skills": {
    "project-review": { "version": "1.0.0", "overridable": false },
    "meeting-facilitation": { "version": "1.2.0", "overridable": false },
    "audit-workspace": { "version": "1.0.0", "overridable": false },
    "security-scan": { "version": "1.0.0", "overridable": false },
    "skill-lifecycle-manager": { "version": "1.0.0", "overridable": false },
    "agent-lifecycle-manager": { "version": "1.0.0", "overridable": false }
  }
}
```

Each variant's `variant.json` declares which version of common it inherits and any overrides:

```json
{
  "inherits_common": "1.0.0",
  "agent_overrides": {
    "pm": { "reason": "co-security authorization gates", "since": "2026-05-30" }
  }
}
```

This answers all three governance questions: propagation scope is tracked by version, versioning is explicit semver, boundary is declared in the contract file.

---

**PM**: (Round 1 — Close)

Key insight: common layer introduction creates a dependency contract. common-contract.json makes this contract explicit and machine-readable. Round 2 will design the override policy in detail.

---

## Round 2: Override Policy and Scaffolding Merge Logic

**PM**: (Round 2 — Open)

Lifecycle Manager leads on override policy design. Scaffolding Expert proposes the merge implementation.

---

**Lifecycle Manager**: (Round 2)

Override classification into two types:

**Type A — Additive Override**
Variant keeps all common content and adds variant-specific sections. Example: co-security/agents/pm.md includes all common pm.md content plus `## Authorization Gate` section.
- Safety: high — common changes don't break additive overrides
- Validation: automatic PASS

**Type B — Replacement Override**
Variant changes content from common. Example: modifying dispatch rules.
- Safety: low — common changes may conflict
- Validation: requires lifecycle-manager review and approval

Declaration format in variant.json:

```json
"agent_overrides": {
  "pm": {
    "type": "additive",
    "reason": "co-security authorization gates",
    "added_sections": ["## Authorization Gate", "## Scope Limitation"],
    "since": "2026-05-30",
    "reviewed_by": "lifecycle-manager"
  }
}
```

**Anti-swelling rule**: If ≥50% of variants override the same agent, common definition is wrong — common must be updated rather than accumulating overrides. validate-templates.ts calculates this ratio and warns.

**Anti-hollow rule**: If 0 variants use a common agent without override, and the common definition hasn't changed in 6+ months, flag it as potentially obsolete.

---

**Scaffolding Expert**: (Round 2)

For Additive Override, new-project.sh needs merge logic instead of simple file replacement:

```bash
for agent in common/agents/*.md; do
  agent_name=$(basename $agent)
  if variant has override for $agent_name; then
    if override type is "additive"; then
      # Concatenate: common base + variant additions
      cat "$COMMON_DIR/agents/$agent_name" \
          "$VARIANT_DIR/agents/$agent_name" \
          > "$PROJECT_DIR/agents/$agent_name"
    else
      # Replacement: variant file replaces common
      cp "$VARIANT_DIR/agents/$agent_name" "$PROJECT_DIR/agents/$agent_name"
    fi
  else
    # No override: use common directly
    cp "$COMMON_DIR/agents/$agent_name" "$PROJECT_DIR/agents/$agent_name"
  fi
done
```

With this, co-security/agents/pm.md becomes a SHORT partial file containing only the authorization gate sections. The scaffolded project gets the full pm.md = common base + co-security additions.

For skills: same model applies. Skill overrides are rare but possible (e.g., co-security might want a stricter project-review).

---

**Architect**: (Round 2)

Complete data flow of the governance model:

```
agents/pm.md (L0, workspace SSOT)
  ↓ [publish-to-template.ts with version bump]
templates/common/agents/pm.md (L1, versioned)
  ↓ [common-contract.json records version]
     ↓ [new-project.sh scaffolding]
        ├─ No override → copy common directly
        ├─ Additive override → concatenate common + variant partial
        └─ Replacement override → use variant file (lifecycle-manager approved)
              ↓
        scaffolded-project/agents/pm.md (L2, deployed)
```

Validation chain:
- L0→L1 publish: publish-to-template.ts enforces version bump
- common-contract.json consistency: validate-templates.ts WS-02 check
- Override policy compliance: type declaration + 50% anti-swelling check
- Scaffolding correctness: test-new-project.ts merge result verification

**README answer (final)**: templates/common/agents/ does NOT need README.md. The variant-contract.json README requirement applies only to variant agent directories. Add a `_COMMON.md` file explaining the common layer purpose.

---

**PM**: (Round 2 — Close)

Three core decisions from this session:

1. **Override type classification**: Additive (auto-approved) vs. Replacement (lifecycle-manager approval required), declared in variant.json with structured metadata

2. **common-contract.json**: New governance file declaring common file list, versions, and overridable flags. Separate from variant-contract.json (which governs what must exist) and workspace-schema.json (which governs invariant values)

3. **Scaffolding merge logic**: new-project.sh updated to concatenate common + additive partial for Additive overrides; simple replacement for Replacement overrides

---

## Action Items (Revised from Session 1)

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | scaffolding-expert | Diff all 4 variant pm.md files vs workspace agents/pm.md; classify each as identical/additive/replacement; create partial override files for additive cases | Immediate |
| A-02 | architect | Design and create `templates/common/common-contract.json` with initial common agents (pm, lifecycle-manager) and common skills (6 skills) | Immediate |
| A-03 | automation-engineer | Update variant.json files to declare `inherits_common` and `agent_overrides` with type/reason/sections | After A-01+A-02 |
| A-04 | automation-engineer | Update new-project.sh and new-project.ps1 with additive merge logic | After A-02 |
| A-05 | automation-engineer | Add validate-templates.ts checks: WS-02 (common-contract consistency), override type validation, 50% anti-swelling rule | After A-02 |
| A-06 | lifecycle-manager | Move 6 common skills to templates/common/skills/; delete per-variant duplicates; add _COMMON.md to common/agents/ | After A-04 |
| A-07 | docs-writer | Add common layer governance guide to CONSTITUTION.md §7: override types, common-contract.json, 50% rule | Within 2 weeks |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Override types: Additive vs. Replacement | Additive overrides are safe (common changes don't break them); Replacement overrides risk conflict with future common updates |
| common-contract.json as separate governance file | variant-contract.json governs existence; workspace-schema.json governs invariant values; common-contract.json governs inheritance — three orthogonal concerns |
| 50% anti-swelling rule | If most variants override an agent, the common definition is wrong — fix the source, not the symptoms |
| Scaffolding merge (concatenate) for Additive | Variant partial file stays small; scaffolded projects get full merged file automatically |
| _COMMON.md in common/agents/ | Documents common layer purpose without triggering variant-contract README requirements |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | common-contract.json exists in templates/common/ with typed entries | File present and valid JSON |
| AC-02 | variant.json files declare inherits_common and any agent_overrides with type | All 4 variant.json files have these fields |
| AC-03 | new-project.sh concatenates common+partial for Additive overrides | Scaffolded co-security project has full pm.md with authorization gate |
| AC-04 | validate-templates.ts warns when override 50%+ threshold is exceeded | Test: add same override to 3 of 4 variants → warning |
| AC-05 | CONSTITUTION.md §7 has common governance guide | Section with override types, common-contract.json, 50% rule |
