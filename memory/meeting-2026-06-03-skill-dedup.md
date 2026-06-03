# Meeting Transcript
**Date**: 2026-06-03
**Topic**: common/variant Skill Duplication Diagnosis and Cleanup Direction
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Current State (Data)

### Common skills (templates/common/skills/)
agent-lifecycle-manager, audit-workspace, meeting-facilitation, project-review,
script-lifecycle-manager, security-scan, skill-lifecycle-manager, team-builder, translate,
ui-ux-pro-max, validate-docs-links

### Duplicates per variant
- co-develop/co-design/co-work/co-security: agent-lifecycle-manager, meeting-facilitation, skill-lifecycle-manager (3 each)
- co-consult: agent-lifecycle-manager, audit-workspace, meeting-facilitation, project-review, script-lifecycle-manager, security-scan, skill-lifecycle-manager, translate, validate-docs-links (9 total)

### Version drift found
- meeting-facilitation: common = v1.3.2, all variants = v1.0.0 (OUTDATED)
- skill-lifecycle-manager: common = v1.2.0, all variants = v1.0.0 (OUTDATED)
- agent-lifecycle-manager: all v1.0.0 but content differs (variant-specific descriptions)

---

## Transcript

**[architect]**: (Round 1)

Data-based classification reveals two distinct types, not simply "duplicates":

**Type A — Version Drift (stale copy)**
`meeting-facilitation` and `skill-lifecycle-manager`. Common is v1.3.2 and v1.2.0 respectively; all variants carry v1.0.0. Content also differs — common is current, variant copies are outdated. This is a management failure. Per L2 snapshot policy, no auto-update occurs after project creation, so variants with these files will permanently deliver outdated versions to new L2 projects.

**Type B — Intentional Variant Customization (intentional override)**
`agent-lifecycle-manager`. Common version has generic description; each variant version contains variant-specific content (e.g., "how to create agents in the co-develop variant"). This is an intentional override — correct design.

**Type C — co-consult Over-copy**
co-consult imported 6 infrastructure skills during demo copy: `audit-workspace`, `project-review`, `script-lifecycle-manager`, `security-scan`, `translate`, `validate-docs-links`. No variant-specific content — pure common skills duplicated.

Proposed handling: Type A = delete from variants (rely on common), Type B = keep + register in variant.json, Type C = delete from co-consult.

---

**[pm]**: (Round 1)

Agree with 3-type classification. Key point on Type B variant.json registration: `skill_manifest.variant_specific` currently registers variant-unique skills. `agent-lifecycle-manager` exists in common but with different content — must be registered as `override` type. Otherwise validate-templates.ts may false-positive it as an accidental duplicate.

L2 impact of Type A deletion: existing L2 projects are unchanged (creation-time snapshots). Only future new L2 projects benefit. This must be clearly documented.

`co-security`'s `verify-authorization` skill is pure variant-unique — no changes needed.

Execution priority: Type C (co-consult only) first (lowest risk), then Type A (4 variants × 2-3 skills), then Type B registration.

---

**[architect]**: (Round 2)

Note on `project-review` in co-consult: the only difference is `co-consult` added to the project type enum. Correct resolution: update common version's enum to include `co-consult`, then delete co-consult's copy. Treat as Type C with common version pre-update.

**Final Execution Matrix:**

| Type | Target | Action | Scope |
|------|--------|--------|-------|
| A | `meeting-facilitation` v1.0.0 | Delete from co-develop/co-design/co-work/co-security/co-consult | 5 variants |
| A | `skill-lifecycle-manager` v1.0.0 | Delete from co-develop/co-design/co-work/co-security/co-consult | 5 variants |
| B | `agent-lifecycle-manager` | Keep + register as override in each variant.json | 5 variant.json files |
| C | `audit-workspace`, `script-lifecycle-manager`, `security-scan`, `translate`, `validate-docs-links` | Delete from co-consult | 1 variant |
| C+ | `project-review` (co-consult) | Update common version enum (add co-consult), then delete co-consult copy | common + 1 variant |

---

**[pm]**: (Round 2)

Agreed on all points.

**Final Agreements:**
1. **Type A (delete)**: `meeting-facilitation`, `skill-lifecycle-manager` — remove from all 5 variants
2. **Type B (keep + register)**: `agent-lifecycle-manager` — retain in all 5 variants, register `"type": "override"` in each variant.json skill_manifest
3. **Type C (delete + common update)**: co-consult's 6 infrastructure skills removed; `project-review` common version updated with co-consult enum first
4. **No impact on existing L2 projects** — applies to future new project creation only

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Medium | Delete `meeting-facilitation/` from co-develop/co-design/co-work/co-security/co-consult | Execution |
| A-02 | automation-engineer | Medium | Delete `skill-lifecycle-manager/` from co-develop/co-design/co-work/co-security/co-consult | Execution |
| A-03 | automation-engineer | Medium | Add `agent-lifecycle-manager` override entry to each of 5 variant.json skill_manifest sections | Execution |
| A-04 | automation-engineer | Medium | Update `templates/common/skills/project-review/SKILL.md` enum: add `co-consult` to project type list | Execution |
| A-05 | automation-engineer | Medium | Delete 6 infrastructure skills from co-consult: audit-workspace, project-review, script-lifecycle-manager, security-scan, translate, validate-docs-links | Execution |
| A-06 | auditor | Medium | Run `bun scripts/audit.ts` + `bun scripts/validate-templates.ts` to confirm no regressions | Verification |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | meeting-facilitation absent from all 5 variant skills/ dirs | ls check |
| 2 | skill-lifecycle-manager absent from all 5 variant skills/ dirs | ls check |
| 3 | agent-lifecycle-manager still present in all 5 variant skills/ dirs | ls check |
| 4 | Each variant.json has agent-lifecycle-manager in skill_manifest with type=override | JSON check |
| 5 | co-consult skills/ contains only variant-specific consulting skills + agent-lifecycle-manager | ls check |
| 6 | common/skills/project-review enum includes co-consult | File check |
| 7 | bun scripts/audit.ts exits 0 | Audit output |
