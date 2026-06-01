# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Socratic method as mandatory educational interaction standard — context.md policy
**Participants**: architect, pm, docs-writer
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

The user wants context.md to require the Socratic method (guided questioning) for educational interactions, applicable across all variants including future ones.

---

## Transcript

### architect (Round 1)
Identified ambiguity: "educational activity" scope needs definition. Proposed spectrum: (1) explicit education ("teach me X"), (2) implicit education (user reveals misunderstanding), (3) coaching, (4) simple information lookup. Warned that applying Socratic method to all information requests would harm UX — user asking "what is X syntax?" shouldn't get questions back. Key design decision: when to apply vs. when not to apply.

### docs-writer (Round 1)
Distinguished high-value vs. low-value Socratic scenarios. High value: concept understanding verification, critical thinking development, misconception correction, deep learning requests, problem-solving coaching. Low value: simple fact lookup, time-critical situations, confirmation requests, reference lookups. Proposed core principle: "Use questions instead of answers when the learner can discover the answer themselves; use direct answers when time or context constraints make discovery impractical." Asked PM for agent trigger conditions.

### pm (Round 1)
Defined triggers FOR Socratic method: explicit learning intent keywords (teach/explain/understand/why/how), misconception detected in user's statement, concept verification request, repeated mistake pattern. Defined triggers AGAINST: urgent/operational context, simple fact/API/syntax lookup, explicit request for direct answer. Defined 4-step procedure: assess understanding → guide with questions → validate progress → reveal answer only when necessary. Raised design question: universal policy vs. variant-specific (currently no education-specialized variant).

### architect (Round 2)
Analyzed common vs. variant-specific tradeoff. Common: applies everywhere but risks over-triggering in operational contexts. Variant-specific: precise but no education variant exists yet. Proposed Option 3: add to common context.md with strict conditional application — educational contexts occur in any variant (team training in co-work, junior developer coaching in co-develop). Recommended ## Educational Interaction Standards section with trigger conditions placed prominently at the top.

### docs-writer (Round 2)
Agreed with Option 3. Provided full document structure: section with "When to Apply" (explicit learning intent, concept verification, misconception, deliberate practice), "When NOT to Apply" (urgent context, fact lookup, explicit direct request), 5-step Socratic procedure, example exchange pattern. Structure consistent with Research Standards and Computational Integrity Standards.

### pm (Round 2)
Added two implementation points: (1) agent-lifecycle-manager skill checklist item for education/tutoring/coaching role agents; (2) AGENTS.md Universal Baseline one-liner. Confirmed three insertion points matching prior standards pattern.

### architect (Round 3)
Decided placement: ## Educational Interaction Standards before ## Research Standards (interaction method → information reliability → computational reliability → file organization is logical order). Flagged growing context.md risk: three Standards sections added today may overwhelm agents reading the file. Recommended future refactoring: group all three under ## Quality & Integrity Standards parent section.

### docs-writer (Synthesis)
Confirmed policy: conditional Socratic method in all variants, strict trigger conditions, direct answer exceptions clearly listed. Three implementation points. Future refactoring noted as G-04.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| G-01 | PM | High | `templates/common/docs/context.md`: add `## Educational Interaction Standards` before `## Research Standards` |
| G-02 | PM | High | `AGENTS.md` Universal Baseline: add Educational Interaction one-liner |
| G-03 | PM | Medium | `agent-lifecycle-manager` skill (workspace + common): add conditional checklist for education/tutoring/coaching roles |
| G-04 | PM | Low | Future refactor: group Educational/Research/Computational Standards under `## Quality & Integrity Standards` |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Universal policy (not variant-specific) | Educational contexts arise in any variant |
| Conditional application, not always-on | Over-triggering harms UX for operational/lookup requests |
| Direct answer exceptions explicitly listed | Prevents Socratic method from blocking urgent needs |
| Placement before Research Standards | Logical order: interaction method before content standards |
| Future grouping refactor noted | Prevent context.md bloat from multiple Standards sections |
