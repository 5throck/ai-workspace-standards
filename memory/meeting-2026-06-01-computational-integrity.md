# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Computational integrity standards — mandatory external tool use for precision numerical computation and complex financial calculations
**Participants**: architect, pm, docs-writer
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

The user wants context.md to guide AI agents to:
1. Use external tools (e.g., Fortran) for safety-critical numerical computation (aerospace, aviation, precision control) rather than computing directly
2. Use programming tools (e.g., Python) for complex financial calculations rather than computing directly
This should propagate to all variants including future ones.

---

## Transcript

### architect (Round 1)
Identified two fundamental AI limitations in numerical computation: (1) floating-point precision — AI-generated numbers accumulate rounding errors it cannot self-verify; (2) reproducibility — same prompt does not guarantee same numerical result. Proposed three-class taxonomy: Class A (AI direct forbidden, external tool mandatory): legally/safety-critical calculations; Class B (AI estimate OK, tool verification recommended): statistical analysis, predictive models; Class C (AI direct allowed): simple arithmetic, order-of-magnitude estimates. Asked docs-writer about document location.

### docs-writer (Round 1)
Confirmed ## Computational Integrity Standards section logically follows ## Research Standards as both are "reliability principles." Recommended "principle + tool examples" format rather than fixing specific tools — allows adaptation to project environment. Proposed four-step procedure: (1) verify tool installed, (2) write and run computation code, (3) validate result (units, boundary values), (4) document result with tool attribution. Asked PM for trigger conditions that agents can use to self-classify.

### pm (Round 1)
Defined trigger conditions: domain keywords (aerospace: flight path/orbit/thrust; precision control: PID/gain/transfer function; financial: NPV/IRR/WACC/VaR/IFRS); precision requirement (> 4 decimal places); iteration count (> 100); legal/safety impact. Defined execution flow: detect → classify → if Class A: check tool availability → code → execute → validate → document. Asked architect about domain-specific tool mapping.

### architect (Round 2)
Confirmed domain-tool mapping table is appropriate. Provided mapping: aerospace/precision control → Fortran (gfortran), Julia; financial/statistical → Python + NumPy/SciPy/pandas; structural/thermal → Python + FEniCS, Fortran. Emphasized security constraint: tool installation must go through stack-setup agent with user approval, not arbitrary pip/apt commands. Defined attribution format: "Computed using: <tool> v<version>, code: <path>". Asked docs-writer for document structure draft.

### docs-writer (Round 2)
Provided full section draft with: trigger conditions list, domain-tool mapping table, 5-step required procedure, AI vs. tool comparison table. Proposed dedicated "numerical-analyst" agent to own this procedure. Asked PM whether to create specialized agent.

### pm (Round 2)
Rejected separate agent: this is a universal principle applying to ALL agents, not a specialist role. Separating would create misconception that other agents may compute directly. Numerical computing agents are project-specific (needed in aerospace projects, irrelevant in co-work). Policy belongs in context.md + AGENTS.md Universal Baseline + agent-lifecycle-manager skill checklist — same pattern as Research Standards.

### architect (Round 3)
Finalized: add section to templates/common/docs/context.md only (→ automatic propagation to all future variants). Add conditional checklist to agent-lifecycle-manager skill for agents with numerical computation roles — same pattern as research role checklist.

### docs-writer (Synthesis)
## Computational Integrity Standards section confirmed. Content: mandatory tool use conditions (Class A triggers), domain-tool mapping table, 5-step procedure, AI-estimation vs. tool-computation distinction table. Three insertion points identical to Research Standards pattern. No separate agent.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| F-01 | PM | High | `templates/common/docs/context.md`: add `## Computational Integrity Standards` section |
| F-02 | PM | High | `AGENTS.md` Universal Baseline: add Computational Integrity one-liner |
| F-03 | PM | Medium | `skills/agent-lifecycle-manager/SKILL.md` (workspace + common): add conditional checklist for numerical computation roles |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| External tool, not AI direct, for Class A | Floating-point precision and reproducibility are non-negotiable for safety/legal domains |
| Tool as examples, not fixed | Fortran, Python are primary examples; other validated tools acceptable |
| Installation via stack-setup agent | Security review required before any tool installation |
| No separate numerical-analyst agent | Universal principle; project-specific agents are project decisions |
| Same pattern as Research Standards | Consistency in policy structure |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | New project has Computational Integrity Standards in context.md | Check after scaffolding |
| AC-02 | New aerospace/finance agent created via skill includes computation delegation rule | Manual test |
