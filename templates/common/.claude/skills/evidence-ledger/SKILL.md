---
name: evidence-ledger
description: >
  Fixed-column evidence ledger that traces every claim a decision depends on
  to a source, a reference, and a verification state. Use when: building or
  updating an evidence or citation ledger, verifying claims ahead of a gate
  ruling, or linking evidence into a decision record (ADR-0061).
version: 1.1.0
owner: pm
status: active
last_reviewed: 2026-08-25
scope: common
metadata:
  type: process
  triggers:
    - evidence ledger
    - citation ledger
    - claim verification
    - source verification
    - evidence tracking
---

## Purpose

Defines the common base format for evidence ledgers — the Evidence link of the Agent → Skill → Knowledge → Evidence → Rule → Decision chain (ADR-0061). A ledger row is the smallest unit of proof: one claim, where it came from, how it was checked, and whether it stands. Gate rulings and decision records cite ledger rows instead of re-deriving facts from prose.

## Ledger Format

Every ledger uses the same five fixed columns:

```
| claim | source | url/ref | verification | status |
```

| Column | Content |
|--------|---------|
| `claim` | The single assertion being evidenced — one claim per row, never a bundled paragraph |
| `source` | Who or what asserts it (publication, filing, dataset, interviewee) |
| `url/ref` | The retrievable reference — URL, receipt number, docket ID, or file path |
| `verification` | How the claim was checked, by whom, and when |
| `status` | Current standing — e.g. `VERIFIED`, `UNVERIFIED`, `CONTESTED`, `SUPERSEDED` |

Rows are never rewritten to change history — see Append vs Supersede below.

## Evidence Location Convention

- `docs/evidence/ledger.md` — the ledger itself (one table, or one section per topic)
- `docs/evidence/findings/` — per-topic finding files holding detail too long for a row (methodology notes, excerpts, calculations); the ledger's `url/ref` column links into them

## Variant Overlays

The five columns are the common base. Variants MAY add requirements on top — stricter sourcing, extra columns, jurisdiction-specific citation rules — in the variant's own assets, never by editing this skill.

Canonical overlay example: co-news requires **2+ independent sources per material claim** (`NEWS-R1`, registered inline in its context file) and instantiates the base format with claim / source 1 / source 2 / receipt number / status columns in its `source-verification-ledger` skill. The two source columns and the receipt-number column are the overlay; the row-per-claim, fixed-column, status-tracked discipline is the base.

### Registry-backed overlays (formal-var form)

Some registry-backed variants carry their evidence plane as FORMAL VARIABLES instead of a prose ledger — machine-checked rows in a schema-governed registry (e.g. an evidence-variable registry with run-scoped snapshots), with calibration corpora or finding files attached as provenance. That is a legitimate overlay form of this skill: the row-per-claim discipline becomes row-per-VARIABLE, `verification` becomes the registry's verification metadata, and supersession happens through the registry's own reversal/amendment protocol. Whichever form a variant uses, decision records `evidence_refs[]` must resolve inside it — a registry key name for formal-var overlays, a ledger row ID for prose ledgers.

## Append vs Supersede

- **Append** when adding new evidence or a new verification pass — new rows, new finding files.
- **Supersede** when a claim's standing changes (a source retracts, a verification fails, a stronger source arrives): keep the original row, set its `status` to `SUPERSEDED`, and add a new row whose `verification` notes what replaced it.
- Never delete a row or overwrite a `verification` entry — the ledger must show what was believed, when, and why it changed.

## Linking Evidence to Decision Records

Decision records (see the `decision-record` skill) cite evidence through their `evidence_refs[]` frontmatter. Every entry must resolve to a ledger row (quote the claim text or a stable line ID) or a finding file under `docs/evidence/findings/`. A ruling that cites no evidence is incomplete; evidence that no ruling cites is unexamined background.
