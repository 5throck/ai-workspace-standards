---
status: Accepted
date: 2026-08-24
author: PM + Docs Writer
---

# ADR-0061: Decision Record Standard

## Context

Decision-critical AI teams should structure their workspace as a chain: **Agent → Skill → Knowledge → Evidence → Rule → Decision**. A 2026-08-24 audit of all 11 variants found the first five links present but the **Decision link missing in every variant** — gate rulings, escalations, and go/no-go calls are made in chat transcripts and vanish when the session ends.

What the audit did find:

- **Knowledge** — country profiles (ADR-0057) and variant docs exist and are governed.
- **Evidence** — variant-local ledgers exist in the strongest variants.
- **Rule** — constitution sections, ADRs, and hard gates (pre-commit, dev-sync FATAL steps) exist and are enforced.
- **Decision** — nothing. No artifact, no format, no location convention.

The upstream pattern quality varies widely: **co-news has the strongest chain** (2-source rule → `citation-ledger.md` with fixed columns → fact-checker hard gate → escalation path), while **co-consult is the weakest**. The standard below generalizes the co-news shape without flattening its variant-specific strength into a common average.

## Decision

### 1. Decision Record Artifact

A decision record is a file `docs/decisions/DEC-YYYYMMDD-NN.md` (project/L2 level — one per deciding session day, numbered within the day) with fixed frontmatter:

```yaml
id: DEC-YYYYMMDD-NN
date: YYYY-MM-DD
agent: <agent that decided>
decision: <one-line ruling>
alternatives: <what was rejected and why>
evidence_refs: [<evidence-ledger line IDs / finding files>]
rules_applied: [<rule IDs, e.g. NEWS-R1>]
skills_used: [<skill names>]
status: proposed|accepted|superseded
```

**Mutation model: explicit supersession, never deletion.** Decision chains are mutable by superseding records — a superseded record keeps its `status: superseded` and points forward; the new record points back. This makes the chain append-mostly and auditable, mirroring how ADRs themselves work in this workspace.

### 2. Evidence Standard

A common skill **`evidence-ledger`** defines the base ledger with fixed columns:

| claim | source | url/ref | verification | status |

Variant overlays extend it — **co-news keeps its 2-source rule as a variant overlay**, not as a common requirement (owner-confirmed fork). Evidence location convention: `docs/evidence/ledger.md` plus per-topic files under `docs/evidence/findings/`.

### 3. Rule Referencing

Hard gates get **stable rule IDs** (e.g. `NEWS-R1: two-source rule`) that ledgers and decision records quote in `rules_applied[]`. The rule-ID registry lives in each variant's context.md, so a decision record can be read as "these rules, applied to this evidence, produced this ruling" without re-deriving the rules from prose.

### 4. PM Gateway Integration

`agents/pm.md` (L0) and `templates/common/agents/pm.md` (which `extends` it per ADR-0033/0039) gain a **gate-moment rule**: Design Gate Row 0 rulings, escalations, and go/no-go decisions **MUST emit a decision record before dispatch continues**. A new common skill **`decision-record`** documents the format and when to log. No new dedicated agent is introduced — **the PM owns the gate**, and the record is part of discharging that ownership (constitution §5.4).

### 5. Enforcement Ladder

- **v1 (this ADR)**: prompt-level enforcement in `pm.md` + an audit **soft-check** that fires only when `docs/decisions/` exists (a variant with no decisions directory yet is not flagged — adoption is per-variant).
- **Deferred**: hook-level enforcement is explicitly deferred **until after 2 engagements** have exercised the format, so the frontmatter shape can be corrected by experience before it becomes a hard gate. This follows the ADR-0055/0059 WARN-first playbook.

### Rejected Alternatives

| Alternative | Why rejected |
|-------------|--------------|
| **Hook-enforced on day one** | Adoption risk — a blocking gate on an untested frontmatter shape would fight real usage for two engagements before the schema settles (ADR-0055/0059 burn-in lesson). |
| **A new decision-czar agent** | The PM already owns every gate moment; a second agent would duplicate ownership and add a dispatch hop at the exact moment dispatch should be pausing to record. |
| **Status quo (memory log only)** | `memory/YYYY-MM-DD.md` captures what happened, not why it was ruled — decisions evaporate with the session, which is the gap this ADR closes. |

## Consequences

**Positive:**

- The Agent → Skill → Knowledge → Evidence → Rule → **Decision** chain is closed at every gate moment; rulings survive their sessions.
- Decision records are cross-referenceable in both directions — `rules_applied[]` up into the Rule layer, `evidence_refs[]` down into the Evidence layer.
- co-news's 2-source discipline becomes a reusable overlay instead of a variant-private accident.
- Supersession-not-deletion keeps decision history queryable even when reversed.

**Negative / Trade-offs:**

- **One more artifact per gate moment** — the PM pays a small write tax at exactly the moments it wants to move fast; the prompt-level rule and the `decision-record` skill keep the cost low but nonzero.
- **Per-variant adoption** — variants without `docs/decisions/` accumulate no records until they opt in; the chain closes gradually, not workspace-wide on day one.
- **Rule IDs are a new namespace** to keep consistent per variant (registry in context.md); a renamed rule orphans the records quoting it.

## Implementation

| File | Change |
|------|--------|
| `docs/adr/0061-decision-record-standard.md` | This ADR |
| `agents/pm.md` + `templates/common/agents/pm.md` | Gate-moment rule: Design Gate Row 0 rulings, escalations, go/no-go decisions must emit a decision record before dispatch continues (lands in follow-up PRs) |
| `skills/evidence-ledger/SKILL.md` | New common skill — fixed-column ledger + variant-overlay contract (lands in follow-up PRs) |
| `skills/decision-record/SKILL.md` | New common skill — decision record format and when to log (lands in follow-up PRs) |
| `scripts/audit.ts` | Soft-check when `docs/decisions/` exists (lands in follow-up PRs) |
| Variant context.md files | Rule-ID registries (e.g. `NEWS-R1`) (lands in follow-up PRs, variant-by-variant) |
| `docs/constitution/05-multi-agent-architecture.md` | Pointer in §5.4: gate-moment decisions must emit a decision record per this ADR (this PR) |

## References

- ADR-0059 — Governance reflection validators: this ADR must appear in the governance corpus (`verify-adr-governance.ts --strict`)
- ADR-0033 / ADR-0039 — Variant-specific skills/scripts blueprint and the L0-L1-L2 `extends` hierarchy that `templates/common/agents/pm.md` uses
- ADR-0055 — WARN-first → hard-gate enforcement playbook that §5's ladder follows
- ADR-0057 — Country profiles (the Knowledge layer the chain builds on)
- ADR-0060 — Skill Relationship Graph (`skills_used[]` draws its vocabulary from the graph)
- ADR-0062 — Marker-Based Doc Propagation Domains (sibling ADR from the same 2026-08-24 design series)
