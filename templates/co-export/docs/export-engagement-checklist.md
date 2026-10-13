# Export Engagement Checklist

> **Advisory QA gate.** Run every gate before an export-engagement deliverable is
> finalized. Each gate maps to the specialist skill that owns the evidence — a gate
> passes only when that skill's workflow produced the backing artifact. Exceptions
> are allowed but must be NAMED in the deliverable, never silent.

**Scope**: every client-facing deliverable anchored to a shipment, market entry, or
regulatory determination (reports, decks, document sets, costed logistics plans).
**Not in scope**: internal process notes and meeting minutes.

## Gates (pass / fail / n-a, in workflow order)

| # | Gate | Owning skill | Pass condition |
|---|------|--------------|----------------|
| 1 | **Export-control screening** | export-control-screening | Screening result (or documented dual-use analysis) recorded with date and list version; denied-party check attached |
| 2 | **HS classification** | hs-classification-workflow | 6+ digit code cited with the ruling/basis; assumption-based classifications flagged as provisional |
| 3 | **FTA origin determination** | fta-origin-determination | Origin criteria and rule cited per line item; cross-border accumulation claims reference the agreement text |
| 4 | **Duty / drawback computation** | customs-duty-drawback-workflow | Rates tied to the cited tariff schedule and date; drawback claims reference the admissibility conditions |
| 5 | **Landed-cost arithmetic** | landed-cost-calculation | Cost sheet reconciles: freight + insurance + duty + VAT/other surcharges; FX rates dated |
| 6 | **Trade documents** | trade-documentation-specialist | Document set consistent with the classification/origin/cost gates above (no orphan figures) |
| 7 | **Jurisdiction context** | docs/countries/<code>.md | Country profile loaded at Phase 0 intake; operational formats honored; unmapped jurisdictional questions routed to the PM, not answered ad hoc |

## Usage

- The producing agent runs the checklist **before** the deliverable leaves draft state and
  records the outcome on the report line: `Export Engagement Check: <reviewed, gates
  1-7 pass | reviewed with exceptions: #N — reason | n/a (no shipment-anchored deliverable)>`.
- A `fail` or unnamed exception blocks finalization — route the gap back to the owning
  specialist skill instead of shipping an unsourced figure.
- Known limitations discovered while gating are recorded in the engagement report
  (limitations section), not silently dropped.

## Verification

- QA reviewers sample one gate per deliverable and re-run the owning skill's check.
- Checklist changes ride the variant review flow; the gate set must stay in sync with
  the delivered specialist skills (a skill added without a gate is a review finding).
