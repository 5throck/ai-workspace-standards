---
name: project-delivery
description: >
  Guides the Delivery Manager through planning and managing consulting engagement
  delivery. Standardizes milestone design, issue logs, risk registers, and weekly
  status reporting for all co-consult engagements. Converts solution-design
  roadmap and dependency map into an actionable execution plan.
version: 1.0.0
status: active
owner: delivery-manager
prerequisites: solution-design
---

## Context

Use in Phase 4. The solution-design skill's roadmap and dependency map are required inputs. Outputs feed into stakeholder-review-management and the Engagement Leader's Phase 5 QA gate.

## When to Use

Invoke this skill when the Delivery Manager is ready to convert the Solutions Architect's approved solution-design roadmap into a managed execution plan with milestones, resource assignments, and reporting cadence.

## Execution Steps

1. **Ingest solution-design Outputs**: Import the implementation roadmap, dependency map, and risk register from Solutions Architect
2. **Build Execution Plan**:
   - Convert roadmap phases into discrete workstreams with weekly granularity
   - Assign owners to each workstream
   - Confirm dependency sequencing (critical path identification)
   - Set milestone dates (with dependencies respected)
3. **Resource Plan**:
   - Map agents/team members to workstreams
   - Identify capacity conflicts
   - Flag resource gaps
4. **Risk Register Update**: Merge solution-design risks with project execution risks. Add:
   - Delivery risks (schedule, resource, dependency)
   - Escalation thresholds: when does a risk become an issue requiring Engagement Leader attention?
5. **Issue Log Setup**: Template with: Issue ID, Description, Raised Date, Owner, Status, Resolution, Closed Date
6. **Weekly Status Report Template**:
   - RAG status (Red/Amber/Green) per workstream
   - Milestone progress
   - Issues and risks (open items)
   - Decisions needed from Engagement Leader
   - Next week priorities
7. **Engagement Leader QA Readiness Check**: Before Phase 5, confirm all deliverables are tracked, issues closed, and risk register current

## Output Format

- Execution Plan: Workstream, Owner, Milestones, Dependencies, Duration, RAG Status
- Risk Register (updated): Risk, Probability, Impact, Level, Mitigation, Owner, Status
- Issue Log Template
- Weekly Status Report Template

## Related Skills

- solution-design
- stakeholder-review-management
- technical-feasibility
