# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-consult Integration — L0/L1 Structure Preservation and README Improvement Design
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]**: (Round 1)

Two topics addressed in order.

**Topic 1 — L0/L1 Structure Preservation**

Clarifying definitions: L0 = `templates/common/` (upstream standard), L1 = workspace root `scripts/` (local realization), L2 = creation-time snapshot. `c:\demo\co-consult` is currently an **L2 snapshot state** — `scripts-snapshot.json` and `scripts/helpers/inject-skills.ts` variants array both show L2 independent evolution.

When promoting this demo to `templates/co-consult` (Tier 2), the core principle is: **L2 independent evolution artifacts must NOT be back-propagated to L1.**

| File | L0/L1 Handling |
|------|----------------|
| `scripts/helpers/inject-skills.ts` (demo) | Add co-consult only to L1 (`C:\git\scripts\helpers\inject-skills.ts`) — do not touch demo file |
| `scripts-snapshot.json` | L2 artifact. Correct `variant: co-consult` field only, leave as-is |
| `propagation-map.json` | L2 local config. Verify no conflict with L0 common map before including in templates/co-consult |
| `variant.json` | Tier 2 SSOT — variant itself is the source. Correct and place in templates/co-consult |
| `.claude/template-version.txt` | Tier 2 artifact. Correct to `variant=co-consult` |

**Conclusion**: The only L1 change is adding `'co-consult'` to `C:\git\scripts\helpers\inject-skills.ts`. Demo internal scripts stay as L2 snapshots, independent.

---

**[pm]**: (Round 1)

Agree with Architect's L0/L1 boundary analysis. One additional clarification: `templates/co-consult/scripts/` is a creation-time snapshot of L1 (`C:\git\scripts/`). When copying to templates, no need to modify the demo's inject-skills.ts variants array — new project creation will inject the latest snapshot from L1. Only `scripts-snapshot.json`'s `variant` field requires identity correction to `co-consult`.

**Topic 2 — README Improvement**

User requested: (1) remove "Project-Specific Tools" section, (2) more user-friendly content.

"Project-Specific Tools" is not in README.md itself — it's in `docs/co-consult.context.md` as the "Tool Stack" section (Perplexity, MS Teams, Python, etc.). This section hardcodes specific client environment tools and must be removed from the template — templates should not assume specific client environments.

The current README is already well-structured (Overview, Quick Start, Agents, Available Commands). What specific structural improvements does Architect recommend from a structural perspective?

---

**[architect]**: (Round 2)

The Tool Stack section in `docs/co-consult.context.md` is **incorrectly layered at L2 project customization** — specifying Perplexity or MS Teams at the template level is wrong. Remove this section and replace with a placeholder: *"Add your engagement's specific tools and platforms here."*

**README Structure Improvement Proposal:**

Current README lists "what's in it" rather than "what you can do with it." User-friendly improvements:

| Current | Improvement Direction |
|---------|-----------------------|
| Long feature list in Overview | 3-line summary centered on "What can you do with co-consult?" |
| Technical Quick Start procedure | Day-one user perspective: 1. Open → 2. First request example → 3. First commit |
| Agents table only | Add "When to use" one-liner per agent |
| Commands listed flat | Highlight top 3 most-used commands as "Start here" section |
| (missing) | Add **Skills** section — what triggers each skill and in what situation |

README_ko.md = synchronized translation of README.md with identical structural changes.

**Design decision**: README improvements are Tier 2 SSOT (`templates/co-consult/README.md`). Tool Stack removal from `docs/co-consult.context.md` is a separate concern. docs-writer agent handles README improvement as a dedicated plan step.

---

**[pm]**: (Round 2)

Agreed. README improvement is a clearly separated step in the execution plan.

**Final Agreements — Execution Scope Confirmed:**

**L0/L1 Handling Principle:**
1. Single L1 change: add `'co-consult'` to `C:\git\scripts\helpers\inject-skills.ts`
2. All `scripts/` inside demo = L2 snapshot, no modification including inject-skills.ts
3. Only `scripts-snapshot.json`'s `variant` field changes as identity correction

**README + docs Improvement Scope:**
1. `docs/co-consult.context.md` Tool Stack section → replace with placeholder
2. `README.md` structural rewrite: "What can you do" centered, Agents "when to use" added, "Start here" commands highlighted, Skills section added new
3. `README_ko.md` synchronized translation applied

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Medium | Identity corrections: variant.json, AGENTS.md, scripts-snapshot.json, template-version.txt, docs files | Execution |
| A-02 | automation-engineer | Medium | L1 update: add 'co-consult' to `C:\git\scripts\helpers\inject-skills.ts` variants array | Execution |
| A-03 | scaffolding-expert | Medium | Copy corrected demo → `templates/co-consult` | Execution |
| A-04 | docs-writer | Medium | README.md rewrite (user-friendly structure per plan) + Tool Stack removal from context.md | Execution |
| A-05 | docs-writer | Medium | README_ko.md synchronized Korean translation | Execution |
| A-06 | automation-engineer | Medium | Update `templates/README.md` to add co-consult variant entry | Execution |
| A-07 | lifecycle-manager | Medium | Lifecycle updates | Post-execution |
| A-08 | auditor | Medium | `bun scripts/audit.ts` + `bun run agent:verify` pass | Verification |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `templates/co-consult/` exists with all corrected files | `ls templates/co-consult` |
| 2 | `variant.json` name = "co-consult", 22 skills in skill_manifest | File content |
| 3 | L1 inject-skills.ts includes 'co-consult' in variants array | Grep check |
| 4 | No "co-work" references remain in templates/co-consult (except historical memory logs) | `grep -r "co-work" templates/co-consult --include="*.json" --include="*.md"` |
| 5 | README.md has Skills section + "Start here" commands + "when to use" agents | File content |
| 6 | Tool Stack section replaced with placeholder in context.md | File content |
| 7 | `bun scripts/audit.ts` exits 0 | Audit output |
