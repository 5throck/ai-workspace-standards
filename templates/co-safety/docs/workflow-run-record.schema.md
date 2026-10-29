# Workflow Run Record Schema (Safety OS)

**Scope**: co-safety (L2-authored). Defines the required fields of a workflow
completion record — the file the `safety-workflow-manager` agent writes to
`memory/workflows/YYYY-MM-DD-<workflow-id>.md` for every executed workflow
(agents/safety-workflow-manager.md: harness step 5, Write tool scope, Output
Format "## Workflow Record", Constraints). Machine-validated by
`scripts/co-safety/audit-variant.ts` (gate 3) on every variant audit.

**Format**: YAML frontmatter + markdown body. The frontmatter carries the
machine-validated fields; the body carries the human narrative record (free
form — a run is a compliance narrative, not a form). Records with no
`memory/workflows/` directory yet are a valid initial state: the audit reports
"0 workflow runs recorded" and passes.

## Frontmatter fields

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `workflow_id` | string (non-empty) | yes | ID of the executed workflow from the `workflows/` library (e.g. `tbm`). Must match a definition the SWM selected — improvising undefined workflows is forbidden. |
| `date` | string `YYYY-MM-DD` | yes | Run date; must equal the record filename's date prefix. |
| `dispatched_by` | string (non-empty) | yes | ID of the dispatching agent (PM context block owner, typically `pm`). |
| `agents` | string[] (non-empty) | yes | Participant agent IDs actually dispatched (Risk Assessment, Compliance, Audit, industry specialists). |
| `legal_basis` | string[] (non-empty) | yes | Statutes/legal provisions the run was executed under (union of the workflow definition's `legal_basis` and any industry additions). |
| `outcome` | string (non-empty) | yes | Decisions/outcome summary — what the workflow concluded and what was approved, escalated, or left open. |
| `evidence` | string[] (non-empty) | yes | Evidence-chain references: file paths to each step's documented evidence (audit-agent filings, registers, photos, reports). Every dispatched sub-task must have documented evidence before its step is complete. |
| `sign_off` | string (non-empty) | yes | Sign-off status naming the accountable party. The SWM never approves outputs as legally sufficient compliance records — acceptance is the user organization's responsibility — so this field records the human/organizational acceptance (who accepted, when) or an explicit `pending-acceptance`. |
| `title` | string | no | Human-readable run title. |
| `industry` / `task_type` / `site_id` / `urgency` | string | no | The PM dispatch context block fields, echoed when available. |
| `open_items` | string[] | no | Incomplete steps, missing evidence, or follow-ups (mirrors the report's "## Open Items"). |

Unknown frontmatter keys are tolerated (forward-compatible); wrong-typed or
missing required keys fail the variant audit naming the file and field.

## Example

```markdown
---
workflow_id: tbm
date: 2026-10-29
dispatched_by: pm
agents:
  - safety-workflow-manager
  - risk-assessment-agent
  - audit-agent
legal_basis:
  - 산업안전보건법 Article 15
  - 산업안전보건법 Article 36
outcome: TBM executed for the A-site crane lift; 3 hazards briefed, 1 work
  stoppage resolved before start.
evidence:
  - memory/registers/hazard-2026-10-29-crane-lift.md
  - evidence/2026-10-29-tbm-signature-sheet.pdf
sign_off: pending-acceptance (site manager review scheduled 2026-10-30)
title: "TBM — A-site crane lift"
site_id: A-site
---

## Narrative

<free-form run narrative: what was briefed, what the agents each produced,
escalations to PM, and the evidence chain in order>
```

## Validation contract (audit-variant.ts gate 3)

- Directory `memory/workflows/` absent, or zero `*.md` records → explicit
  "0 workflow runs recorded" INFO; the audit passes (an unused Safety OS is a
  valid state, not a defect).
- A record whose filename does not match `YYYY-MM-DD-<workflow-id>.md` → FAIL.
- A record missing a required field, or carrying a required field with the
  wrong type/emptiness → FAIL naming the file and field.
