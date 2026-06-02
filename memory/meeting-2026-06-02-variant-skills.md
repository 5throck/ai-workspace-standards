# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Skill inclusion strategy for new variant creation — resolving open questions from prior meetings
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Third meeting in a series. Prior meetings:
1. 2026-06-02 cowork-workflow: co-work agent team/workflow drift diagnosed
2. 2026-06-02 variant-validation: structural prevention via variant-contract.json + validate-templates.ts extensions

Open questions from meeting 2:
- How does variant-contract.json relate to existing docs/templates/common-contract.json?
- How should skills be included when creating a new variant?

New findings from pre-meeting analysis:
- variant.json has NO skill declarations (only agent_overrides)
- co-work .gemini/skills/ is missing 3 variant-specific skills (api-documentation, documentation-writing, research-analysis) — parity bug
- skills/ vs .claude/skills/ layer purposes are undocumented
- common-contract.json already declares common_skills — a partial solution exists but skill-agent linkage is absent

---

## Transcript

### PM (Facilitator Opening)

Three structural gaps identified:
1. variant.json has no skill declarations — no variant_skills section exists
2. co-work .gemini/skills/ parity broken: 3 variant-specific skills missing from Gemini layer
3. No skill-agent linkage declared anywhere — analyst's use of research-analysis is implicit knowledge only

---

### Architect (Round 1)

Root cause: skill layer exists in three tiers, but the contract between agents and the skills they require is never declared.

**Proposed: extend variant.json with skill_manifest section (no new file needed)**

This resolves open question from meeting 2: no separate variant-contract.json required. variant.json is already the variant SSOT for agent overrides; extend it for skills.

Relationship to common-contract.json:
- common-contract.json: common layer SSOT (unchanged)
- variant.json: inherits common + declares variant-specific additions

Proposed skill_manifest structure for variant.json:
```json
{
  "skill_manifest": {
    "inherited_from_common": [
      "meeting-facilitation", "audit-workspace", "project-review",
      "skill-lifecycle-manager", "agent-lifecycle-manager",
      "security-scan", "validate-docs-links", "translate",
      "finishing-a-development-branch", "simulate-project-creation",
      "script-lifecycle-manager", "platform-skill-lifecycle-manager",
      "platform-command-lifecycle-manager", "ui-ux-pro-max"
    ],
    "variant_specific": [
      {
        "name": "research-analysis",
        "used_by_agents": ["analyst"],
        "phases": [1],
        "platform_parity": "required",
        "source": ".claude/skills/research-analysis/SKILL.md"
      },
      {
        "name": "documentation-writing",
        "used_by_agents": ["content-writer", "technical-writer"],
        "phases": [3],
        "platform_parity": "required",
        "source": ".claude/skills/documentation-writing/SKILL.md"
      },
      {
        "name": "api-documentation",
        "used_by_agents": ["technical-writer"],
        "phases": [3],
        "platform_parity": "required",
        "source": ".claude/skills/api-documentation/SKILL.md"
      }
    ]
  }
}
```

platform_parity: "required" enables validate-templates.ts to detect .gemini/skills/ gaps.

Question to Auditor: current impact of co-work .gemini/skills/ parity gap? Does validate-templates.ts detect it?

---

### Auditor (Round 1)

**Impact of co-work .gemini/skills/ parity gap:**

| Scenario | Impact |
|----------|--------|
| Gemini CLI user works on co-work project | research-analysis, documentation-writing, api-documentation skills cannot load |
| analyst agent calls /research-analysis | "skill not found" error or silent skip on Gemini CLI |
| PM reviews skill list | .claude/skills/ vs .gemini/skills/ mismatch causes confusion |

**Current validate-templates.ts detection: NO.** Parity between .claude/skills/ and .gemini/skills/ is not checked. Only gemini-parity: skip flagged skills are handled as exceptions. The 3 co-work skills have no such flag — this is a bug.

**Additional finding: skills/ layer purpose is undocumented.**

Inferred layer purposes:
- skills/ → engine-agnostic operational skills (lifecycle management)
- .claude/skills/ → Claude Code platform-specific skills
- .gemini/skills/ → Gemini CLI platform-specific skills (parity with .claude/skills/ required by default)

This distinction needs to be documented in common-contract.json so new variant creators know which layer to use.

Proposal: add layer field to skill_manifest entries + document 3-layer rules in common-contract.json.

Question to Architect: agent frontmatter required_skills vs variant.json used_by_agents — which is SSOT?

---

### Architect (Round 2)

**3-Layer Rule formalization:**

```
Layer A: skills/
  Purpose: AI-engine-agnostic operational skills
  Placement: skills that must work identically across all AI engines
  Examples: agent-lifecycle-manager, meeting-facilitation, skill-lifecycle-manager
  Parity: not required (platform-agnostic)

Layer B: .claude/skills/ + .gemini/skills/
  Purpose: platform-specific skills using Claude Code or Gemini CLI tools
  Placement: skills using platform-specific tool capabilities
  Examples: ui-ux-pro-max, research-analysis, code-review
  Parity: required by default (exception: gemini-parity: skip in frontmatter)
```

Updated skill_manifest with layer field:
```json
{
  "variant_specific": [
    {
      "name": "research-analysis",
      "layer": "platform",
      "used_by_agents": ["analyst"],
      "phases": [1],
      "platform_parity": "required"
    }
  ],
  "workspace_skills": ["meeting-facilitation", "agent-lifecycle-manager", "skill-lifecycle-manager"]
}
```

**Skill selection guide for new variant creators — 3-step process:**

```
Step 1: Check common-contract.json common_skills → 14 auto-inherited skills
Step 2: Analyze agent roles → identify needed domain skills
        analyst → research-analysis
        content-writer, technical-writer → documentation-writing, api-documentation
        (automatable via agent frontmatter required_skills field)
Step 3: Run validate-templates.ts to verify parity and placement
```

**Agent frontmatter required_skills field:**
```yaml
# agents/analyst.md frontmatter
name: analyst
phases: [1]
handoff_to: [content-writer, technical-writer]
required_skills: [research-analysis]
```

Integrates naturally with phases, handoff_to, handoff_from from prior meeting consensus.

Question to Auditor: required_skills in frontmatter vs used_by_agents in variant.json — which is SSOT?

---

### Auditor (Round 2 / Synthesis)

**SSOT decision: agent frontmatter is SSOT; variant.json is aggregated view**

Consistent with prior meeting decisions on phases/handoff fields. If variant.json must be updated every time an agent file changes, sync burden recurs — exactly the failure mode seen in co-work.

Therefore:
- Agent frontmatter required_skills → SSOT (agent declares its own skill dependencies)
- variant.json skill_manifest.variant_specific → contains only layer/platform_parity metadata not belonging to agent files; validate-templates.ts aggregates from frontmatter at runtime

**Points of Agreement:**
1. Open question resolved: no separate variant-contract.json needed. variant.json extended with skill_manifest.
2. common-contract.json relationship: unchanged. common layer SSOT maintained. variant.json = inherit common + declare additions.
3. 3-layer rule formalized: skills/ (engine-agnostic) vs .claude+.gemini/skills/ (platform, parity required) documented.
4. Agent frontmatter required_skills: SSOT for skill-agent linkage. Integrated with phases, handoff_to, handoff_from from prior meetings.
5. co-work .gemini/skills/ parity fix: 3 skills must be added immediately (Critical bug).
6. validate-templates.ts Check 8: .claude/skills/ ↔ .gemini/skills/ parity validation (gemini-parity: skip exception handled).

**Open Question (deferred):**
- Whether variant.json inherited_from_common list is maintained manually or auto-validated by validate-templates.ts reading common-contract.json — automation recommended but script change scope requires investigation.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Low | Add api-documentation, documentation-writing, research-analysis to co-work .gemini/skills/ (parity bug fix) | P0 (immediate) |
| A-02 | architect | High | Finalize variant.json skill_manifest schema + document 3-layer rules in common-contract.json | P0 |
| A-03 | automation-engineer | Low | Add skill_manifest section to variant.json for all 4 existing variants | P1 |
| A-04 | automation-engineer | Low | Add required_skills frontmatter field to agent files (merged with prior meeting A-03) | P1 |
| A-05 | automation-engineer | Medium | Add Check 8 to validate-templates.ts: .claude/skills/ ↔ .gemini/skills/ parity validation | P1 |
| A-06 | automation-engineer | Medium | Add Check 9 to validate-templates.ts: required_skills → actual skill file existence cross-validation | P2 |
| A-07 | docs-writer | Medium | Add skill selection 3-step guide to docs/creating-a-variant.md (merged with prior meeting A-06) | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | co-work .gemini/skills/ contains api-documentation, documentation-writing, research-analysis | ls .gemini/skills/ |
| C-02 | All 4 variant.json files have skill_manifest section with inherited_from_common and variant_specific | validate-templates.ts |
| C-03 | All agent files have required_skills frontmatter (empty list [] if none) | validate-templates.ts Check 9 |
| C-04 | validate-templates.ts Check 8 detects .gemini/skills/ missing skills and reports Critical | Test: remove a .gemini skill |
| C-05 | validate-templates.ts Check 9 detects agent referencing non-existent skill | Test: add fake skill to required_skills |
| C-06 | New variant created with complete skill_manifest passes all checks with no warnings | End-to-end scaffold test |

## Cross-Meeting Consolidation

All three meetings (2026-06-02) produce a unified implementation scope:

| Area | Files Affected | Meetings |
|------|---------------|---------|
| Agent frontmatter extension | ~24 agent files across 4 variants | Meeting 2 + 3 |
| validate-templates.ts | +4 new checks (6, 7, 8, 9) | Meeting 2 + 3 |
| variant.json | skill_manifest section added to 4 files | Meeting 3 |
| pm.md Agent Roster | co-work only, immediate | Meeting 1 |
| AGENTS.md Phase Summary | 4 variants | Meeting 2 |
| .gemini/skills/ parity | co-work 3 skills | Meeting 3 |
| docs/creating-a-variant.md | New file | Meeting 2 + 3 |
| common-contract.json | 3-layer rule documentation | Meeting 3 |
