---
name: stakeholder-review-management
description: >
  Guides the Delivery Manager through managing stakeholder review cycles for
  consulting deliverables. Standardizes reviewer selection, feedback collection,
  conflict resolution, and change history tracking. Accounts for 30-40% of
  Phase 4 schedule and must be planned accordingly.
version: 1.0.0
last_reviewed: 2026-06-13
status: active
owner: delivery-manager
prerequisites: stakeholder-alignment, consulting-report-writing
---

## Context

Use in Phase 4 when client-facing deliverables produced in Phase 3 enter the review cycle. The stakeholder map from stakeholder-alignment and deliverables from consulting-report-writing are the primary inputs.

## When to Use

Invoke this skill when Phase 3 deliverables are ready for client-side review. Ensure 30-40% of Phase 4 schedule is reserved for review cycles before invoking.

## Execution Steps

1. **Review Plan Setup**:
   - Identify reviewers per deliverable (using stakeholder-alignment map)
   - Assign review rounds (typically 2: working-level + executive)
   - Set review windows with hard deadlines (default: 5 business days per round)
   - Allocate 30-40% of Phase 4 schedule to review cycles
2. **Feedback Collection**:
   - Distribute deliverables with a structured feedback template:
     - Section reviewed, Comment type (Factual / Strategic / Editorial), Priority (Must fix / Should fix / Nice to have), Comment text
   - Track receipt confirmation from each reviewer
3. **Feedback Consolidation**:
   - Aggregate all feedback into a master tracker
   - Identify conflicting comments between reviewers
   - Classify each comment: Accept / Decline (with rationale) / Escalate
4. **Conflict Resolution**:
   - For conflicting comments: schedule a short alignment call with the conflicting reviewers
   - Document resolution decision and rationale
   - Escalate unresolvable conflicts to Engagement Leader
5. **Change History Tracking**:
   - Version control: deliverable version, change description, reviewer requested, date, accepted by
   - Final version sign-off: explicit written approval from the designated decision-maker
6. **Review Cycle Close**:
   - Confirm all "Must fix" items resolved
   - Obtain formal sign-off
   - Archive versioned deliverables

## Output Format

- Review Plan: Deliverable, Reviewer(s), Round, Due Date, Status
- Feedback Tracker: ID, Section, Comment Type, Priority, Comment, Resolution, Status
- Change History Log: Version, Changes, Requested By, Approved By, Date
- Sign-off Record: Deliverable, Approver, Date, Format (email/signature)

## Related Skills

- stakeholder-alignment
- project-delivery
- consulting-report-writing
