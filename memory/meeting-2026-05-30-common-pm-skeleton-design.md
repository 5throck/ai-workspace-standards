# Meeting Transcript
**Date**: 2026-05-30
**Topic**: common/agents/pm.md Skeleton Design — Reestablishing Common Baseline Methodology
**Participants**: PM, Architect, Lifecycle Manager, Scaffolding Expert
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Why the current common/agents/pm.md is wrong — skeleton concept
2. Round 2: Correct process for skeleton creation and section-level merge logic

---

## Round 1: Diagnosis and Skeleton Concept

**PM**: (Round 1 — Open)

Two problems to address:
1. Process defect: common was created FROM co-design, then variants were compared AGAINST co-design. The correct order is reversed.
2. Fundamental design direction from user: common/agents/pm.md should be a skeleton containing only universally shared structure and behavior, not a copy of any specific variant.

---

**Lifecycle Manager**: (Round 1)

Current common/agents/pm.md contains co-design-specific content:
- Governance Workflow mentions "designer" agent (co-design only)
- Agent Roster lists co-design's specific agents

A skeleton must contain only invariant content — content that would apply to any future variant (co-finance, co-research, co-legal), not just the current four.

Three things belong in a skeleton:
1. Frontmatter structure (with placeholders for variant-specific values)
2. Core role declaration principles (invariant: "PM orchestrates, does not execute directly")
3. Section structure (invariant headers with placeholder content for variant-specific sections)

What must NOT be in the skeleton: agent roster, specific phase task descriptions, variant-specific dispatch rules.

---

**Scaffolding Expert**: (Round 1)

Supporting Lifecycle Manager. Proposes two-layer skeleton structure:
- **Invariant sections**: full content (e.g., Dispatch Protocol principles, T-02/T-03 triggers)
- **Placeholder sections**: marked with `<!-- VARIANT-SECTION: section-name -->` comment blocks

Section-level substitution (not simple concatenation) is needed for merge logic:
```markdown
## Agent Roster
<!-- VARIANT-SECTION: agent-roster -->
<!-- Replace this section with your project's agent roster table -->
<!-- END VARIANT-SECTION -->
```

---

**Architect**: (Round 1)

Core design principle: "common" means content that remains unchanged for ALL current AND FUTURE variants — not just the most-shared content among current variants.

Classified for PM:

**Invariant (all present and future variants):**
- PM role principles: "orchestrates only, does not execute"
- T-02/T-03 trigger conditions
- 7-phase numbering (references phase-definitions.md)
- 3-tier model strategy
- Meeting Facilitation principles

**Variant-specific (each variant must provide):**
- Agent Roster
- Governance Workflow phase details (which agents do what)
- Dispatch Protocol agent list

---

**PM**: (Round 1 — Close)

Agreed: skeleton = invariant principles + variant placeholders. Round 2 covers the correct creation process and section-level merge implementation.

---

## Round 2: Correct Process and Merge Logic

**PM**: (Round 2 — Open)

Lifecycle Manager leads on the correct skeleton creation process.

---

**Lifecycle Manager**: (Round 2)

Correct 5-step process (correcting the previous work's inverted order):

**Step 1 — Bottom-up intersection extraction**
Extract content common across all 4 variant pm.md files. "Identical in all 4 variants" is the invariant candidate (ignoring encoding artifacts and minor wording differences).

**Step 2 — Future-resilience filter (top-down)**
From Step 1 intersection, filter: "Would this apply unchanged to a future co-finance or co-research variant?" Only what passes this filter becomes invariant content.

**Step 3 — Write the skeleton**
Invariant sections get real content. Variant-specific sections get placeholder markers. This is `common/agents/pm.md`.

**Step 4 — Review each variant**
Remove from each variant's pm.md sections that are identical to the skeleton. What remains is variant-specific content, declared as `agent_overrides`.

**Step 5 — Establish comparison baseline**
NOW `common/agents/pm.md` is the comparison baseline. WS-02 C-AG-01 compares variants against this skeleton. Duplicate invariant sections in variants trigger warnings.

Only after these 5 steps can we say "a variant's pm.md can be deleted."

---

**Scaffolding Expert**: (Round 2)

Section-level merge logic for new-project.sh:

```
Skeleton sections:
  ## PM Role Principles    → copy as-is to all projects
  ## Agent Roster          → VARIANT-SECTION marker → replaced by variant content
  ## Governance Workflow   → VARIANT-SECTION marker → replaced by variant content

Variant pm.md (additive type):
  ## Agent Roster          → this section replaces the skeleton placeholder
  ## Governance Workflow   → this section replaces the skeleton placeholder
```

Standardized placeholder marker format:
```markdown
## Agent Roster
<!-- VARIANT-SECTION: agent-roster -->
<!-- Replace this section with your project's agent roster table -->
<!-- END VARIANT-SECTION -->
```

new-project.sh parses these markers: if variant has the section, substitute; if not, remove markers and leave empty section.

---

**Architect**: (Round 2)

Final skeleton structure for `common/agents/pm.md`:

```markdown
---
name: pm
status: active
# tier, description, examples: variant-specific, will be overridden
---

## Role Principles          ← INVARIANT: "PM orchestrates, does not execute"
## Proactive Review Triggers (T-02)  ← INVARIANT: structural change detection
## QA Self-Check Trigger (T-03)      ← INVARIANT: audit threshold

## Agent Roster             ← VARIANT-SECTION: each variant fills this
## Governance Workflow      ← VARIANT-SECTION: phase tasks vary by variant
## Dispatch Protocol        ← VARIANT-SECTION: agent list varies by variant

## Meeting Facilitation     ← INVARIANT: PM as facilitator principles
## Constraints              ← INVARIANT: "follow CONSTITUTION.md" etc.
```

`common-contract.json` addition:
```json
"common_agents": {
  "pm": {
    "skeleton_sections": [
      "Role Principles",
      "Proactive Review Triggers",
      "QA Self-Check Trigger",
      "Meeting Facilitation",
      "Constraints"
    ],
    "variant_sections": [
      "Agent Roster",
      "Governance Workflow",
      "Dispatch Protocol"
    ]
  }
}
```

validate-templates.ts can then verify invariant sections are identical across all variant pm.md files, and variant sections have project-specific content.

---

**PM**: (Round 2 — Close)

Core conclusion: current common/agents/pm.md (co-design copy) must be replaced.
Correct method: bottom-up intersection + top-down future-resilience filter.
Process defect corrected: "common first, then compare variants" — never the reverse.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | lifecycle-manager | Execute 5-step skeleton creation: (1) extract 4-variant intersection, (2) future-resilience filter, (3) write skeleton with VARIANT-SECTION markers, (4) review variants, (5) update variant.json overrides | Immediate |
| A-02 | architect | Update common-contract.json: add skeleton_sections and variant_sections arrays to pm agent entry | After A-01 |
| A-03 | automation-engineer | Update new-project.sh/.ps1: implement section-level substitution using VARIANT-SECTION markers | After A-01 |
| A-04 | automation-engineer | Update validate-templates.ts: add check that skeleton invariant sections are identical across all variant pm.md files | After A-01+A-02 |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Skeleton = invariant + placeholders | "Common" means unchanged for all present AND future variants, not just most-shared among current variants |
| Bottom-up + top-down filter | Bottom-up finds current intersection; top-down applies future-resilience test |
| VARIANT-SECTION markers | Enable machine-parseable section-level substitution during scaffolding |
| common first, compare second | Correct process order: establish baseline before measuring against it |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | common/agents/pm.md contains only invariant sections and VARIANT-SECTION placeholders | No co-design-specific agent names or phase tasks in skeleton |
| AC-02 | Each variant pm.md contains only variant-specific sections (no duplication of skeleton invariants) | diff variant pm.md against skeleton shows only variant content |
| AC-03 | Scaffolded project from any variant has complete pm.md (skeleton invariants + variant sections merged) | Run new-project.sh, verify pm.md has no VARIANT-SECTION markers |
| AC-04 | validate-templates.ts detects invariant section mismatch across variants | Test: modify invariant section in one variant → warning appears |
