# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Resolving open question — variant.json inherited_from_common: manual vs auto-validated
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Fourth meeting in a series. Resolves the single open question from meeting 3:
> "Whether variant.json inherited_from_common list is maintained manually or auto-validated by validate-templates.ts reading common-contract.json — automation recommended but script change scope requires investigation."

Pre-meeting findings:
- common-contract.json declares 11 skills (8 common_skills + 3 common_platform_skills)
- templates/common/.claude/skills/ contains 14 skills — 3 undeclared: simulate-project-creation, translate, ui-ux-pro-max
- validate-templates.ts Check WS-02 already reads common-contract.json (infrastructure exists)
- variant.json already has inherits_common: "1.0.0" field (implicit inheritance declaration already present)

---

## Transcript

### PM (Facilitator Opening)

Open question: should variant.json's inherited_from_common list be maintained manually or auto-validated?

Key finding: validate-templates.ts Check WS-02 already reads common-contract.json. Automation infrastructure exists. The remaining question is scope definition.

Additional finding: 3 skills exist in templates/common/.claude/skills/ but are not declared in common-contract.json — the validation baseline is itself incomplete.

---

### Architect (Round 1)

The 3 undeclared skills (simulate-project-creation, translate, ui-ux-pro-max) are a prerequisite problem. Without fixing common-contract.json first, any auto-validation uses an incomplete baseline.

**Two-step proposal:**

Step 1 — Fix common-contract.json completeness first:
Add all 3 undeclared skills to common_platform_skills. This is a prerequisite for Step 2.

Step 2 — Add validate-templates.ts Check WS-03:
```
WS-03: variant.json skill_manifest inherited_from_common auto-validation
  ① Read full common skill list from common-contract.json
  ② Cross-check against variant.json inherited_from_common list
  ③ Skill in common but missing from variant → Warning
  ④ Skill in variant declaration but not in common → Error (typo or misclassification)
```

Check WS-02 vs WS-03 boundary:
- WS-02: common layer internal consistency (contract ↔ actual files)
- WS-03: common ↔ variant inheritance consistency (contract ↔ variant declaration)

Question to Auditor: classification of 3 undeclared skills, and WS-02/WS-03 boundary clarity?

---

### Auditor (Round 1)

**Classification of 3 undeclared skills** (applying 3-layer rule from meeting 3):

| Skill | Current location | Classification | Reason |
|-------|-----------------|----------------|--------|
| simulate-project-creation | Both .claude/ and .gemini/skills/ | common_platform_skills | Platform tool usage, parity exists |
| translate | Both .claude/ and .gemini/skills/ | common_platform_skills | Platform tool usage, parity exists |
| ui-ux-pro-max | Both .claude/ and .gemini/skills/ | common_platform_skills | Platform tool usage, parity exists |

All three belong in common_platform_skills.

**WS-02 / WS-03 boundary: confirmed clear.**
- WS-02 = common layer internal consistency
- WS-03 = common ↔ variant inheritance consistency

**Design question raised:** Should inherited_from_common be explicitly declared in variant.json, or implicitly inherited (field omitted)?

Option A — Explicit declaration:
- Pro: variant creator can see all inherited skills at a glance
- Con: when common skills are added, all variant.json files must be updated — same drift risk as co-work

Option B — Implicit inheritance (field omitted):
- Pro: no variant updates needed when common skills change
- Con: cannot see available skills by reading variant.json alone

Question to Architect: which option is better for variant creator experience?

---

### Architect (Round 2)

**Recommendation: Option B (implicit inheritance).**

This meeting already found 3 skills undeclared in common-contract.json. Explicit inherited_from_common means every common skill addition requires updating all variant.json files — exactly the failure mode seen in co-work.

**Mitigation for Option B:**

1. variant.json already has inherits_common: "1.0.0" — this IS the implicit inheritance declaration. No additional inherited_from_common list needed.

2. validate-templates.ts Check WS-03 uses common-contract.json as SSOT directly — validates that variant's .claude/skills/ folder actually contains common skills, without requiring a manual list in variant.json.

**Final design:**
```
common-contract.json  → common skill SSOT (Step 1: add 3 missing skills for completeness)
variant.json          → inherits_common version pin + variant_specific skills only
validate-templates.ts → WS-03: common-contract × variant cross-validation
                        (works without inherited_from_common list in variant.json)
```

**Resolution status:**
- ✅ Open question from meeting 2: variant-contract.json vs common-contract.json → extend variant.json, no new file
- ✅ Open question from meeting 3: inherited_from_common manual vs auto → implicit inheritance + WS-03 auto-validation

---

### Auditor (Round 2 / Synthesis)

Agreed with Architect's Option B recommendation.

**Points of Agreement:**

1. common-contract.json completeness first (Step 1, P0 prerequisite): add simulate-project-creation, translate, ui-ux-pro-max to common_platform_skills

2. inherited_from_common explicit list is unnecessary: inherits_common: "1.0.0" in variant.json is sufficient as implicit inheritance declaration

3. variant.json skill_manifest declares variant_specific only: common skills are implicitly inherited, not listed

4. Check WS-03 (new): uses common-contract.json as SSOT; cross-validates that variant .claude/skills/ contains common skills; validates variant_specific skill files exist in both .claude/skills/ and .gemini/skills/

5. WS-02 boundary maintained: common layer internal consistency only

6. All open questions from meetings 2, 3, and 4 are now resolved.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | docs-writer | Medium | Add simulate-project-creation, translate, ui-ux-pro-max to common-contract.json common_platform_skills | P0 (prerequisite) |
| A-02 | automation-engineer | Medium | Implement validate-templates.ts Check WS-03: common-contract × variant .claude/skills/ existence cross-validation + variant_specific file parity validation | P1 |
| A-03 | automation-engineer | Low | Finalize variant.json skill_manifest schema: remove inherited_from_common field, declare variant_specific only | P1 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | common-contract.json common_platform_skills contains all 14 skills matching templates/common/.claude/skills/ | Check WS-02 (C-CM-01 extended) |
| C-02 | validate-templates.ts WS-03 detects missing common skill in variant .claude/skills/ | Test: remove one skill from a variant |
| C-03 | validate-templates.ts WS-03 detects variant_specific skill missing from .gemini/skills/ | Test: remove .gemini counterpart |
| C-04 | variant.json contains only inherits_common + skill_manifest.variant_specific (no inherited_from_common list) | Schema validation |

---

## Full Series Resolution Summary

All open questions across 4 meetings (2026-06-02) are now resolved:

| Meeting | Open Question | Resolution |
|---------|--------------|------------|
| Meeting 1 | How to map co-work agents to phases? | 7-phase mapping defined; pm.md Agent Roster fix (P0 A-01) |
| Meeting 2 | variant-contract.json vs common-contract.json? | extend variant.json with skill_manifest; no new file |
| Meeting 2 | docs/phase-definitions.md static or generated? | Static file in template (A-03) |
| Meeting 3 | Agent frontmatter required_skills vs variant.json used_by_agents — SSOT? | Agent frontmatter is SSOT; variant.json is metadata-only view |
| Meeting 4 | inherited_from_common: manual list or auto-validated? | Implicit inheritance; no list; Check WS-03 auto-validates |
| Meeting 4 | 3 undeclared skills in common-contract.json | Add to common_platform_skills (P0 prerequisite) |

## Consolidated Implementation Scope (All 4 Meetings)

| Priority | File/Area | Change | Meeting Origin |
|----------|-----------|--------|----------------|
| P0 | co-work/agents/pm.md | Replace workspace-root Agent Roster with co-work agents | M1 |
| P0 | co-work/.gemini/skills/ | Add 3 missing skills (parity bug fix) | M3 |
| P0 | docs/templates/common-contract.json | Add 3 undeclared skills to common_platform_skills | M4 |
| P0 | variant.json schema | Add skill_manifest.variant_specific + finalize schema | M3+M4 |
| P1 | All 4 variants AGENTS.md | Rewrite Phase Summary with correct variant agents | M1+M2 |
| P1 | All ~24 agent files | Add phases, handoff_to, handoff_from, required_skills frontmatter | M2+M3 |
| P1 | validate-templates.ts | Check 6 (Phase×agent cross), Check 7 (workspace-root intrusion), Check 8 (parity), WS-03 (common×variant) | M2+M3+M4 |
| P1 | new-project.ps1 / .sh | Add post-scaffolding validation step | M2 |
| P1 | All 4 variant.json | Add skill_manifest section (variant_specific only) | M3+M4 |
| P2 | validate-templates.ts | Check 9 (required_skills → file existence) | M3 |
| P2 | docs/creating-a-variant.md | New variant creation guide with 3-step skill selection | M2+M3 |
| P2 | docs/phase-definitions.md | Static file added to template | M2 |
