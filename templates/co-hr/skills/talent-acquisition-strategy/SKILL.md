---
name: talent-acquisition-strategy
scope: co-hr
description: >
  Guides the Talent Acquisition Specialist through role/headcount intake,
  sourcing channel strategy, selection process design with bias-mitigation
  checks, and pipeline funnel metrics. Use when: hiring plan design,
  sourcing strategy, interview/selection process design, or recruiting
  funnel analysis is required.
version: 1.0.0
last_reviewed: 2026-08-23
status: active
owner: talent-acquisition-specialist
prerequisites: none
metadata:
  type: domain
  triggers:
    - hiring plan
    - sourcing strategy
    - recruiting
    - selection process
    - interview design
    - talent pipeline
    - recruiting funnel
---

## Context

Use in Phase 1-3 whenever an engagement requires designing or improving how an organization sources, screens, and selects candidates for open roles. Owned by the Talent Acquisition Specialist. Compensation positioning for any role is out of scope here — hand off to `compensation-benchmarking` rather than deciding pay bands unilaterally.

## When to Use

- When a role or headcount plan needs to be translated into a job profile and sourcing plan
- When designing or redesigning a selection/interview process
- When building or reviewing a talent pipeline funnel report
- When an offer is ready to be extended and compensation positioning input is needed from the Compensation & Benefits Analyst

## Execution Steps

1. **Role/Headcount Intake and Job Profile Definition**:
   - Confirm the role exists in an approved headcount plan (reference `org-design-framework`'s headcount plan output if available)
   - Define the job profile: title, job family/level, must-have vs. nice-to-have requirements, and success criteria for the first 6-12 months
   - Flag any role whose requirements are not yet leveled against a job architecture — do not invent a level unilaterally

2. **Sourcing Channel Strategy**:
   - Classify the role into a difficulty tier (e.g., high-volume/standard, specialized/niche, executive/confidential) based on skill scarcity and market competitiveness
   - Match channels to tier: employee referral, direct/proactive sourcing, agency/search firm, campus/early-career pipeline, internal mobility
   - State the rationale for each channel choice against the difficulty tier — do not default to a single channel without justification
   - Prioritize internal mobility review before external sourcing when the role and org context make it viable

3. **Selection Process Design**:
   - Define screening stages in sequence (resume/application screen, phone screen, technical/functional assessment, panel/onsite, final)
   - Build a structured interview scorecard per stage: competency/criterion, behavioral indicator, rating scale — structured scorecards only, not unstructured "gut feel" interviews
   - Bias-mitigation checks: document how each stage controls for interviewer bias (e.g., standardized questions across candidates, diverse panel composition, blind resume review where feasible, calibration discussion before consensus). Explicitly flag any stage lacking a bias-mitigation control rather than silently omitting it

4. **Pipeline Funnel Metrics**:
   - Track the funnel: applicants → screened → interviewed → offered → accepted
   - Report conversion rate at each stage transition
   - Compare against benchmark conversion rates only when a benchmark source is cited by name and recency (do not fabricate industry conversion figures — if unavailable, state that explicitly)
   - Flag any stage with an anomalously low conversion rate as a process bottleneck for review

5. **Offer Strategy Handoff**:
   - Assemble the candidate's role, level, and market context needed for pay decisioning
   - Hand off compensation positioning (pay band placement, offer amount) to the Compensation & Benefits Analyst rather than deciding pay bands unilaterally — this skill's output stops at "offer readiness," not the offer number itself

## Output Format

- **Role Sourcing Brief**: Job Profile, Difficulty Tier, Recommended Channels + Rationale
- **Selection Process Design**: Stage-by-stage table — Stage, Method, Scorecard Criteria, Bias-Mitigation Control
- **Pipeline Funnel Report**: Stage, Count, Conversion Rate, Benchmark (if cited), Bottleneck Flag

## Related Skills

- compensation-benchmarking
- hr-metrics-analysis
