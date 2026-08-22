---
name: consulting-report-writing
scope: co-hr
description: >
  Guides any agent producing a client-facing deliverable through writing
  McKinsey/BCG-style consulting reports. Covers issue tree structure, MECE
  principle application, page design logic, and recommendation framing with
  impact-feasibility assessment. Sets the quality floor for all client-facing
  deliverables in co-hr — not exclusive to any single agent.
version: 1.0.0
last_reviewed: 2026-08-23
status: active
owner: pm
prerequisites: none
metadata:
  type: process
  triggers:
    - consulting report
    - strategy report
    - recommendation memo
    - report writing
    - issue tree
    - consulting deliverable
---

## Context

Shared quality-floor skill. Use whenever any co-hr agent produces a formal client-facing consulting deliverable (compliance review, HR system design proposal, workforce statistics report, restructuring plan, etc.). It has no single natural owner among the 11 specialists, so `pm` holds it and any agent may invoke it directly when writing a deliverable.

## When to Use

- When producing any formal client-facing consulting deliverable
- When structuring a strategy report, assessment, or recommendation memo
- When recommendations need to be prioritized and sequenced for a client
- When the engagement reaches the deliverable production stage in Phase 3

## Execution Steps

1. **Apply Issue Tree Structure**:
   - Start from the central question (the client's decision)
   - Decompose into MECE sub-questions (Mutually Exclusive, Collectively Exhaustive)
   - Each section of the report answers one branch of the issue tree

2. **Section Architecture** (standard consulting report structure):
   - Executive Summary (1-2 pages): findings, conclusions, recommendations — written last, placed first
   - Situation / Context (1-2 pages): what is true today
   - Complication / Problem (1-2 pages): why the status quo is not acceptable
   - Resolution / Recommendations (3-5 pages): what should be done, in what order
   - Implementation Roadmap (1-2 pages): phased actions with owners and timelines
   - Appendix: supporting data, methodology, detailed analysis

3. **MECE Check**: Review each section. Ask: Do the sections overlap? Do they together cover the full scope?

4. **Recommendation Framing**: Each recommendation must have:
   - What (specific action)
   - Why (evidence-backed rationale)
   - How (implementation approach)
   - Who (owner)
   - When (timeline)
   - Impact-Feasibility Matrix: plot each recommendation on a 2x2 (Impact × Feasibility) to prioritize

5. **Language Standards**:
   - Active voice, present tense for recommendations
   - Quantify every claim where possible ("20% cost reduction" not "significant cost reduction")
   - One idea per paragraph, topic sentence first
   - No jargon without definition
   - Korean legal/regulatory proper nouns stay in backticks per co-hr's English-prose language policy

6. **Visual Communication**: Every data point should have a chart or table. Every complex argument should have a visual framework.

7. **Quality Checks**:
   - MECE compliance across all sections
   - So-What statement present per section
   - Evidence backing every claim
   - Executive summary matches body conclusions

## Output Format

- **Full consulting report** in the section structure above
- **Recommendation Prioritization Matrix** (Impact × Feasibility)
- **Executive Summary** (standalone, max 2 pages)

> **Save Output To**: See Output Destination Mapping in `docs/co-hr.context.md` for destination folder and naming convention. Create the folder if it does not exist. Do not hard-code output paths.

## Related Skills

- (none yet in co-hr — add once a downstream skill exists)
