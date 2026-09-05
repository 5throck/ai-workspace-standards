---
name: decision-record
description: >
  Decision record format for gate-moment rulings — Design Gate Row 0
  determinations, escalations, and go/no-go calls captured as durable
  docs/decisions/DEC-YYYYMMDD-NN.md files with rule and evidence citations.
  Use when: a gate ruling was made, an escalation was resolved, or a go/no-go
  decision was reached (ADR-0061).
version: 1.1.0
owner: pm
status: active
last_reviewed: 2026-08-25
scope: common
metadata:
  type: process
  triggers:
    - decision record
    - gate ruling
    - go/no-go decision
    - escalation decision
    - record a decision
---

## Purpose

Closes the Decision link of the Agent → Skill → Knowledge → Evidence → Rule → Decision chain (ADR-0061). Gate rulings made only in chat vanish when the session ends; a decision record keeps the ruling, what was rejected, and which rules and evidence produced it — queryable after the session is gone.

## File Format

Records live at `docs/decisions/DEC-YYYYMMDD-NN.md` — one file per deciding session day, numbered within the day (`01`, `02`, ...) in the order the rulings were made.

### Frontmatter Spec

```yaml
id: DEC-YYYYMMDD-NN
date: YYYY-MM-DD
agent: <agent that decided>
decision: <one-line ruling>
alternatives: <what was rejected and why>
evidence_refs: [<evidence-ledger row IDs / finding files>]
rules_applied: [<rule IDs, e.g. NEWS-R1>]
skills_used: [<skill names>]
knowledge_refs: [<Knowledge-layer docs: country profiles, manuals, ADRs>]
status: proposed|accepted|superseded
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Must match the filename; never reused after supersession |
| `date` | yes | The deciding date, `YYYY-MM-DD` |
| `agent` | yes | The single agent that owns the ruling (normally `pm`) |
| `decision` | yes | One line — the ruling itself, not its justification |
| `alternatives` | yes | What was rejected and why; a record is incomplete without it |
| `evidence_refs[]` | yes (may be empty) | Entries must resolve to `evidence-ledger` rows or finding files |
| `rules_applied[]` | yes (may be empty) | Stable rule IDs (see below) |
| `skills_used[]` | yes (may be empty) | Skill names consulted, drawn from the skill relationship graph vocabulary (ADR-0060) |
| `knowledge_refs[]` | yes (may be empty) | Knowledge-layer artifacts the ruling rests on — country profiles, manuals, ADRs, procedure schemas (ADR-0061 amendment 2026-08-25: closes the Agent→Skill→**Knowledge**→Evidence→Rule→Decision chain end to end) |
| `status` | yes | `proposed` until confirmed, `accepted` once acted on, `superseded` when reversed |

### Body

Free-form below the frontmatter: context that does not fit one line, the reasoning trail, and any conditions attached to the ruling.

## Mutation Model: Supersession, Never Deletion

A decision record is never edited to reverse itself and never deleted. To reverse or amend a ruling:

1. Set the original record's `status: superseded` and note the successor (e.g. a `superseded_by: DEC-...` line in its body)
2. Create a new record that points back (e.g. `supersedes: DEC-...` in its body) and carries the new ruling

The chain stays append-mostly and auditable — the same model ADRs use in this workspace.

## When to Record (Gate Moments)

Per ADR-0061 and the gate-moment rule in `agents/pm.md` (workspace root) and `templates/common/agents/pm.md` (inherited by every variant), the PM MUST emit a decision record **before dispatch continues** at:

- **Design Gate Row 0 rulings** — exempt/non-exempt determination, spec assignment, design approval
- **Escalations** — permission denials routed to the user, specialist disputes resolved by the PM
- **Go/no-go decisions** — proceeding past (or routing back from) any hard gate

Record the ruling where the gate fires; do not batch records to the end of the session, when the reasoning has already gone cold.

## Rule-ID Citation Convention

`rules_applied[]` entries use stable rule IDs of the form `<DOMAIN>-R<N>`:

- `NEWS-R1` — co-news two-source rule (annotated inline in the co-news context file)
- IDs are **stable once assigned** — never renumber or reuse; a renamed rule orphans every record quoting it
- Each variant's registry of rule IDs lives in **its own context.md** (annotated inline on the rule text); there is no central workspace registry

## Linking Evidence

`evidence_refs[]` is the downward link into the Evidence layer: every entry resolves to a row of an `evidence-ledger` table (claim | source | url/ref | verification | status) or a finding file under `docs/evidence/findings/`. A record should read as "these rules (`rules_applied[]`), applied to this evidence (`evidence_refs[]`), produced this ruling" without re-deriving either from prose.
