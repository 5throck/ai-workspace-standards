# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Template lifecycle ↔ Agent/Skill lifecycle integration review and improvement plan
**Participants**: PM (facilitator), Architect, Scaffolding-Expert, Automation-Engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### PM (Opening)

Meeting convened to review how well the Template Lifecycle (Variant Lifecycle) integrates with sub-component lifecycle management (Agent/Skill Lifecycle). Pre-analysis findings:

- VARIANT_LIFECYCLE.md, variant.schema.json, VERSION_REGISTRY.json documentation exists
- agent-lifecycle-audit.ts, skill-lifecycle-audit.ts scripts exist and are called from audit.sh
- validate-templates.ts checks agent file presence and agent-lifecycle-manager skill registration
- variant.json lifecycle fields incomplete vs variant.schema.json (missing statusSince, lastTransition)
- validate-templates.ts does NOT validate variant.json against variant.schema.json
- No automation for agent/skill status change → variant version bump cascade
- security-gate: true frontmatter introduced but no validation logic in validate-templates.ts

---

### Architect (Round 1)

Current architecture in one sentence: each lifecycle layer is well-designed independently, but cross-layer causal relationships are not automated.

Three structural problems:

1. **variant.json schema non-compliance**: variant.schema.json declares `statusSince` and `lastTransition` as required in the lifecycle object. All variant.json files are missing these fields. validate-templates.ts does not actually read and validate against variant.schema.json, so the mismatch passes silently.

2. **No cascade lifecycle event definition**: One-way sync exists (agent status → AGENTS.md via sync-agent-status.ts; skill status → docs/context.md via sync-skill-status.ts), but no rule states that these changes should trigger a variant version bump. When an agent is deprecated, at minimum a patch bump (x.x.N+1) should occur and VERSION_REGISTRY.json should be updated.

3. **security-gate: true validation not implemented**: VARIANT_CONTRACT.md has the rule, but validate-templates.ts has no actual check.

Question to Scaffolding-Expert: Does validate-templates.ts currently parse skill frontmatter? How well does adding security-gate: true placement check fit existing patterns?

---

### Scaffolding-Expert (Round 1)

Agree with all three diagnoses. Answer to Architect: validate-templates.ts does iterate skill directories and partially parses SKILL.md frontmatter. Adding a security-gate field check is low-complexity work, fully consistent with existing patterns.

More fundamental scaffolding problem: **variant.json lifecycle fields are not correctly initialized on new project creation**. new-project.sh does a simple directory copy, so hardcoded dates in template variant.json are copied as-is to new projects, undermining lifecycle tracking meaning.

new-project.sh already handles some date substitutions. Adding substitution for variant.json lifecycle.statusSince to the project creation date is 2-3 lines.

Question to Automation-Engineer: Do sync-agent-status.ts and sync-skill-status.ts support targeting a specific directory? Is there a --target flag?

---

### Automation-Engineer (Round 1)

Confirming the code: both sync-agent-status.ts and sync-skill-status.ts hardcode cwd() as the target. No --target flag exists. Running against template directories requires changing the working directory manually, which is impractical for automation pipelines.

Larger problem: **audit.sh lifecycle checks only run against the current project**. validate-templates.ts targets templates, but audit.sh's agent-lifecycle-audit and skill-lifecycle-audit calls only run from the workspace root. Template-internal agent/skill lifecycle goes unvalidated.

validate-templates.ts should either call agent-lifecycle-audit.ts and skill-lifecycle-audit.ts with variant directory as cwd for each variant, or inline their logic. The second approach is more robust — validate-templates.ts already iterates all variants, so running agent/skill validation inside that loop is natural.

Question to Architect: What is the intended role of VERSION_REGISTRY.json — a documentation artifact or a machine-readable source of truth for validate-templates.ts? If the latter, the relationship with variant.json needs clarification first.

---

### Architect (Round 2)

Clear answer: **variant.json is the source of truth; VERSION_REGISTRY.json is an aggregated view**. Each variant's status and version must be declared in variant.json; VERSION_REGISTRY.json should be a derived document. Currently both are managed manually, creating inconsistency risk. The correct architecture is for validate-templates.ts to auto-update VERSION_REGISTRY.json after validation.

Full integration architecture:

```
[Agent file status change]
       ↓
sync-agent-status.ts --target <variant>
       ↓
AGENTS.md update + variant version bump record
       ↓
[Skill file status change]
       ↓
sync-skill-status.ts --target <variant>
       ↓
docs/context.md update + variant version bump record
       ↓
validate-templates.ts (including variant.schema.json validation)
       ↓
VERSION_REGISTRY.json auto-update
```

Priority: variant.json schema compliance (add statusSince, lastTransition) + validate-templates.ts schema validation = P0. security-gate check + --target flag = P1. VERSION_REGISTRY.json auto-update + cascade version bump = P2.

---

### Scaffolding-Expert (Round 2)

Agree with architecture. Concrete variant.json fix:

```json
// co-develop, co-design, co-work (stable)
"lifecycle": {
  "statusSince": "2026-05-28",
  "lastTransition": "initial → stable on 2026-05-28",
  "stablePromotedOn": "2026-05-28"
}

// co-security (beta)
"lifecycle": {
  "statusSince": "2026-05-28",
  "lastTransition": "draft → beta on 2026-05-28",
  "betaPromotedOn": "2026-05-28",
  "betaEngagements": 0
}
```

For new-project.sh: already has date variable (PROJECT_DATE). Adding sed substitution for variant.json lifecycle.statusSince is 2-3 lines.

Suggestion to Automation-Engineer: validate-templates.ts already reads and parses variant.json. Add lifecycle field check using existing code — manual field presence check (no ajv needed) satisfies P0 requirements. Simple: `if (!lifecycle.statusSince || !lifecycle.lastTransition) → fail`.

---

### Automation-Engineer (Round 2)

Agree with minimal approach. No ajv needed — validate-templates.ts already JSON.parses variant.json, so one conditional check suffices.

Final prioritized action item list:

P0 (immediate): B-01 add statusSince+lastTransition to all variant.json, B-02 add lifecycle field validation to validate-templates.ts, B-03 add security-gate skill placement check to validate-templates.ts.

P1 (next PR): B-04 add --target flag to sync scripts, B-05 inline agent/skill lifecycle validation in validate-templates.ts loop, B-06 new-project.sh lifecycle date substitution.

P2 (structural PR): B-07 auto-update VERSION_REGISTRY.json from validate-templates.ts, B-08 cascade version bump policy and implementation.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| B-01 | automation-engineer | Add `statusSince` + `lastTransition` to all 4 variant.json files | P0 |
| B-02 | automation-engineer | Add lifecycle field existence validation to `validate-templates.ts` | P0 |
| B-03 | automation-engineer | Add `security-gate: true` skill placement check to `validate-templates.ts` | P0 |
| B-04 | automation-engineer | Add `--target <dir>` flag to `sync-agent-status.ts` and `sync-skill-status.ts` | P1 |
| B-05 | automation-engineer | Inline agent/skill lifecycle validation inside `validate-templates.ts` variant loop | P1 |
| B-06 | scaffolding-expert | Add `variant.json` `statusSince` date substitution to `new-project.sh` / `.ps1` | P1 |
| B-07 | automation-engineer | Auto-update `VERSION_REGISTRY.json` from `validate-templates.ts` after validation | P2 |
| B-08 | architect | Document + implement agent/skill deprecated → variant patch version bump cascade | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | All variant.json files pass variant.schema.json validation | `validate-templates.ts` reports 0 lifecycle errors |
| AC-02 | validate-templates.ts errors when security-gate skill found in .claude/skills/ | Add verify-authorization to .claude/skills/ and confirm it fails |
| AC-03 | New project creation sets statusSince to today's date | Create test project, verify variant.json.lifecycle.statusSince = creation date |
| AC-04 | validate-templates.ts runs agent/skill lifecycle audit per variant | Introduce an orphaned agent in a template; confirm validate-templates.ts catches it |

## Open Questions

- Whether CHANGELOG.md entries should be auto-generated on cascade version bump — Architect to decide in B-08 design phase.
