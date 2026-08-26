---
name: career-path-succession-planning
scope: co-hr
description: >
  Guides the Career & Succession Consultant through career path
  architecture, 9-box talent review, succession bench strength
  assessment, leadership pipeline development, and retention risk
  flagging. Use when: career path design, talent review, succession
  planning, leadership pipeline design, or retention risk assessment
  is required.
version: 1.0.0
last_reviewed: 2026-08-23
status: active
owner: career-succession-consultant
prerequisites: none
metadata:
  type: domain
  triggers:
    - career path
    - succession planning
    - 9-box talent review
    - leadership pipeline
    - retention risk
    - talent review
---

## Context

Use in Phase 2-3 whenever an engagement requires career path design, talent review, or succession planning. Owned by the Career & Succession Consultant. Development plans for identified successors link to `learning-curriculum-design`'s curriculum offerings rather than being designed from scratch here, and bench-strength/retention data feeds `hr-metrics-analysis` for workforce reporting.

## When to Use

- When career path architecture (ladder vs. lattice) needs to be designed
- When a 9-box talent review needs to be run or calibrated
- When succession bench strength needs to be assessed for critical roles
- When a leadership pipeline development plan needs to be designed
- When high-potential or critical-role incumbents need retention risk flagging

## Execution Steps

1. **Career Path Architecture**:
   - Determine whether the org needs a ladder (single vertical progression track) or a lattice (cross-functional/dual-track, including an individual-contributor track parallel to a management track)
   - Document the rationale — orgs with strong technical/specialist populations typically need a dual-track lattice to retain non-management-track talent
   - Cross-check against the job architecture (`org-design-framework`) so career paths align with actual job families/levels rather than an invented parallel structure

2. **9-Box Talent Review Methodology**:
   - Build the grid on two axes: performance (x) and potential (y)
   - Define explicit criteria for each axis before placing anyone on the grid (do not let placement precede criteria definition)
   - Calibration process: require cross-manager calibration discussion before finalizing placements, explicitly to avoid single-manager bias — flag any placement made without calibration as provisional

3. **Succession Bench Strength Assessment**:
   - For each critical role, assess bench strength using explicit readiness categories: ready now / ready 1-2yr / ready 3-5yr / gap (no successor identified)
   - Do not leave a critical role's succession status unstated — a "gap" finding is itself a required output, not an omission
   - Cross-reference candidates against the 9-box placements from Step 2

4. **Leadership Pipeline Development Plan Design**:
   - For each identified successor, link their gap-closing development needs to `learning-curriculum-design`'s curriculum offerings rather than inventing standalone development content
   - Sequence development actions against the readiness timeline (ready-now successors need different actions than ready-3-5yr successors)

5. **Retention Risk Flagging**:
   - Flag retention risk explicitly for high-potential individuals and critical-role incumbents (e.g., based on tenure in role, market demand for their skill set, engagement signals if available)
   - State the basis for each flag — do not flag without a stated reason
   - Route flagged individuals for prioritized retention action ownership (e.g., manager conversation, compensation review referral to `compensation-benchmarking`)

## Output Format

- **Career Path Architecture Doc**: Track Type (Ladder/Lattice), Rationale, Alignment to Job Architecture
- **9-Box Talent Review Grid**: Individual, Performance Rating, Potential Rating, Box Placement, Calibration Status
- **Succession Bench Strength Table**: Critical Role, Candidate(s), Readiness Category, Gap Flag
- **Individual Development Plans**: Individual, Readiness Category, Development Actions (linked to Learning & Development Specialist curriculum), Timeline
- **Retention Risk Flags**: Individual, Risk Basis, Recommended Action, Owner

## Related Skills

- learning-curriculum-design
- hr-metrics-analysis
