---
name: mece-logic-auditor
description: >
  MECE (Mutually Exclusive, Collectively Exhaustive) issue tree auditing and
  strategic reasoning evaluation rules for consulting problem-solving frameworks.
version: 1.0.0
status: active
owner: strategy-analyst
last_reviewed: 2026-08-06
prerequisites: Issue trees, driver trees, strategic frameworks, or draft consulting report logic
scope: co-consult
l2_propagate: true
metadata:
  type: strategic-reasoning
  triggers:
    - mece-logic-auditor
    - /mece-logic-auditor
    - MECE audit
    - issue tree audit
    - logic auditor
    - strategic reasoning evaluation
---

# 🧠 Skill: mece-logic-auditor

## Context

In management consulting (`co-consult`), rigorous problem decomposition and strategic recommendation structures depend on the **MECE** principle (Mutually Exclusive, Collectively Exhaustive). Flawed issue trees containing structural overlaps, logical gaps, or inconsistent levels of abstraction undermine client confidence and distort analytical conclusions.

`mece-logic-auditor` provides evaluation rules, audit frameworks, scorecards, and refactoring guidelines to inspect, evaluate, and strengthen issue trees, driver trees, hypothesis frameworks, and strategic reasoning logic.

## When to Use

- Auditing consulting issue trees, decision trees, or driver trees during problem formulation (Phase 1).
- Reviewing hypothesis breakdown structures before client workshops or interim steering committee meetings.
- Inspecting key findings, strategic pillars, and recommendation trees in consulting reports (`consulting-report-writing`) or executive presentations (`executive-presentation`).
- Evaluating strategic reasoning for logical fallacies, category overlaps, unaddressed scenarios, or level-of-abstraction mismatches.

## Execution Steps

1. **Tree & Structural Ingestion**
   - Parse the target document or markdown hierarchy to extract parent-child relationships, sub-issues, and hypotheses.
   - Represent the structure as a formal tree graph (Root -> Level 1 Pillars -> Level 2 Sub-issues -> Level 3 Hypotheses).

2. **Mutual Exclusivity (ME) Evaluation**
   - Inspect sibling nodes at each level of the tree.
   - Check for semantic overlap, double-counting, or category intersection (e.g. testing if Node A $\cap$ Node B $\neq \emptyset$).
   - Identify shared drivers, duplicate indicators, or ambiguous scope boundaries.

3. **Collective Exhaustiveness (CE) Evaluation**
   - Compare child node sets against parent node scope definitions.
   - Benchmark against established strategic frameworks where applicable:
     - Financial Performance: $\text{Profit} = \text{Revenue} - \text{Costs}$ (OpEx + CapEx).
     - Market & Strategy: 3Cs (Customer, Competitor, Company), 4Ps, PESTEL, Porter's Five Forces.
     - Value Chain: Inbound Operations, Production, Outbound Logistics, Marketing/Sales, Service.
   - Identify unexamined market segments, omitted operational levers, or unaccounted risk scenarios.

4. **Level of Abstraction & Pyramid Principle Audit**
   - Ensure all sibling nodes operate at the same level of abstraction (e.g. do not mix strategic goals like "Expand into APAC" with tactical tasks like "Update CRM Software").
   - Verify top-down deductive logic and bottom-up inductive synthesis (Barbara Minto's Pyramid Principle).

5. **Logic Coherence & Fallacy Detection**
   - Detect non-sequiturs, correlation vs causation confusions, circular reasoning, or unsupported assumptions.
   - Check that hypothesis statements are falsifiable and empirically testable.

6. **Audit Scorecard & Refactoring Generation**
   - Calculate quantitative quality scores (ME Score, CE Score, Logic Coherence Score).
   - Formulate concrete refactoring recommendations and produce an updated, fully MECE issue tree.

## Audit Rules & Diagnostic Matrix

| Audit Dimension | Pass Criteria | Violation Pattern | Remediation Action |
|-----------------|---------------|-------------------|--------------------|
| **Mutual Exclusivity (ME)** | Sibling branches are completely disjoint; zero domain overlap | Node A ("Reduce OpEx") overlaps with Node B ("Cut Logistics Costs", which is an OpEx item) | Restructure sibling nodes into clean non-overlapping categories (e.g. "Direct Production Costs" vs "Indirect Operating Costs") |
| **Collective Exhaustiveness (CE)** | Child nodes sum to 100% of parent domain boundary | Profit growth tree omits pricing optimization, focusing only on volume and cost | Add missing branch (e.g., "Price Realization & Mix Optimization") |
| **Level Consistency** | Parallel branches share identical granularity and horizon | Branch 1 is "Global M&A", Branch 2 is "Hire 2 Sales Reps" | Elevate Branch 2 to "Organic Commercial Capabilities" |
| **Logical Deduction** | Governing thoughts directly summarize supporting arguments | Sub-points do not logically force or justify the parent assertion | Re-anchor parent claim to match supporting evidence |

## Audit Scorecard Format

```markdown
### 📋 MECE Logic Audit Scorecard

- **Target Asset**: [Name of Issue Tree / Section / Report]
- **ME Score**: 85/100 (Minor overlap detected between Level 2 Node 2 and Node 3)
- **CE Score**: 70/100 (Gap identified: Omitted regulatory & compliance risks in market entry tree)
- **Logic Coherence Score**: 90/100 (Strong deductive flow; Pyramid Principle satisfied)
- **Overall Quality Grade**: B+ (Action required on CE gap)

#### Identified Deficiencies
1. **[CE Violation]**: Parent node "Strategic Growth Levers" omits M&A/Inorganic Growth, covering only Organic Product & Geographic Expansion.
2. **[ME Violation]**: Level 2 nodes "Supplier Rate Negotiation" and "Procurement Cost Reduction" share 60% domain overlap.

#### Recommended Refactored Tree
- Root: How to achieve 15% EBITDA expansion by FY2028?
  ├── 1. Revenue Growth Levers (Organic & Inorganic)
  │   ├── 1.1 Volume Expansion (Existing & New Markets)
  │   ├── 1.2 Net Price Realization & Product Mix
  │   └── 1.3 Strategic M&A & Partnerships
  └── 2. Cost & Efficiency Levers
      ├── 2.1 Direct Cost of Goods Sold (COGS) Optimization
      └── 2.2 Indirect SG&A Overhead Rationalization
```

## Related Skills

- `insight-synthesis`: Synthesizing research findings into executive-level key takeaways.
- `consulting-report-writing`: Structuring and drafting formal consulting deliverables.
- `solution-design`: Designing robust target operating models and client solutions.
- `narrative-framework`: Crafting compelling storylines for strategic engagements.
