---
name: competency-modeling
scope: co-hr
description: >
  Guides the building of organizational competency models — competency
  definition with behavioral anchors, proficiency leveling, and assessment
  design — the SHRM Body of Knowledge's talent-planning core. Use when:
  a competency framework needs to be built, leveled, validated, or wired
  into assessment instruments from scratch.
version: 1.0.0
last_reviewed: 2026-08-25
status: active
owner: learning-development-specialist
prerequisites: none
metadata:
  type: domain
  triggers:
    - competency model
    - competency framework
    - competency dictionary
    - proficiency leveling
    - behavioral anchors
    - competency assessment design
---

## Context

Use in Phase 2 when an engagement requires building (or rebuilding) an organization's competency architecture. Owned by the Learning & Development Specialist, with structured hand-offs to the skills that consume the finished model.

**Positioning vs. `learning-curriculum-design`**: that skill includes a competency-model design step as the ENTRY to curriculum work — a just-in-time model for one learning program. THIS skill is the organizational framework: the enterprise competency dictionary, its proficiency ladder, and the assessment design that makes competencies measurable across talent processes (performance rubrics, succession readiness, curriculum gap analysis). When a full framework exists, `learning-curriculum-design` consumes it instead of re-deriving.

## When to Use

- Client has no competency framework, or one that is stale, unlevelled, or unusable as a rating basis
- A competency model must serve MULTIPLE consumers (performance + learning + succession), not one program
- Behavioral anchors or proficiency levels need to be defined or harmonized
- Assessment instruments (interview guides, work samples, 360s) must be designed against the model

## Execution Steps

### 1. Scope the Architecture

- Decide the model's span: **core/values competencies** (all roles), **functional/technical competencies** (job families), **leadership competencies** (management levels). Record which are in scope.
- Align to strategy: the 5-8 competencies that distinguish great performance in THIS organization's next 3 years — not a generic library dump. Cite the strategic input (business plan, org-design output from `org-design-framework` if present).

### 2. Collect Evidence (never invent from the armchair)

- **Critical-incident interviews** with high performers and their managers: "describe a time this role demanded excellence — what did the person DO?"
- **SME panels / focus groups** per job family to draft functional competencies
- **Existing artifacts**: job descriptions, performance forms, exit-interview themes
- Every competency must trace to at least two independent evidence sources; label single-sourced candidates as DRAFT.

### 3. Draft the Competency Dictionary

One entry per competency:

| Field | Rule |
|-------|------|
| Name | Short, observable behavior phrase ("Builds Stakeholder Trust" — not "Integrity") |
| Definition | 1-2 sentences, behavior + outcome, no traits or personality language |
| Behavioral anchors | 3-5 observable indicators per proficiency level — what a rater would SEE |
| Distinctness | No overlap with another competency — merge or split until clean |
| Evidence | The sources supporting the entry |

Ban list: circular definitions ("X is demonstrating X"), unobservable adjectives ("passionate", "driven"), and trait nouns.

### 4. Level the Model (proficiency scale)

- Define ONE proficiency scale across the model (recommend 4 levels: Foundational → Applied → Advanced → Expert/Mastery), with a one-line anchor defining what progression means generically.
- For every competency × level: a concrete behavioral anchor. Test each anchor with "could two raters watching the same person agree this level is shown?" — if not, the anchor is too vague.
- Map levels to the client's career ladder where one exists (individual-contributor tiers vs. manager tiers); note where the model and ladder disagree rather than forcing alignment.

### 5. Validate

- SME review of definitions and anchors (clarity + completeness)
- Incumbent + manager review of LEVELING at 2-3 real roles: run a mini calibration — discrepancies are anchor defects, not rater errors
- Record validation status per competency (Validated / Draft)

### 6. Design the Assessment Layer

Choose methods per competency type:

| Competency type | Primary assessment methods |
|-----------------|---------------------------|
| Behavioral (core, leadership) | Structured behavioral interviews (STAR probes against anchors), 360 feedback |
| Functional/technical | Work samples, simulations, credential verification |
| Integrated (complex judgment) | Case/simulation exercises scored with the anchor rubric |

Design rules:

- Every instrument's scoring rubric quotes the model's anchors verbatim — paraphrased rubrics break comparability
- Structured format: same probes, same order, same scoring guide for all candidates/incumbents
- Multiple assessors for high-stakes decisions; document inter-rater resolution
- Fairness guardrail: check for adverse impact across protected groups during validation runs — route measurement questions to `data-analyst`; labor-market legality questions (which characteristics may lawfully be assessed under the active country profile) to `labor-compliance-analyst`
- Assessment ≠ performance rating: assessments measure current proficiency against anchors; performance management measures results against goals — keep the instruments distinct

### 7. Govern and Hand Off

- Version the dictionary (semver); record review cadence (annual or on org-design change)
- Hand-offs: behavioral anchors + levels → `performance-system-design` (rating rubrics); gap analysis → `learning-curriculum-design` (curriculum priorities); readiness levels → `career-path-succession-planning` (succession criteria); "% roles with defined competency profile" → `hr-metrics-analysis` per the ISO 30414 mapping (Professional competence and development area)

## Output Format

- **Competency Dictionary**: entries per the Step-3 table, with validation status
- **Proficiency Leveling Matrix**: competency × level anchor grid
- **Assessment Plan**: per competency — method(s), instrument sketch, scoring source (which anchors), assessor structure
- **Governance Note**: version, review cadence, evidence log locations

## Related Skills

- `learning-curriculum-design` — downstream consumer: converts assessed gaps into curriculum design
- `performance-system-design` — downstream consumer: anchors become rating rubrics
- `career-path-succession-planning` — downstream consumer: levels become readiness criteria
- `org-design-framework` — upstream: strategy and job-family structure input
