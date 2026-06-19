# Meeting Transcript
**Date**: 2026-06-19
**Topic**: Cross-variant agent similarity analysis, consolidation, and agent registration with version management
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect** (Round 1):

In the current L0/L1/L2 architecture, agent file locations are: L0 = workspace root `agents/` (common agents: pm, architect, auditor, etc.), L2 = each variant's `templates/co-*/agents/` (specialized agents). L1 (`templates/common/agents/`) currently has no agents — this is the core gap today's discussion addresses.

Once Wave 1.5 completes, all variant agents will share the same 7-section structure (Role, PM-ONLY INVOCATION, Responsibilities, Output Format, Constraints, Meeting Participation, Dispatch Protocol). From that point, comparison becomes meaningful.

For similarity evaluation, the **Role declaration** + **Responsibilities** sections are the key signals. For example, `data-analyst` in co-consult, co-security, and a future co-work variant likely overlap 80%+ in role declaration. In such cases, promoting to L1 as a shared agent with variant-specific overrides (the `variant_overrides` pattern already validated in pm.md) is the right structure.

Question for automation-engineer: for similarity measurement, should we use text-based (Levenshtein, Jaccard) or section-by-section structural comparison — what's your view on implementation complexity vs. reliability?

**automation-engineer** (Round 1):

Responding to architect's question directly: I recommend **section-by-section structural comparison over raw text-based**. Three reasons:

First, agent files will have a normalized 7-section structure, so sections can be compared independently. Extracting just the `## Role` section text for comparison eliminates noise (format differences, line breaks). Second, implementation is straightforward — `normalize-agent-skills.ts` already has the `AGENT_REQUIRED_SECTIONS` constant, and adding a section-text extractor parser on top is minimal work. Third, reliability is higher — "data-analyst Role declaration is 85% similar" is far more actionable than "files are 72% similar overall."

Concrete pipeline: write `scripts/helpers/agent-similarity-analyzer.ts` → iterate variant pairs → compute per-section Jaccard similarity → flag as "consolidation candidate" when Role + Responsibilities simultaneously ≥ 80% → output `_agent_consolidation_report.md`.

Before passing to auditor: on the registry issue, if we create an agent registry like the SCRIPTS.md pattern, we need to track ownership and version per L0/L1/L2. But pm.md's `extends:` chain already solves a similar problem. The agent registry could start simply with `source:` + `version:` fields in the frontmatter.

**auditor** (Round 1):

Both have hit the key points. On governance risk — **drift management after consolidation is more dangerous than the consolidation itself**.

The current SCRIPTS.md registry has a clear unidirectional flow: "L0 is SSOT, L1 is snapshot." Promoting agents to L1 requires applying the same principle, but the problem is **when variants want to modify an L1 agent**. pm.md's `variant_overrides:` handles YAML-level overrides, but if the Role section body needs to differ per variant, the current structure doesn't cover that.

Three governance rules must be defined upfront:
1. **Promotion Gate**: Only eligible for L1 promotion when Role + Responsibilities are 80%+ identical across 3+ variants
2. **Freeze Policy**: L1 agents modifiable only by workspace maintainer; variants customize via `agent_overrides:` YAML block only
3. **audit.ts check**: When an L2 agent `extends` an L1 agent, verify L1 version and L2 local override match the registry

For registry format, starting simply with frontmatter `source: L1` + `version: 1.0.0` as automation-engineer suggested is fine, but adding columns to the existing `AGENTS.md` rather than creating `AGENTS-REGISTRY.md` avoids file proliferation.

### Round 2

**architect** (Round 2):

I agree with auditor's drift management point and want to make the Freeze Policy more concrete. pm.md's `extends:` chain does YAML-level merging, but agent body sections are Markdown, so "section-level override" is needed. Proposal: insert `<!-- VARIANT-SECTION: role -->` markers in L1 agent bodies, and allow L2 to replace only sections with those markers — reusing the already-validated VARIANT-SECTION pattern from pm.md.

For version management, applying the same structure as SCRIPTS.md to AGENTS.md with three added columns — `source (L0/L1/L2)`, `version`, and `promoted-from (variant name)` — is sufficient. `promoted-from` records the variant where the common pattern was first identified.

Question for automation-engineer: the similarity analyzer output should probably be staged in waves. Stage 1 is report generation only (read-only), Stage 2 is automated promotion execution after human approval. What's your view on automation scope?

**automation-engineer** (Round 2):

I strongly agree with architect's staged approach. Automation scope should be: **Stage 1 (analysis report) fully automated, Stage 2 (promotion execution) semi-automated with mandatory human gate**.

The reason is practical — even 80% similarity may mean the remaining 20% is the variant's core differentiation. If co-security's `analyst` agent has a Constraint of "all analysis must include CVE references," including that in the L1 common version imposes unnecessary constraints on co-consult.

Proposed implementation schedule:

- **Wave 2a** (immediately after Wave 1.5): Write `agent-similarity-analyzer.ts` → generate `_agent_consolidation_report.md`. Two thresholds: High-confidence ≥ 85% (mark as auto-promotion candidate), Medium-confidence 70–84% (mark as review-needed).
- **Wave 2b** (after human approval): Write `agent-promote.ts` → move High-confidence candidates to L1, update AGENTS.md, insert `extends: l1/<name>` pointer in L2.
- **Wave 2c** (audit.ts extension): Verify L2 `extends:` pointers reference valid L1 agents and that versions match the registry.

On auditor's "3+ variant" promotion criterion: with 6 variants currently (co-develop, co-consult, co-design, co-security, co-deck, co-work), 3/6 = 50% threshold seems appropriate.

### Synthesis

**auditor** (Synthesis):

Summarizing key agreements and open questions from the discussion.

**Points of Agreement:**

1. **Wave separation strategy** — Separate analysis (read-only) from promotion (execution) into staged phases. Stage 1 report is fully automated, Stage 2 promotion requires a human gate.
2. **Section-level override mechanism** — Apply VARIANT-SECTION markers (existing pm.md pattern) to L1 agents so variants can replace specific sections only.
3. **Similarity criteria** — Role + Responsibilities Jaccard ≥ 80%, occurring simultaneously in 3+ variants.
4. **Registry location** — Add `source`, `version`, `promoted-from` columns to existing AGENTS.md rather than creating a new file.
5. **audit.ts extension** — Add L2 `extends:` pointer validity check and registry version match verification.

**Open Disagreements / Unresolved Questions:**

- **Override depth**: VARIANT-SECTION supports full-section replacement but not partial overrides within a section (e.g., adding one Constraint line). Whether to allow partial override remains undecided.
- **agent_overrides YAML format**: Whether to reuse pm.md's `variant_overrides:` schema directly or define an agent-specific schema.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | `scripts/helpers/agent-similarity-analyzer.ts` v1.0.0 — per-section Jaccard scoring + `_agent_consolidation_report.md` output | Both | Wave 2a (after Wave 1.5 completes) |
| A-02 | architect | High | L1 agent format spec document — VARIANT-SECTION marker spec, `agent_overrides:` YAML schema, `extends:` pointer syntax | Both | Wave 2a |
| A-03 | automation-engineer | Medium | `scripts/helpers/agent-promote.ts` v1.0.0 — execute L1 promotion for High-confidence candidates, update AGENTS.md | Both | Wave 2b (after human approval) |
| A-04 | auditor | Medium | `audit.ts` extension — L2 `extends:` pointer validity check, AGENTS.md registry version match verification | Both | Wave 2c |
| A-05 | architect | Medium | ADR — L1 agent layer introduction rationale, drift management policy, Freeze Policy documentation | L0-only | Wave 2a |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | Report correctly identifies known-similar agents across variants | Manual spot-check against co-develop/co-consult agent pairs |
| A-02 | Spec covers all three override scenarios (full-section, YAML-field, none) | Reviewed by architect + auditor before Wave 2b begins |
| A-03 | Promoted agent appears in L1; L2 has valid `extends:` pointer; AGENTS.md updated | `bun scripts/audit.ts` passes after promotion |
| A-04 | audit.ts fails on broken `extends:` pointer or version mismatch | Unit test with intentionally broken pointer |
| A-05 | ADR approved and merged to `docs/adr/` before Wave 2b execution | PR review |
