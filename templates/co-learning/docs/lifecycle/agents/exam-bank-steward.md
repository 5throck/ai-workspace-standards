# Agent Governance Record — exam-bank-steward

## Overview

- **Agent Name**: exam-bank-steward
- **Role**: Question bank quality and exam operations stewardship
- **Phase**: production
- **Tier**: medium (claude/gemini/antigravity/gemini-cli/codex)

## Phase History

- **2026-09-07**: Initial release — created in Projects/co-develop per the
  question-bank bias meeting (memory/meeting-2026-09-07-question-bank-bias.md).
  Owns bank authoring quality (answer-length bias checks via
  deliverables/harness-assessment/bias.js), the distractor remediation workflow
  (drafts + ledger with named human review), and exam operations (cohorts,
  windows, activation, CTT statistics monitoring).
- **2026-09-12**: Hard-deleted in Projects/co-develop by the template fleet-sync
  upgrade commit `43dc0c4` without a gate-moment decision record (recorded in
  Projects/co-develop docs/decisions/DEC-20261006-01.md, superseded by
  DEC-20261006-02.md).
- **2026-10-06**: Restored by owner decision and migrated to the new co-learning
  variant together with the harness-assessment domain: this variant template
  now ships the agent, and scaffolded projects receive it in the standard
  roster.

## Acceptance Criteria

- [x] Defined in `agents/exam-bank-steward.md` with PM-ONLY invocation section
- [x] Follows standard agent frontmatter structure
- [x] Registered in AGENTS.md (roster, details, phase gate)
- [x] Owner of skill `skills/exam-bank-operations`

## Constraints

- Writes limited to assessment deliverables, `tests/`, lifecycle docs
- No auto-publish of AI-rewritten items; ledger requires named reviewer
- Rewrite freeze once the first real exam attempt exists (comparability review required)
