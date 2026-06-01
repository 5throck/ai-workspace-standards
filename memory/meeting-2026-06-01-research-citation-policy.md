# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Research citation and source verification policy — context.md, new agent creation, all-variant propagation
**Participants**: architect, docs-writer, pm
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

When agents conduct research or investigation, results appear without source citations, making it impossible to verify the information. The user wants:
1. Sources must be cited when research is conducted
2. A double-check mechanism for verifying cited sources
3. This must apply when creating new agents (so future agents inherit this principle)
4. This must propagate to all variants, including future ones

---

## Transcript

### architect (Round 1)
Decomposed requirements into three problems: (1) Policy declaration — where to place the principle; (2) New agent creation — how to automatically reflect this in future agents; (3) Future variant propagation. Identified this as a universal quality standard (not domain-specific). Recommended placing in both `templates/common/docs/context.md` and `AGENTS.md Universal Baseline`. Asked docs-writer whether `agent-lifecycle-manager` skill checklist should include this principle.

### docs-writer (Round 1)
Confirmed: adding to `agent-lifecycle-manager` skill creation checklist is appropriate — current procedure focuses only on structural elements (frontmatter, role definition, AGENTS.md registration). Proposed two scope options: (A) all agents — any agent that references external information must cite sources; (B) research-role agents only — via `research: true` frontmatter flag. Recommended Option A because any agent can present unverified information, and citation is a baseline for trustworthiness. Asked PM for specific behavioral guidelines on citation format and double-check procedure.

### pm (Round 1)
Defined citation format: inline `[Source: URL/document, accessed date]` or `## References` section. Defined double-check procedure: (1) web access confirmation when tools available, (2) if not available — flag as "unverified" and recommend manual verification, (3) prefer primary sources (official docs, academic papers). Noted that future variant propagation is already solved — adding to `templates/common/docs/context.md` automatically propagates via the scaffolding pipeline. Proposed soft detection via audit.ts: WARN (not FAIL) when `docs/research/*.md` lacks a `## References` section. Asked architect about feasibility.

### architect (Round 2)
Confirmed audit.ts check is feasible for small file sets (tens of files). Noted limitation: audit.ts is post-hoc verification; post-write lifecycle hook would be more immediate. Proposed pragmatic approach: automation over proceduralization is not realistic for source verification (URL access and content matching require real-time capability). Recommended 4-layer approach: (1) Principle declaration in context.md + AGENTS.md; (2) Detailed procedure guide in context.md Research Standards section; (3) Agent lifecycle manager skill checklist item; (4) Soft detection in audit.ts (WARN only for docs/research/ files).

### docs-writer (Round 2)
Provided concrete content for each layer. Universal Baseline addition: "Source Attribution: cite all external claims with inline references or ## References section; never present unverified information as fact." Research Standards section content: citation format, verification procedure, uncertainty disclosure with ⚠️ marker. Noted that future variant propagation is automatic since common context.md is the SSOT. Asked PM about PM-level enforcement in execution flow.

### pm (Round 2)
Described PM enforcement point: research task acceptance criteria. Add source section check to AC: `## References section present`, `cited URLs/documents named`, `unverified claims marked ⚠️`. Also proposed adding conditional checklist item to agent-lifecycle-manager skill: "If agent role involves research/investigation: include source citation procedure in role definition and add Source Attribution to agent constraints."

### architect (Round 3)
Finalized implementation scope: 4 files to change. Confirmed future variant propagation is automatic via templates/common/docs/context.md as SSOT. All decisions aligned.

### docs-writer (Synthesis)
This principle is a universal quality standard applying to all agents. 4-layer implementation confirmed. Future variant propagation is automatic. Soft audit.ts check (WARN, not FAIL) for research files.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| E-01 | PM | High | `templates/common/docs/context.md`: add `## Research Standards` section with citation format, verification procedure, uncertainty disclosure |
| E-02 | PM | High | `AGENTS.md` Universal Baseline: add Source Attribution bullet + propagate to workspace root agents area |
| E-03 | PM | Medium | `skills/agent-lifecycle-manager/SKILL.md` (workspace + common): add conditional checklist item for research-role agents |
| E-04 | PM | Low | `scripts/audit.ts`: add WARN check for missing `## References` in `docs/research/*.md` files |

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Apply to ALL agents (not just research-role) | Any agent can present unverified info; citation is baseline trustworthiness |
| WARN not FAIL for audit check | Overly strict enforcement blocks legitimate work; gentle reminder is sufficient |
| Automation over proceduralization | URL verification at write-time is not always feasible; procedure + disclosure is realistic |
| templates/common/docs/context.md as SSOT | Automatic propagation to all future variants without additional work |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | New project scaffolded after this change has Research Standards in context.md | Check docs/context.md in new scaffold |
| AC-02 | New research-role agent created via skill includes citation procedure | Manual test with agent-lifecycle-manager skill |
| AC-03 | audit.ts WARNs when docs/research/*.md lacks ## References | Create test file without References, run audit |
