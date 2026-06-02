# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Variant creation validation process — ensure agent team composition and workflow correctness for new variants
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Previous meeting (2026-06-02, cowork-workflow) identified that co-work's AGENTS.md Phase Summary and pm.md Agent Roster referenced workspace-root agents instead of co-work agents. This meeting addresses the structural recurrence risk: any new variant created by copying existing templates will inherit the same problem unless a validation gate exists.

Current state:
- 4 variants exist: co-design, co-develop, co-security, co-work
- `validate-templates.ts` validates: file presence, frontmatter fields, AGENTS.md link consistency
- NOT validated: Phase Summary ↔ actual agents cross-check, workspace-root agent intrusion, pm.md Agent Roster consistency, handoff chain integrity
- co-design and co-develop AGENTS.md Phase Summaries also reference workspace-root agents — same pattern as co-work

---

## Transcript

### PM (Facilitator Opening)

Topic: structural prevention of agent team/workflow drift when creating new variants.

Three structural gaps identified from pre-meeting analysis:
1. new-project script uses copy-based scaffolding with no post-creation validation gate
2. validate-templates.ts does not cross-check Phase Summary agents against actual agents/ directory
3. No concept of "workspace-root agents forbidden in variants" exists in any validation layer

---

### Architect (Round 1)

Root cause: variant scaffolding copies template files but does not enforce variant-specific customization. No gate exists to catch uncustomized Phase mappings or residual workspace-root agent references.

**Proposed two-layer solution:**

**Layer 1 — Variant Contract Explicit Declaration**

Each variant must explicitly declare:
1. Domain definition (business area this variant addresses)
2. Agent manifest (SSOT for Phase-to-agent mapping)
3. Handoff chain (artifact/output transfer contract between phases)

Proposed file: `templates/<variant>/variant-contract.json`

```json
{
  "variant": "co-work",
  "domain": "content-collaboration",
  "agents": {
    "analyst":            { "phases": [1], "handoff_to": ["content-writer", "technical-writer"] },
    "storyteller":        { "phases": [1, 2], "handoff_to": ["pm"] },
    "content-writer":     { "phases": [3], "handoff_from": ["analyst"] },
    "technical-writer":   { "phases": [3], "handoff_from": ["analyst"] },
    "ms365-expert":       { "phases": [4], "handoff_from": ["content-writer"] },
    "project-coordinator":{ "phases": [4], "handoff_from": ["pm"] }
  },
  "phase_sequence": [0, 1, 2, 3, 4, 5, 6],
  "workspace_root_agents_forbidden": true
}
```

**Layer 2 — Post-scaffolding validation gate**

Add automatic `validate-templates.ts --variant <name>` execution at the end of new-project.ps1/new-project.sh.

Question to Auditor: which missing validation has the highest risk in current validate-templates.ts?

---

### Auditor (Round 1)

Current validate-templates.ts gaps, ranked by risk:

**Critical (not currently validated):**
1. Phase Summary ↔ agents/ cross-validation: agent names in AGENTS.md Phase table not verified against actual agents/ directory. All 4 variants list non-existent agents.
2. Workspace-root agent intrusion detection: no concept of forbidden agents per variant context.
3. pm.md Agent Roster ↔ agents/ cross-validation: Check 5 only validates AGENTS.md, not pm.md internal roster table.

**High (partial or undetected):**
4. Handoff chain validation: no check that handoff_to targets exist as agent files.
5. docs/phase-definitions.md broken link not caught by current validate-docs-links separately.

Architect's variant-contract.json addresses these gaps precisely.

**Concern:** Manual contract file creates synchronization burden. When agents are added/removed, the contract must also be updated — the same "file updated, docs not" failure mode already seen in co-work.

**Alternative proposal — frontmatter as SSOT:**

```yaml
# agents/analyst.md frontmatter
phases: [1]
handoff_to: [content-writer, technical-writer]
handoff_from: [pm]
```

validate-templates.ts aggregates these at runtime to construct the Phase mapping dynamically. Agent files become SSOT; no separate contract file needs to stay synchronized.

Hybrid recommendation: thin variant-contract.json (domain, workspace_root_agents_forbidden, creation checklist) + frontmatter SSOT for all agent-level data.

Question to Architect: agree with hybrid approach? And on scaffolding failure: rollback or warn-and-continue?

---

### Architect (Round 2)

Fully agreed on hybrid approach. Frontmatter as SSOT prevents drift structurally.

**Scaffolding failure behavior — warn-first, optional rollback:**

| Failure Type | Behavior |
|-------------|----------|
| Critical (non-existent agent referenced in Phase table) | Red warning + exit code 1, no rollback |
| Warning (incomplete handoff chain, missing docs link) | Yellow warning only, continue |

Rationale for no rollback: scaffolded project is intentional user output; validation failure ≠ project is invalid; rollback risks data loss.

**Creation checklist in variant-contract.json:**

```json
{
  "creation_checklist": {
    "agents_reviewed": false,
    "phase_mapping_verified": false,
    "workspace_root_agents_removed": false,
    "pm_agent_roster_updated": false,
    "phase_definitions_doc_created": false
  }
}
```

validate-templates.ts emits Warning for any unchecked (false) items. Not fully automated but provides an explicit governance record.

Question to Auditor: integrate new checks into validate-templates.ts or create separate validate-variant.ts?

---

### Auditor (Round 2 / Synthesis)

**Recommendation: integrate into validate-templates.ts.**

Splitting adds cognitive overhead ("which script do I run?") and requires double-wiring in CI. Current validate-templates.ts is structured with Check 1–5 and is designed for extension. Add Check 6 (Phase ↔ agent cross-validation) and Check 7 (workspace-root agent intrusion detection) as natural extensions.

**Points of Agreement:**
1. Agent frontmatter as SSOT: `phases`, `handoff_to`, `handoff_from` are the single source of truth for Phase mapping
2. Thin variant-contract.json: contains only domain declaration, `workspace_root_agents_forbidden: true`, and creation checklist status
3. Validation integrated: 2 new checks added to validate-templates.ts (Phase cross-validation, workspace-root intrusion detection)
4. Post-scaffolding hook: new-project scripts run `validate-templates.ts --variant <name>` automatically after creation; Critical failures return exit code 1 (no rollback)

**Open Question:**
- How does variant-contract.json relate to existing contract files under docs/templates/? Requires investigation before P1 implementation.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | architect | High | Design `variant-contract.json` schema (domain, forbidden agents, creation checklist) | P0 |
| A-02 | automation-engineer | Low | Create initial `variant-contract.json` for all 4 existing variants | P0 |
| A-03 | automation-engineer | Low | Add `phases`, `handoff_to`, `handoff_from` frontmatter to all agents across 4 variants (~24 agent files) | P1 |
| A-04 | automation-engineer | Medium | Add Check 6 and Check 7 to `validate-templates.ts` (Phase cross-validation, workspace-root intrusion detection) | P1 |
| A-05 | automation-engineer | Low | Add post-scaffolding validation step to `new-project.ps1` and `new-project.sh` | P1 |
| A-06 | docs-writer | Medium | Write variant creation guide (`docs/creating-a-variant.md`) with checklist | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `variant-contract.json` exists in all 4 variant folders and passes schema validation | `validate-templates.ts` Check 6 |
| C-02 | All agent files in all variants have `phases`, `handoff_to`, `handoff_from` frontmatter | `validate-templates.ts` Check 6 |
| C-03 | `validate-templates.ts` Check 7 rejects any variant that contains workspace-root agent references in Phase Summary | Script test run |
| C-04 | `new-project.ps1` runs `validate-templates.ts --variant <name>` and returns exit code 1 on Critical failure | Manual test: create variant with intentional error |
| C-05 | Creating a new variant from scratch with all checks passing produces no warnings | End-to-end test |
